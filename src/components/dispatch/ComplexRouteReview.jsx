import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, CheckCircle2, XCircle, Navigation, 
  TrendingUp, Clock, MapPin, User, Lightbulb
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";

export default function ComplexRouteReview({ modification, onApprove, onReject }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [dispatcherNotes, setDispatcherNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: alternativeOptions } = useQuery({
    queryKey: ['alternativeRouteOptions', modification.route_id],
    queryFn: async () => {
      const alternatives = await base44.entities.RouteModification.filter({
        route_id: modification.route_id,
        status: 'alternative_option',
        suggested_at: modification.suggested_at // Same batch of suggestions
      });
      return alternatives;
    },
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  // Parse AI reasoning to extract structured data
  const parseAIAnalysis = (reasoning) => {
    try {
      const sections = {
        impact: reasoning.match(/Impact: (.+)/)?.[1] || 'Unknown',
        strategy: reasoning.match(/RECOMMENDED STRATEGY: (.+)\n/)?.[1] || 'Unknown',
        pros: [],
        cons: [],
        safety: reasoning.match(/Safety Concerns: (.+)/)?.[1] || 'None'
      };

      const prosMatch = reasoning.match(/PROS:\n([\s\S]+?)\n\nCONS:/);
      if (prosMatch) {
        sections.pros = prosMatch[1].split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace('• ', '').trim());
      }

      const consMatch = reasoning.match(/CONS:\n([\s\S]+?)\n\n/);
      if (consMatch) {
        sections.cons = consMatch[1].split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace('• ', '').trim());
      }

      return sections;
    } catch (e) {
      return null;
    }
  };

  const analysis = parseAIAnalysis(modification.ai_reasoning);

  const allOptions = [modification, ...alternativeOptions];

  const approveMutation = useMutation({
    mutationFn: async (optionToApprove) => {
      // Apply the selected option
      await base44.entities.RouteModification.update(optionToApprove.id, {
        status: 'dispatcher_approved',
        dispatcher_reviewed_by: 'Dispatcher',
        dispatcher_reviewed_at: new Date().toISOString(),
        dispatcher_notes: dispatcherNotes || 'Approved after reviewing all options',
        applied_at: new Date().toISOString()
      });

      // Update route
      await base44.entities.OptimizedRoute.update(modification.route_id, {
        delivery_ids: optionToApprove.modified_sequence,
        optimized_sequence: optionToApprove.modified_sequence.map((id, idx) => ({
          delivery_id: id,
          sequence_number: idx + 1
        }))
      });

      // Reject all other options
      for (const option of allOptions) {
        if (option.id !== optionToApprove.id) {
          await base44.entities.RouteModification.update(option.id, {
            status: 'dispatcher_rejected',
            dispatcher_notes: 'Alternative option not selected'
          });
        }
      }

      // Notify driver
      await base44.integrations.Core.SendEmail({
        to: modification.driver_email,
        subject: '✅ Route Updated - Complex Rerouting Approved',
        body: `Hello ${modification.driver_name},

Your multi-point feedback has been reviewed and a rerouting plan has been approved.

ISSUES YOU REPORTED:
${modification.driver_feedback}

APPROVED SOLUTION:
${analysis?.strategy || 'Route optimized based on your feedback'}

Your route has been updated. Check the Route tab for the new sequence.

Stay safe out there!

- Dispatch Team`,
        from_name: 'Route Management'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['optimizedRoutes'] });
      toast.success("Route rerouting approved and applied!");
      if (onApprove) onApprove();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      // Reject all options
      for (const option of allOptions) {
        await base44.entities.RouteModification.update(option.id, {
          status: 'dispatcher_rejected',
          dispatcher_reviewed_by: 'Dispatcher',
          dispatcher_reviewed_at: new Date().toISOString(),
          dispatcher_notes: dispatcherNotes || 'Rejected - driver should continue with original route'
        });
      }

      // Notify driver
      await base44.integrations.Core.SendEmail({
        to: modification.driver_email,
        subject: 'Route Feedback Reviewed',
        body: `Hello ${modification.driver_name},

We reviewed your route feedback. After analysis, we recommend continuing with the original route sequence.

Dispatcher notes: ${dispatcherNotes}

If you encounter further issues, please report them immediately.

- Dispatch Team`,
        from_name: 'Route Management'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
      toast.info("Route modification rejected");
      if (onReject) onReject();
    },
  });

  const minutesAgo = differenceInMinutes(new Date(), new Date(modification.suggested_at));

  return (
    <Card className="border-2 border-orange-300 bg-orange-50">
      <CardHeader className="bg-orange-100 border-b border-orange-200">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Complex Rerouting Review Required
            </CardTitle>
            <p className="text-sm text-orange-700 mt-1">
              Driver: {modification.driver_name} • Reported {minutesAgo}m ago
            </p>
          </div>
          <Badge className="bg-red-600 text-white animate-pulse">
            URGENT
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Driver Feedback */}
        <Card className="border-2 border-red-300 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-900">Driver's Reported Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {modification.driver_feedback?.split('\n\n').map((feedback, idx) => (
              <div key={idx} className="p-2 bg-white rounded border border-red-200">
                <p className="text-sm text-gray-900">{feedback}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Impact Assessment */}
        {analysis && (
          <Card className="border-2 border-purple-300 bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-purple-900">AI Impact Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-white rounded">
                  <p className="text-xs text-gray-600">Impact Level:</p>
                  <Badge className={
                    analysis.impact?.includes('CRITICAL') ? 'bg-red-600' :
                    analysis.impact?.includes('MAJOR') ? 'bg-orange-600' :
                    'bg-yellow-600'
                  }>
                    {analysis.impact}
                  </Badge>
                </div>
                <div className="p-2 bg-white rounded">
                  <p className="text-xs text-gray-600">Safety:</p>
                  <p className="text-sm font-semibold text-gray-900">{analysis.safety}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rerouting Options */}
        <div>
          <Label className="text-base font-bold mb-3 block text-gray-900">
            {allOptions.length} AI Rerouting Option{allOptions.length > 1 ? 's' : ''} Available
          </Label>
          
          <Tabs value={selectedOption || modification.id} onValueChange={setSelectedOption}>
            <TabsList className="grid w-full grid-cols-3 bg-white">
              {allOptions.slice(0, 3).map((option, idx) => (
                <TabsTrigger key={option.id} value={option.id}>
                  Option {idx + 1}
                  {idx === 0 && (
                    <Badge className="ml-2 bg-green-600 text-white text-xs">
                      Recommended
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {allOptions.slice(0, 3).map((option) => {
              const optionAnalysis = parseAIAnalysis(option.ai_reasoning);
              
              return (
                <TabsContent key={option.id} value={option.id} className="mt-3">
                  <Card className="border-2 border-blue-300">
                    <CardHeader className="pb-3 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-blue-900">
                          {optionAnalysis?.strategy || 'Route Modification'}
                        </CardTitle>
                        <Badge className={
                          option.ai_confidence >= 85 ? 'bg-green-600' :
                          option.ai_confidence >= 70 ? 'bg-blue-600' :
                          'bg-yellow-600'
                        }>
                          {option.ai_confidence}% Confident
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Time Impact */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                          <Clock className="w-5 h-5 mx-auto text-green-600 mb-1" />
                          <p className="text-xl font-bold text-green-900">
                            {option.time_saved_minutes > 0 ? '-' : '+'}{Math.abs(option.time_saved_minutes)}m
                          </p>
                          <p className="text-xs text-gray-600">Time Impact</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <Navigation className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                          <p className="text-xl font-bold text-blue-900">
                            {option.affected_deliveries?.length || 0}
                          </p>
                          <p className="text-xs text-gray-600">Stops Changed</p>
                        </div>
                      </div>

                      {/* Pros */}
                      {optionAnalysis?.pros?.length > 0 && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs font-semibold text-green-900 mb-2">✅ Advantages:</p>
                          <ul className="space-y-1">
                            {optionAnalysis.pros.map((pro, idx) => (
                              <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                {pro}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Cons */}
                      {optionAnalysis?.cons?.length > 0 && (
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <p className="text-xs font-semibold text-orange-900 mb-2">⚠️ Considerations:</p>
                          <ul className="space-y-1">
                            {optionAnalysis.cons.map((con, idx) => (
                              <li key={idx} className="text-sm text-orange-800 flex items-start gap-2">
                                <span className="text-orange-600">•</span>
                                {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sequence Comparison */}
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-900 mb-2">Sequence Changes:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Original:</p>
                            <div className="space-y-1">
                              {option.original_sequence?.slice(0, 5).map((id, idx) => {
                                const delivery = deliveries.find(d => d.id === id);
                                return delivery ? (
                                  <div key={id} className="text-xs p-1 bg-gray-100 rounded">
                                    {idx + 1}. {delivery.customer_name}
                                  </div>
                                ) : null;
                              })}
                              {option.original_sequence?.length > 5 && (
                                <p className="text-xs text-gray-500">...+{option.original_sequence.length - 5} more</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Modified:</p>
                            <div className="space-y-1">
                              {option.modified_sequence?.slice(0, 5).map((id, idx) => {
                                const delivery = deliveries.find(d => d.id === id);
                                const isChanged = option.original_sequence?.[idx] !== id;
                                return delivery ? (
                                  <div key={id} className={`text-xs p-1 rounded ${
                                    isChanged ? 'bg-blue-100 border border-blue-300 font-semibold' : 'bg-gray-100'
                                  }`}>
                                    {idx + 1}. {delivery.customer_name} {isChanged && '↻'}
                                  </div>
                                ) : null;
                              })}
                              {option.modified_sequence?.length > 5 && (
                                <p className="text-xs text-gray-500">...+{option.modified_sequence.length - 5} more</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        {/* Dispatcher Notes */}
        <div>
          <Label htmlFor="dispatcherNotes">Dispatcher Notes (Optional)</Label>
          <Textarea
            id="dispatcherNotes"
            value={dispatcherNotes}
            onChange={(e) => setDispatcherNotes(e.target.value)}
            placeholder="Add any notes for the driver about this decision..."
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            onClick={() => {
              const reason = prompt("Reason for rejecting ALL options:");
              if (reason) {
                setDispatcherNotes(reason);
                rejectMutation.mutate();
              }
            }}
            variant="outline"
            className="border-red-300 text-red-700"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject All Options
          </Button>
          <Button
            onClick={() => {
              const optionToApprove = selectedOption 
                ? allOptions.find(o => o.id === selectedOption)
                : modification;
              approveMutation.mutate(optionToApprove);
            }}
            className="bg-green-600 hover:bg-green-700 font-bold"
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            {approveMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Applying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve {selectedOption ? 'Selected' : 'Recommended'} Option
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-900">
            <Lightbulb className="w-4 h-4 inline mr-1" />
            <strong>Tip:</strong> Review all options before approving. The recommended option has the highest AI confidence, 
            but alternatives may better suit specific circumstances.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}