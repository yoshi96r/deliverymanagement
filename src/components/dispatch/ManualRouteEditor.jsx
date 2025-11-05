
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  GripVertical, Trash2, Plus, Save, Navigation, 
  AlertCircle, CheckCircle2, Zap, AlertTriangle
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from 'date-fns';

export default function ManualRouteEditor({ route, onSave, onCancel }) {
  const [editedRoute, setEditedRoute] = useState({
    ...route,
    delivery_ids: [...(route.delivery_ids || [])]
  });
  const [availableDeliveries, setAvailableDeliveries] = useState([]);
  const [aiValidation, setAiValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const queryClient = useQueryClient();

  const { data: allDeliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  React.useEffect(() => {
    // Get deliveries not in current route
    const routeDeliveryIds = new Set(editedRoute.delivery_ids);
    const available = allDeliveries.filter(d => 
      !routeDeliveryIds.has(d.id) &&
      ['signed', 'at_facility', 'out_for_delivery'].includes(d.status)
    );
    setAvailableDeliveries(available);
  }, [allDeliveries, editedRoute.delivery_ids]);

  const routeDeliveries = React.useMemo(() => {
    return editedRoute.delivery_ids
      .map(id => allDeliveries.find(d => d.id === id))
      .filter(Boolean);
  }, [editedRoute.delivery_ids, allDeliveries]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(editedRoute.delivery_ids);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setEditedRoute({ ...editedRoute, delivery_ids: items });
  };

  const handleAddDelivery = (deliveryId) => {
    setEditedRoute({
      ...editedRoute,
      delivery_ids: [...editedRoute.delivery_ids, deliveryId]
    });
  };

  const handleRemoveDelivery = (deliveryId) => {
    setEditedRoute({
      ...editedRoute,
      delivery_ids: editedRoute.delivery_ids.filter(id => id !== deliveryId)
    });
  };

  const validateWithAI = async () => {
    setValidating(true);
    setAiValidation(null); // Clear previous validation
    try {
      const validationPrompt = `Validate this manually edited delivery route for potential issues.

ROUTE: ${editedRoute.route_name}
DRIVER: ${editedRoute.driver_name}
TOTAL STOPS: ${editedRoute.delivery_ids.length}

MANUAL SEQUENCE:
${routeDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name}
   Address: ${d.delivery_address}
   Premium: ${d.has_premium_insurance ? 'YES' : 'NO'}
   Time Window: ${d.scheduled_delivery_date ? format(new Date(d.scheduled_delivery_date), "MMM d 'at' h:mm a") : 'Flexible'}
`).join('\n')}

VALIDATION CHECKS:
1. Are time windows achievable in this sequence?
2. Is there excessive backtracking?
3. Are high-priority packages properly positioned?
4. Any geographic inefficiencies?
5. Realistic completion time?
6. Safety concerns (e.g., too many stops, insufficient breaks)?

Provide:
- Overall validation score (0-100)
- Identified issues (if any)
- Optimization suggestions
- Whether sequence is acceptable or needs changes
- Confidence in this assessment`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: validationPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            validation_score: { type: "number" },
            is_acceptable: { type: "boolean" },
            issues_found: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  issue: { type: "string" },
                  affected_stops: { type: "array", items: { type: "number" } }
                },
                required: ["severity", "issue"]
              }
            },
            optimization_suggestions: {
              type: "array",
              items: { type: "string" }
            },
            time_window_conflicts: {
              type: "array",
              items: { type: "string" }
            },
            estimated_backtracking_miles: { type: "number" },
            recommended_changes: {
              type: "array",
              items: { type: "string" }
            },
            confidence: { type: "number" }
          },
          required: ["validation_score", "is_acceptable", "issues_found", "optimization_suggestions"]
        }
      });

      setAiValidation(aiResponse);
      
      if (!aiResponse.is_acceptable) {
        toast.warning(`AI detected ${aiResponse.issues_found.length} issues with this sequence`);
      } else {
        toast.success(`Route validated! Score: ${aiResponse.validation_score}/100`);
      }
    } catch (error) {
      console.error("AI validation error:", error);
      toast.error("Failed to validate route");
    }
    setValidating(false);
  };

  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      // Recalculate route with AI
      const prompt = `Recalculate route metrics for manually edited route.

ROUTE: ${editedRoute.route_name}
DRIVER: ${editedRoute.driver_name}
STOPS: ${editedRoute.delivery_ids.length}

DELIVERY SEQUENCE:
${routeDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name}
   Address: ${d.delivery_address}
   Premium: ${d.has_premium_insurance ? 'YES' : 'NO'}
   Time Window: ${d.scheduled_delivery_date ? format(new Date(d.scheduled_delivery_date), "MMM d 'at' h:mm a") : 'Flexible'}
`).join('\n')}

${aiValidation ? `
AI VALIDATION RESULTS:
- Validation Score: ${aiValidation.validation_score}/100
- Issues Found: ${aiValidation.issues_found?.length || 0}
- Backtracking: ${aiValidation.estimated_backtracking_miles || 0} miles
- Acceptable: ${aiValidation.is_acceptable ? 'Yes' : 'No'}
` : ''}

Provide updated:
1. Total distance estimate
2. Total time estimate  
3. ETA for each stop
4. Any remaining issues with this sequence
5. Final efficiency assessment`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            total_distance_miles: { type: "number" },
            total_estimated_time_minutes: { type: "number" },
            stop_etas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  delivery_id: { type: "string" },
                  estimated_arrival: { type: "string" },
                  cumulative_time: { type: "number" }
                },
                required: ["delivery_id", "estimated_arrival", "cumulative_time"]
              }
            },
            potential_issues: { type: "array", items: { type: "string" } },
            final_efficiency_score: { type: "number" }
          },
          required: ["total_distance_miles", "total_estimated_time_minutes", "stop_etas"]
        }
      });

      // Update route with validation data
      await base44.entities.OptimizedRoute.update(editedRoute.id, {
        delivery_ids: editedRoute.delivery_ids,
        optimized_sequence: editedRoute.delivery_ids.map((id, idx) => ({
          delivery_id: id,
          sequence_number: idx + 1,
          estimated_arrival: aiResponse.stop_etas?.[idx]?.estimated_arrival || 'Calculating...',
          cumulative_time_minutes: aiResponse.stop_etas?.[idx]?.cumulative_time || 0
        })),
        total_distance_miles: aiResponse.total_distance_miles,
        total_estimated_time_minutes: aiResponse.total_estimated_time_minutes,
        potential_issues: aiResponse.potential_issues,
        efficiency_rating: aiResponse.final_efficiency_score,
        ai_insights: `Manually edited route. AI validation score: ${aiValidation?.validation_score || 'N/A'}/100. ${aiValidation?.is_acceptable ? 'Sequence acceptable.' : 'Issues detected - proceed with caution.'}`
      });

      // Update delivery sequences
      for (let i = 0; i < editedRoute.delivery_ids.length; i++) {
        await base44.entities.DeliveryRequest.update(editedRoute.delivery_ids[i], {
          route_sequence: i + 1,
          estimated_arrival: aiResponse.stop_etas?.[i]?.estimated_arrival
        });
      }

      // Send notification to driver
      if (route.driver_email) {
        await base44.integrations.Core.SendEmail({
          to: route.driver_email,
          subject: '🔄 Route Updated by Dispatcher',
          body: `Hello ${route.driver_name},

Your route has been manually adjusted by dispatch.

UPDATED ROUTE:
${routeDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name}
   ${d.delivery_address}
   ETA: ${aiResponse.stop_etas?.[i]?.estimated_arrival || 'TBD'}
`).join('\n')}

${aiValidation && !aiValidation.is_acceptable && aiValidation.issues_found?.length > 0 ? `
⚠️ NOTE: AI validation detected issues: ${aiValidation.issues_found.map(issue => issue.issue).join('; ')}
` : ''}

Updated metrics:
- Distance: ${aiResponse.total_distance_miles.toFixed(1)} miles
- Time: ${Math.round(aiResponse.total_estimated_time_minutes)} minutes

Check your Driver Mobile app for the updated sequence.

- Dispatch Team`,
          from_name: 'Route Management'
        });
      }


      return aiResponse;
    },
    onSuccess: (aiResponse) => {
      queryClient.invalidateQueries({ queryKey: ['optimizedRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['allDeliveries'] });
      
      if (aiResponse.potential_issues?.length > 0) {
        toast.success(`Route saved! AI detected ${aiResponse.potential_issues.length} potential issues. Driver notified.`);
      } else {
        toast.success("Route saved and driver notified!");
      }
      
      if (onSave) onSave();
    },
    onError: (error) => {
      console.error("Save route mutation error:", error);
      toast.error("Failed to save route.");
    }
  });

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <CardTitle>Manual Route Editor with AI Validation</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Route Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm"><strong>Route:</strong> {editedRoute.route_name}</p>
            <p className="text-sm"><strong>Driver:</strong> {editedRoute.driver_name}</p>
            <p className="text-sm"><strong>Total Stops:</strong> {editedRoute.delivery_ids.length}</p>
          </div>

          {/* AI Validation Button - NEW */}
          <Button
            onClick={validateWithAI}
            disabled={validating || editedRoute.delivery_ids.length === 0}
            variant="outline"
            className="w-full border-purple-300 text-purple-700"
          >
            {validating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                AI Validating Sequence...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Validate Route with AI
              </>
            )}
          </Button>

          {/* AI Validation Results - NEW */}
          {aiValidation && (
            <Card className={`border-2 ${
              aiValidation.is_acceptable ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {aiValidation.is_acceptable ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  )}
                  AI Validation Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Validation Score:</span>
                  <Badge className={
                    aiValidation.validation_score >= 80 ? 'bg-green-600 hover:bg-green-600/90' :
                    aiValidation.validation_score >= 60 ? 'bg-blue-600 hover:bg-blue-600/90' :
                    'bg-orange-600 hover:bg-orange-600/90'
                  }>
                    {aiValidation.validation_score}/100
                  </Badge>
                </div>

                {aiValidation.issues_found?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Issues Detected:</p>
                    {aiValidation.issues_found.map((issue, idx) => (
                      <div key={idx} className={`p-2 mb-2 rounded border ${
                        issue.severity === 'critical' ? 'bg-red-100 border-red-300' :
                        issue.severity === 'high' ? 'bg-orange-100 border-orange-300' :
                        'bg-yellow-100 border-yellow-300'
                      }`}>
                        <Badge className={`capitalize ${
                          issue.severity === 'critical' ? 'bg-red-600 hover:bg-red-600/90' :
                          issue.severity === 'high' ? 'bg-orange-600 hover:bg-orange-600/90' :
                          'bg-yellow-600 hover:bg-yellow-600/90'
                        }`}>
                          {issue.severity}
                        </Badge>
                        <p className="text-sm mt-1">{issue.issue}</p>
                        {issue.affected_stops?.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            Affects stops: {issue.affected_stops.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {aiValidation.optimization_suggestions?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">AI Suggestions:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {aiValidation.optimization_suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiValidation.estimated_backtracking_miles > 0 && (
                  <div className="p-2 bg-orange-100 rounded border border-orange-300">
                    <p className="text-sm text-orange-900">
                      ⚠️ Estimated backtracking: <strong>{aiValidation.estimated_backtracking_miles.toFixed(1)} miles</strong>
                    </p>
                  </div>
                )}
                {aiValidation.time_window_conflicts?.length > 0 && (
                  <div className="p-2 bg-red-100 rounded border border-red-300">
                    <p className="text-sm text-red-900 font-semibold mb-1">⏰ Time Window Conflicts:</p>
                    <ul className="list-disc list-inside text-sm text-red-900">
                      {aiValidation.time_window_conflicts.map((conflict, idx) => (
                        <li key={idx}>{conflict}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Route Sequence */}
          <div>
            <Label className="text-base font-bold mb-2 block">
              Route Sequence (Drag to Reorder)
            </Label>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="route-sequence">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2 min-h-[100px] p-2 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
                  >
                    {routeDeliveries.map((delivery, index) => (
                      <Draggable 
                        key={delivery.id} 
                        draggableId={delivery.id} 
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`p-3 bg-white rounded-lg border-2 ${
                              snapshot.isDragging ? 'border-blue-400 shadow-lg' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-5 h-5 text-gray-400" />
                              </div>
                              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">{delivery.customer_name}</p>
                                <p className="text-xs text-gray-600 truncate">{delivery.delivery_address}</p>
                                {delivery.has_premium_insurance && (
                                  <Badge className="bg-yellow-500 text-white text-xs mt-1 hover:bg-yellow-500/90">Premium Insurance</Badge>
                                )}
                                {delivery.scheduled_delivery_date && (
                                  <Badge variant="outline" className="text-xs mt-1 border-blue-400 text-blue-700">
                                    Time Window: {format(new Date(delivery.scheduled_delivery_date), "MMM d 'at' h:mm a")}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveDelivery(delivery.id)}
                                className="flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {routeDeliveries.length === 0 && (
                      <p className="text-center text-gray-500 py-8">
                        No deliveries in route. Add stops below.
                      </p>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Available Deliveries to Add */}
          {availableDeliveries.length > 0 && (
            <div>
              <Label className="text-base font-bold mb-2 block">
                Available Deliveries ({availableDeliveries.length})
              </Label>
              <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                {availableDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{delivery.customer_name}</p>
                      <p className="text-xs text-gray-600">{delivery.delivery_address}</p>
                      {delivery.has_premium_insurance && (
                        <Badge className="bg-yellow-500 text-white text-xs mt-1 hover:bg-yellow-500/90">Premium Insurance</Badge>
                      )}
                      {delivery.scheduled_delivery_date && (
                          <Badge variant="outline" className="text-xs mt-1 border-blue-400 text-blue-700">
                            Time Window: {format(new Date(delivery.scheduled_delivery_date), "MMM d 'at' h:mm a")}
                          </Badge>
                        )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddDelivery(delivery.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-semibold">Manual route editing</p>
              <p className="text-xs">
                AI will recalculate distances and ETAs after saving. The driver will be notified of changes.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveRouteMutation.mutate()}
              disabled={saveRouteMutation.isPending || editedRoute.delivery_ids.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700 font-bold"
            >
              {saveRouteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving & Notifying Driver...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Route & Notify Driver
                </>
              )}
            </Button>
          </div>

          {aiValidation && !aiValidation.is_acceptable && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-900">
                ⚠️ <strong>Warning:</strong> AI validation found issues. Review suggestions above before saving.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
