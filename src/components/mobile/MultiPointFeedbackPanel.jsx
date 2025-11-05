import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, MapPin, Construction, UserX, Clock, 
  Navigation, Zap, Plus, X, Camera
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function MultiPointFeedbackPanel({ route, driverEmail, driverName, currentLocation }) {
  const [feedbackPoints, setFeedbackPoints] = useState([]);
  const [currentFeedback, setCurrentFeedback] = useState({
    type: "",
    location: "",
    description: "",
    severity: "medium",
    affectsStops: []
  });
  const [analyzing, setAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const feedbackTypes = [
    { 
      value: "road_closure", 
      icon: Construction, 
      label: "Road Closure",
      color: "bg-red-600",
      description: "Road is blocked or closed"
    },
    { 
      value: "heavy_traffic", 
      icon: AlertTriangle, 
      label: "Heavy Traffic",
      color: "bg-orange-600",
      description: "Significant traffic congestion"
    },
    { 
      value: "customer_unavailable", 
      icon: UserX, 
      label: "Customer Unavailable",
      color: "bg-yellow-600",
      description: "Customer not at delivery location"
    },
    { 
      value: "address_issue", 
      icon: MapPin, 
      label: "Address Problem",
      color: "bg-purple-600",
      description: "Incorrect or unclear address"
    },
    { 
      value: "running_behind", 
      icon: Clock, 
      label: "Running Behind",
      color: "bg-blue-600",
      description: "Behind schedule on route"
    },
    { 
      value: "better_route_seen", 
      icon: Navigation, 
      label: "Better Route Found",
      color: "bg-green-600",
      description: "I found a more efficient path"
    }
  ];

  const addFeedbackPoint = () => {
    if (!currentFeedback.type || !currentFeedback.description) {
      toast.error("Please select type and provide description");
      return;
    }

    const newPoint = {
      ...currentFeedback,
      id: Date.now().toString(),
      location: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : currentFeedback.location,
      timestamp: new Date().toISOString()
    };

    setFeedbackPoints([...feedbackPoints, newPoint]);
    
    // Reset current feedback
    setCurrentFeedback({
      type: "",
      location: "",
      description: "",
      severity: "medium",
      affectsStops: []
    });

    toast.success("Feedback point added!");
  };

  const removeFeedbackPoint = (id) => {
    setFeedbackPoints(feedbackPoints.filter(p => p.id !== id));
  };

  const submitAllFeedbackMutation = useMutation({
    mutationFn: async () => {
      // Comprehensive AI analysis with multiple feedback points
      const analysisPrompt = `URGENT: Driver has reported MULTIPLE real-time issues on their active route requiring immediate AI rerouting analysis.

ROUTE INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Route: ${route.route_name}
- Driver: ${driverName}
- Total Stops: ${route.delivery_ids.length}
- Current Status: ${route.status}
- Current Time: ${new Date().toLocaleTimeString()}

DRIVER FEEDBACK POINTS (${feedbackPoints.length}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${feedbackPoints.map((point, i) => `
${i + 1}. ${point.type.replace(/_/g, ' ').toUpperCase()} (Severity: ${point.severity})
   Location: ${point.location || 'Current position'}
   Time Reported: ${new Date(point.timestamp).toLocaleTimeString()}
   Description: ${point.description}
   ${point.affectsStops.length > 0 ? `Affects Stops: ${point.affectsStops.join(', ')}` : 'General route impact'}
`).join('\n')}

CURRENT ROUTE SEQUENCE:
${route.delivery_ids.slice(0, 10).map((id, i) => `${i + 1}. Delivery ${id}`).join('\n')}
${route.delivery_ids.length > 10 ? `... and ${route.delivery_ids.length - 10} more stops` : ''}

CRITICAL ANALYSIS REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. IMPACT ASSESSMENT:
   - How do these issues affect route completion?
   - Which deliveries are most impacted?
   - Can all deliveries still be completed today?

2. IMMEDIATE REROUTING OPTIONS:
   - Provide 2-3 alternative route sequences
   - For each option, include:
     * Which stops to prioritize/skip/resequence
     * Estimated time impact (+/- minutes)
     * Complexity level (simple/moderate/complex)
     * Pros and cons of this approach
     * Confidence score (0-100)

3. PRIORITY RECOMMENDATIONS:
   - Which deliveries MUST be completed today?
   - Which can be rescheduled if needed?
   - Any safety concerns that override delivery priorities?

4. DISPATCHER APPROVAL NEEDED?
   - Simple changes: Auto-apply (e.g., resequence 2-3 stops)
   - Complex changes: Require dispatcher review (e.g., skipping multiple deliveries, major resequence)

Provide comprehensive rerouting analysis with multiple options ranked by effectiveness.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            impact_assessment: {
              type: "object",
              properties: {
                severity_level: { type: "string", enum: ["minor", "moderate", "major", "critical"] },
                route_completion_feasible: { type: "boolean" },
                deliveries_at_risk: { type: "array", items: { type: "string" } },
                estimated_total_delay_minutes: { type: "number" }
              }
            },
            rerouting_options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  option_name: { type: "string" },
                  strategy: { type: "string" },
                  modified_sequence: { type: "array", items: { type: "string" } },
                  deliveries_to_skip: { type: "array", items: { type: "string" } },
                  deliveries_to_prioritize: { type: "array", items: { type: "string" } },
                  estimated_time_impact_minutes: { type: "number" },
                  complexity: { type: "string", enum: ["simple", "moderate", "complex"] },
                  pros: { type: "array", items: { type: "string" } },
                  cons: { type: "array", items: { type: "string" } },
                  confidence_score: { type: "number" },
                  requires_dispatcher_approval: { type: "boolean" }
                }
              }
            },
            recommended_option: { type: "number" },
            safety_concerns: { type: "array", items: { type: "string" } },
            must_complete_today: { type: "array", items: { type: "string" } },
            can_reschedule: { type: "array", items: { type: "string" } },
            overall_recommendation: { type: "string" }
          }
        }
      });

      // Create route modification with multiple options
      const bestOption = aiResponse.rerouting_options[aiResponse.recommended_option || 0];

      if (!bestOption) {
        throw new Error("AI did not provide valid rerouting options");
      }

      const modification = await base44.entities.RouteModification.create({
        route_id: route.id,
        driver_email: driverEmail,
        driver_name: driverName,
        modification_type: bestOption.deliveries_to_skip?.length > 0 ? 'skip_delivery' : 'resequence',
        trigger_reason: 'driver_feedback',
        trigger_details: `Multi-point driver feedback: ${feedbackPoints.map(p => p.type).join(', ')}`,
        original_sequence: route.delivery_ids,
        modified_sequence: bestOption.modified_sequence,
        affected_deliveries: bestOption.modified_sequence,
        original_estimated_time: route.total_estimated_time_minutes,
        new_estimated_time: route.total_estimated_time_minutes + bestOption.estimated_time_impact_minutes,
        time_saved_minutes: -bestOption.estimated_time_impact_minutes,
        ai_confidence: bestOption.confidence_score,
        ai_reasoning: `MULTI-POINT FEEDBACK ANALYSIS

Impact: ${aiResponse.impact_assessment.severity_level.toUpperCase()}
Route Completion: ${aiResponse.impact_assessment.route_completion_feasible ? 'FEASIBLE' : 'AT RISK'}
Estimated Delay: ${aiResponse.impact_assessment.estimated_total_delay_minutes} minutes

RECOMMENDED STRATEGY: ${bestOption.option_name}
${bestOption.strategy}

PROS:
${bestOption.pros?.map(p => `• ${p}`).join('\n')}

CONS:
${bestOption.cons?.map(c => `• ${c}`).join('\n')}

Alternative Options Available: ${aiResponse.rerouting_options.length - 1}

Safety Concerns: ${aiResponse.safety_concerns?.join(', ') || 'None'}

Overall: ${aiResponse.overall_recommendation}`,
        driver_feedback: feedbackPoints.map(p => 
          `${p.type}: ${p.description} (${p.severity})`
        ).join('\n\n'),
        suggested_at: new Date().toISOString(),
        status: bestOption.requires_dispatcher_approval ? 'pending_dispatcher_approval' : 'driver_accepted',
        requires_dispatcher_approval: bestOption.requires_dispatcher_approval,
        expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
        priority: aiResponse.impact_assessment.severity_level === 'critical' ? 'urgent' : 
                  aiResponse.impact_assessment.severity_level === 'major' ? 'high' : 'medium'
      });

      // Store alternative options as separate modifications for dispatcher review
      if (aiResponse.rerouting_options.length > 1 && bestOption.requires_dispatcher_approval) {
        for (let i = 0; i < aiResponse.rerouting_options.length; i++) {
          if (i === aiResponse.recommended_option) continue; // Skip the main one
          
          const altOption = aiResponse.rerouting_options[i];
          
          await base44.entities.RouteModification.create({
            route_id: route.id,
            driver_email: driverEmail,
            driver_name: driverName,
            modification_type: 'resequence',
            trigger_reason: 'driver_feedback',
            trigger_details: `Alternative Option ${i + 1}: ${altOption.option_name}`,
            original_sequence: route.delivery_ids,
            modified_sequence: altOption.modified_sequence,
            affected_deliveries: altOption.modified_sequence,
            ai_confidence: altOption.confidence_score,
            ai_reasoning: `${altOption.strategy}\n\nPros: ${altOption.pros?.join(', ')}\nCons: ${altOption.cons?.join(', ')}`,
            suggested_at: new Date().toISOString(),
            status: 'alternative_option',
            requires_dispatcher_approval: true,
            expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
            priority: 'medium'
          });
        }
      }

      // Auto-apply if simple and doesn't need approval
      if (!bestOption.requires_dispatcher_approval) {
        await base44.entities.OptimizedRoute.update(route.id, {
          delivery_ids: bestOption.modified_sequence,
          optimized_sequence: bestOption.modified_sequence.map((id, idx) => ({
            delivery_id: id,
            sequence_number: idx + 1
          }))
        });

        await base44.entities.RouteModification.update(modification.id, {
          status: 'automatically_applied',
          applied_at: new Date().toISOString()
        });
      } else {
        // Notify dispatcher for complex changes
        await base44.integrations.Core.SendEmail({
          to: 'dispatch@usps.com',
          subject: `🚨 Complex Route Change Needed - ${driverName}`,
          body: `Driver ${driverName} reported ${feedbackPoints.length} issues requiring immediate rerouting:

ISSUES REPORTED:
${feedbackPoints.map(p => `• ${p.type.replace(/_/g, ' ')}: ${p.description}`).join('\n')}

AI Analysis: ${aiResponse.impact_assessment.severity_level.toUpperCase()} impact
Route Completion: ${aiResponse.impact_assessment.route_completion_feasible ? 'Still feasible with changes' : 'AT RISK'}

${aiResponse.rerouting_options.length} rerouting options generated.

URGENT: Please review and approve in Dispatch Dashboard > Routes tab.`,
          from_name: 'Real-Time Route System'
        });
      }

      return {
        requiresApproval: bestOption.requires_dispatcher_approval,
        optionsCount: aiResponse.rerouting_options.length,
        impactLevel: aiResponse.impact_assessment.severity_level,
        modificationId: modification.id
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['activeDriverRoute'] });
      queryClient.invalidateQueries({ queryKey: ['driverDeliveries'] });
      queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
      
      if (result.requiresApproval) {
        toast.success(`${result.optionsCount} rerouting options sent to dispatcher for urgent review!`);
      } else {
        toast.success("Route automatically optimized based on your feedback!");
      }
      
      setFeedbackPoints([]);
      setCurrentFeedback({
        type: "",
        location: "",
        description: "",
        severity: "medium",
        affectsStops: []
      });
    },
  });

  return (
    <Card className="border-2 border-orange-300 bg-orange-50">
      <CardHeader className="pb-3 bg-orange-100 border-b border-orange-200">
        <CardTitle className="text-base text-orange-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Real-Time Route Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="p-3 bg-white rounded-lg border border-orange-200">
          <p className="text-sm text-orange-900 font-semibold mb-1">🚨 Report Multiple Issues</p>
          <p className="text-xs text-orange-800">
            Add all problems you're experiencing right now. AI will analyze and suggest the best rerouting strategy.
          </p>
        </div>

        {/* Current Feedback Points */}
        {feedbackPoints.length > 0 && (
          <div className="space-y-2">
            <Label className="font-semibold text-gray-900">Active Feedback Points ({feedbackPoints.length})</Label>
            {feedbackPoints.map((point) => {
              const typeInfo = feedbackTypes.find(t => t.value === point.type);
              const Icon = typeInfo?.icon || AlertTriangle;
              
              return (
                <div key={point.id} className="p-3 bg-white rounded-lg border-2 border-orange-300 flex items-start gap-3">
                  <div className={`w-10 h-10 ${typeInfo?.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{typeInfo?.label}</p>
                      <Badge className={
                        point.severity === 'critical' ? 'bg-red-600' :
                        point.severity === 'high' ? 'bg-orange-600' :
                        'bg-yellow-600'
                      }>
                        {point.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700">{point.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(point.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFeedbackPoint(point.id)}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add New Feedback Point */}
        <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-gray-200">
          <Label className="font-semibold text-gray-900">Add Issue</Label>
          
          {/* Issue Type Grid */}
          <div className="grid grid-cols-2 gap-2">
            {feedbackTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => setCurrentFeedback({ ...currentFeedback, type: type.value })}
                  className={`p-2 rounded-lg border-2 transition-all text-left ${
                    currentFeedback.type === type.value
                      ? `${type.color} text-white border-transparent`
                      : 'bg-white border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-1 ${
                    currentFeedback.type === type.value ? 'text-white' : 'text-gray-600'
                  }`} />
                  <p className={`text-xs font-semibold ${
                    currentFeedback.type === type.value ? 'text-white' : 'text-gray-900'
                  }`}>
                    {type.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Severity */}
          {currentFeedback.type && (
            <>
              <div>
                <Label className="text-xs text-gray-700 mb-1 block">Severity</Label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high', 'critical'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => setCurrentFeedback({ ...currentFeedback, severity: sev })}
                      className={`flex-1 py-2 px-3 rounded text-xs font-semibold border-2 ${
                        currentFeedback.severity === sev
                          ? sev === 'critical' ? 'bg-red-600 text-white border-red-600' :
                            sev === 'high' ? 'bg-orange-600 text-white border-orange-600' :
                            sev === 'medium' ? 'bg-yellow-600 text-white border-yellow-600' :
                            'bg-blue-600 text-white border-blue-600'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-xs text-gray-700">Details *</Label>
                <Textarea
                  id="description"
                  value={currentFeedback.description}
                  onChange={(e) => setCurrentFeedback({ ...currentFeedback, description: e.target.value })}
                  placeholder="Describe the issue in detail..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Add Point Button */}
              <Button
                onClick={addFeedbackPoint}
                variant="outline"
                size="sm"
                className="w-full border-orange-300 text-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add This Issue
              </Button>
            </>
          )}
        </div>

        {/* Submit All Feedback */}
        {feedbackPoints.length > 0 && (
          <Button
            onClick={() => submitAllFeedbackMutation.mutate()}
            disabled={submitAllFeedbackMutation.isPending}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-6 text-lg"
          >
            {submitAllFeedbackMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                AI Analyzing {feedbackPoints.length} Issues...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Get AI Rerouting Options ({feedbackPoints.length} issues)
              </>
            )}
          </Button>
        )}

        {feedbackPoints.length === 0 && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
            <p className="text-sm text-blue-900">
              No feedback points added yet. Select an issue type above to start.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}