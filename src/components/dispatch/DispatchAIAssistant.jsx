
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, Zap, AlertTriangle, TrendingUp, User, MessageSquare,
  CheckCircle2, XCircle, Clock, Package, Navigation, Shield,
  DollarSign, Phone, Mail
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";

export default function DispatchAIAssistant({ onActionTrigger }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState(null);
  const queryClient = useQueryClient();

  const { data: recommendations, refetch: refetchRecommendations } = useQuery({
    queryKey: ['aiRecommendations'],
    queryFn: async () => {
      const recs = await base44.entities.DispatchAssistantRecommendation.filter({
        status: 'active'
      });
      return recs.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.ai_confidence - a.ai_confidence;
      });
    },
    initialData: [],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: exceptions } = useQuery({
    queryKey: ['allExceptions'],
    queryFn: () => base44.entities.DeliveryException.list(),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const { data: activeRoutes } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => base44.entities.OptimizedRoute.filter({
      status: ['active', 'in_progress']
    }),
    initialData: [],
  });

  const { data: pendingModifications } = useQuery({
    queryKey: ['pendingRouteModifications'],
    queryFn: () => base44.entities.RouteModification.filter({
      status: 'pending_dispatcher_approval'
    }),
    initialData: [],
  });

  const dismissRecommendationMutation = useMutation({
    mutationFn: async ({ recommendationId, reason }) => {
      await base44.entities.DispatchAssistantRecommendation.update(recommendationId, {
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        dismissed_by: 'Dispatcher',
        dismissal_reason: reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRecommendations'] });
    },
  });

  const markActionedMutation = useMutation({
    mutationFn: async ({ recommendationId, result }) => {
      await base44.entities.DispatchAssistantRecommendation.update(recommendationId, {
        status: 'actioned',
        actioned_at: new Date().toISOString(),
        actioned_by: 'Dispatcher',
        action_result: result
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRecommendations'] });
    },
  });

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      // Gather current state
      const unresolvedExceptions = exceptions.filter(e => e.resolution_status !== 'resolved');
      const escalatedExceptions = unresolvedExceptions.filter(e => e.escalated);
      const criticalExceptions = unresolvedExceptions.filter(e => e.severity === 'critical');
      
      const highPriorityDeliveries = deliveries.filter(d => 
        d.has_premium_insurance && 
        ['signed', 'at_facility', 'out_for_delivery'].includes(d.status)
      );

      const delayedDeliveries = deliveries.filter(d => {
        if (!d.scheduled_delivery_date || d.status === 'delivered') return false;
        return new Date(d.scheduled_delivery_date) < new Date();
      });

      // Get drivers with issues
      const driversWithIssues = {};
      exceptions.filter(e => e.resolution_status !== 'resolved').forEach(e => {
        if (!driversWithIssues[e.reported_by_email]) {
          driversWithIssues[e.reported_by_email] = {
            name: e.reported_by,
            email: e.reported_by_email,
            exceptions: [],
            escalated: 0
          };
        }
        driversWithIssues[e.reported_by_email].exceptions.push(e);
        if (e.escalated) driversWithIssues[e.reported_by_email].escalated++;
      });

      // Comprehensive AI analysis
      const analysisPrompt = `You are an AI Dispatch Assistant analyzing the current USPS delivery operations state in real-time.

CURRENT OPERATIONAL STATUS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXCEPTIONS:
- Total Unresolved: ${unresolvedExceptions.length}
- Escalated: ${escalatedExceptions.length}
- Critical Severity: ${criticalExceptions.length}

DELIVERIES:
- High-Priority Packages: ${highPriorityDeliveries.length}
- Delayed Deliveries: ${delayedDeliveries.length}
- Total Active: ${deliveries.filter(d => d.status !== 'delivered').length}

ROUTES:
- Active Routes: ${activeRoutes.length}
- Pending Modifications: ${pendingModifications.length}

DRIVERS WITH ISSUES:
${Object.values(driversWithIssues).map(d => `
- ${d.name} (${d.email})
  Exceptions: ${d.exceptions.length}
  Escalated: ${d.escalated}
  Types: ${d.exceptions.map(e => e.exception_type).join(', ')}
`).join('\n')}

CRITICAL EXCEPTIONS DETAILS:
${criticalExceptions.slice(0, 5).map(e => `
- ${e.tracking_number}: ${e.exception_type}
  Driver: ${e.reported_by}
  Description: ${e.description}
  Escalated: ${e.escalated ? 'YES' : 'NO'}
  Time: ${format(new Date(e.timestamp), "h:mm a")}
`).join('\n')}

DELAYED DELIVERIES:
${delayedDeliveries.slice(0, 5).map(d => `
- ${d.tracking_number}: ${d.customer_name}
  Scheduled: ${format(new Date(d.scheduled_delivery_date), "MMM d 'at' h:mm a")}
  Current Status: ${d.status}
  Premium: ${d.has_premium_insurance ? 'YES' : 'NO'}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANALYSIS TASK:
Analyze the current situation and provide TOP 5 most important dispatcher actions needed RIGHT NOW.

For each recommendation, provide:
1. Specific action to take
2. Priority level (critical/high/medium/low)
3. Brief summary (one sentence)
4. Detailed context (why this matters now)
5. Estimated impact if action is taken
6. Confidence score (0-100)
7. Type of recommendation
8. Quick action data (what exactly to do)

Focus on:
- Critical safety issues (highest priority)
- Escalated exceptions needing immediate attention
- Multiple exceptions from same driver (pattern detection)
- High-value delayed deliveries
- Route modifications that need approval
- Drivers who may need support

Provide actionable, specific recommendations that a dispatcher can execute immediately.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  recommendation_type: { type: "string" },
                  priority: { type: "string" },
                  title: { type: "string" },
                  summary: { type: "string" },
                  context: { type: "string" },
                  estimated_impact: { type: "string" },
                  confidence_score: { type: "number" },
                  related_entity_id: { type: "string" },
                  related_entity_type: { type: "string" },
                  quick_action_type: { type: "string" },
                  quick_action_details: { type: "string" }
                }
              }
            },
            critical_insights: {
              type: "array",
              items: { type: "string" }
            },
            overall_status: { type: "string" }
          }
        }
      });

      // Create recommendation records
      let createdCount = 0;
      for (const rec of aiResponse.recommendations) {
        // Find related entity
        let relatedDriverEmail = null;
        let relatedTrackingNumber = null;

        if (rec.related_entity_type === 'exception') {
          const exception = exceptions.find(e => e.id === rec.related_entity_id);
          if (exception) {
            relatedDriverEmail = exception.reported_by_email;
            relatedTrackingNumber = exception.tracking_number;
          }
        } else if (rec.related_entity_type === 'delivery') {
          const delivery = deliveries.find(d => d.id === rec.related_entity_id);
          if (delivery) {
            relatedDriverEmail = delivery.carrier_email;
            relatedTrackingNumber = delivery.tracking_number;
          }
        }

        await base44.entities.DispatchAssistantRecommendation.create({
          recommendation_type: rec.recommendation_type,
          priority: rec.priority,
          title: rec.title,
          summary: rec.summary,
          context: rec.context,
          reasoning: `AI Analysis: ${rec.context}`,
          ai_confidence: rec.confidence_score,
          estimated_impact: rec.estimated_impact,
          related_entity_type: rec.related_entity_type,
          related_entity_id: rec.related_entity_id,
          related_driver_email: relatedDriverEmail,
          related_tracking_number: relatedTrackingNumber,
          quick_action_data: {
            action_type: rec.quick_action_type,
            details: rec.quick_action_details
          },
          status: 'active',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 60 * 60000).toISOString(), // 2 hours
          analysis_version: '1.0'
        });

        createdCount++;
      }

      setLastAnalysisTime(new Date());
      refetchRecommendations();
      
      toast.success(`AI Assistant generated ${createdCount} actionable recommendations!`);
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Failed to run AI analysis");
    }
    setAnalyzing(false);
  };

  const handleQuickAction = async (recommendation) => {
    try {
      const actionData = recommendation.quick_action_data;

      if (recommendation.recommendation_type === 'send_driver_message') {
        // Trigger messaging dialog
        if (onActionTrigger) {
          onActionTrigger('message', {
            driverEmail: recommendation.related_driver_email,
            message: actionData.details
          });
        }
        
        markActionedMutation.mutate({
          recommendationId: recommendation.id,
          result: 'Message dialog opened'
        });
      } else if (recommendation.recommendation_type === 'escalate_exception') {
        const exception = exceptions.find(e => e.id === recommendation.related_entity_id);
        if (exception && !exception.escalated) {
          await base44.entities.DeliveryException.update(exception.id, {
            escalated: true,
            escalated_at: new Date().toISOString(),
            escalated_by: 'AI Assistant',
            escalation_reason: recommendation.context,
            escalation_priority: recommendation.priority === 'critical' ? 'emergency' : 'urgent',
            resolution_status: 'escalated'
          });
          
          markActionedMutation.mutate({
            recommendationId: recommendation.id,
            result: 'Exception escalated'
          });
          
          queryClient.invalidateQueries({ queryKey: ['allExceptions'] });
          toast.success("Exception escalated based on AI recommendation!");
        }
      } else if (recommendation.recommendation_type === 'contact_customer') {
        const delivery = deliveries.find(d => d.id === recommendation.related_entity_id);
        if (delivery?.customer_phone) {
          window.open(`tel:${delivery.customer_phone}`);
          
          markActionedMutation.mutate({
            recommendationId: recommendation.id,
            result: 'Phone call initiated'
          });
        } else if (delivery?.customer_email) {
          window.open(`mailto:${delivery.customer_email}`);
          
          markActionedMutation.mutate({
            recommendationId: recommendation.id,
            result: 'Email opened'
          });
        }
      } else if (recommendation.recommendation_type === 'approve_route_change') {
        const modification = pendingModifications.find(m => m.id === recommendation.related_entity_id);
        if (modification) {
          await base44.entities.RouteModification.update(modification.id, {
            status: 'dispatcher_approved',
            dispatcher_reviewed_by: 'Dispatcher (AI Recommended)',
            dispatcher_reviewed_at: new Date().toISOString(),
            dispatcher_notes: `Approved based on AI recommendation: ${recommendation.summary}`,
            applied_at: new Date().toISOString()
          });

          await base44.entities.OptimizedRoute.update(modification.route_id, {
            delivery_ids: modification.modified_sequence,
            optimized_sequence: modification.modified_sequence.map((id, idx) => ({
              delivery_id: id,
              sequence_number: idx + 1
            }))
          });

          markActionedMutation.mutate({
            recommendationId: recommendation.id,
            result: 'Route modification approved'
          });

          queryClient.invalidateQueries({ queryKey: ['pendingRouteModifications'] });
          queryClient.invalidateQueries({ queryKey: ['activeRoutes'] });
          toast.success("Route change approved!");
        }
      } else {
        // Generic action - trigger callback
        if (onActionTrigger) {
          onActionTrigger(recommendation.recommendation_type, recommendation);
        }
        
        markActionedMutation.mutate({
          recommendationId: recommendation.id,
          result: 'Action triggered'
        });
      }
    } catch (error) {
      console.error("Error executing quick action:", error);
      toast.error("Failed to execute action");
    }
  };

  const handleDismiss = (recommendation) => {
    const reason = prompt("Reason for dismissing this recommendation (optional):");
    dismissRecommendationMutation.mutate({
      recommendationId: recommendation.id,
      reason: reason || 'Dismissed by dispatcher'
    });
  };

  const getActionIcon = (type) => {
    const icons = {
      reassign_driver: User,
      contact_customer: Phone,
      escalate_exception: AlertTriangle,
      optimize_route: Navigation,
      send_driver_message: MessageSquare,
      create_task: CheckCircle2,
      approve_route_change: CheckCircle2,
      prioritize_delivery: Package,
      safety_intervention: Shield,
      payment_action: DollarSign
    };
    return icons[type] || Brain;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'border-red-400 bg-red-50',
      high: 'border-orange-400 bg-orange-50',
      medium: 'border-yellow-400 bg-yellow-50',
      low: 'border-blue-400 bg-blue-50'
    };
    return colors[priority] || 'border-gray-200 bg-white';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      critical: 'bg-red-600 text-white animate-pulse',
      high: 'bg-orange-600 text-white',
      medium: 'bg-yellow-600 text-white',
      low: 'bg-blue-600 text-white'
    };
    return badges[priority] || 'bg-gray-600 text-white';
  };

  return (
    <div className="space-y-4">
      {/* AI Assistant Header */}
      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg text-gray-900">AI Dispatch Assistant</CardTitle>
                <p className="text-sm text-gray-600">
                  {recommendations.length} active recommendations
                  {lastAnalysisTime && ` • Last scan: ${format(lastAnalysisTime, "h:mm a")}`}
                </p>
              </div>
            </div>
            <Button
              onClick={runAIAnalysis}
              disabled={analyzing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-300 mb-4" />
            <p className="text-gray-600 text-lg">All systems normal</p>
            <p className="text-sm text-gray-500 mt-2">
              AI hasn't detected any critical issues. Run analysis to get fresh recommendations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const Icon = getActionIcon(rec.recommendation_type);
            const minutesAgo = differenceInMinutes(new Date(), new Date(rec.created_at));

            return (
              <Card
                key={rec.id}
                className={`border-2 ${getPriorityColor(rec.priority)} transition-all hover:shadow-lg`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      rec.priority === 'critical' ? 'bg-red-600' :
                      rec.priority === 'high' ? 'bg-orange-600' :
                      rec.priority === 'medium' ? 'bg-yellow-600' :
                      'bg-blue-600'
                    }`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={getPriorityBadge(rec.priority)}>
                              {rec.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {rec.recommendation_type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 mb-1">
                            {rec.title}
                          </h3>
                          <p className="text-sm text-gray-700 mb-2">{rec.summary}</p>
                        </div>

                        {/* Confidence */}
                        <div className="flex-shrink-0 text-center">
                          <div className={`text-2xl font-bold ${
                            rec.ai_confidence >= 90 ? 'text-green-600' :
                            rec.ai_confidence >= 75 ? 'text-blue-600' :
                            rec.ai_confidence >= 60 ? 'text-yellow-600' :
                            'text-orange-600'
                          }`}>
                            {rec.ai_confidence}%
                          </div>
                          <p className="text-xs text-gray-600">Confidence</p>
                        </div>
                      </div>

                      {/* Context */}
                      <div className="p-3 bg-white/80 rounded-lg border border-gray-200 mb-3">
                        <p className="text-xs font-semibold text-gray-900 mb-1">Context:</p>
                        <p className="text-sm text-gray-800">{rec.context}</p>
                      </div>

                      {/* Impact & Details */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {rec.estimated_impact && (
                          <div className="p-2 bg-green-100 rounded-lg border border-green-200">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-green-700" />
                              <p className="text-xs font-semibold text-green-900">Impact:</p>
                            </div>
                            <p className="text-xs text-green-800">{rec.estimated_impact}</p>
                          </div>
                        )}
                        
                        {rec.related_tracking_number && (
                          <div className="p-2 bg-blue-100 rounded-lg border border-blue-200">
                            <p className="text-xs font-semibold text-blue-900">Tracking:</p>
                            <p className="text-xs font-mono text-blue-800">{rec.related_tracking_number}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => handleQuickAction(rec)}
                          size="sm"
                          className={`flex-1 ${
                            rec.priority === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                            rec.priority === 'high' ? 'bg-orange-600 hover:bg-orange-700' :
                            'bg-blue-600 hover:bg-blue-700'
                          } text-white font-bold`}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Take Action
                        </Button>
                        <Button
                          onClick={() => handleDismiss(rec)}
                          size="sm"
                          variant="outline"
                          className="border-gray-300"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assistant Info */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Brain className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-blue-900 mb-2">🤖 How the AI Assistant works:</p>
              <ul className="space-y-1 text-blue-800">
                <li>• <strong>Monitors</strong> exceptions, deliveries, routes, drivers, and safety events</li>
                <li>• <strong>Detects patterns</strong> like multiple exceptions from same driver</li>
                <li>• <strong>Prioritizes</strong> recommendations by urgency and impact</li>
                <li>• <strong>Suggests actions</strong> that can be executed immediately</li>
                <li>• <strong>Learns</strong> from which recommendations you find helpful</li>
              </ul>
              <p className="text-xs text-blue-700 mt-3">
                💡 Tip: Run analysis when you start your shift or when operations get busy for the best insights.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
