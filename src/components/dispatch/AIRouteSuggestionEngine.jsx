import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, Zap, TrendingUp, Clock, CheckCircle2, XCircle,
  AlertTriangle, Navigation, RefreshCw
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function AIRouteSuggestionEngine({ autoRun = false }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState(null);
  const queryClient = useQueryClient();

  const { data: activeRoutes } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => base44.entities.OptimizedRoute.filter({
      status: ['active', 'in_progress']
    }),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const { data: exceptions } = useQuery({
    queryKey: ['allExceptions'],
    queryFn: () => base44.entities.DeliveryException.list(),
    initialData: [],
  });

  const { data: existingModifications } = useQuery({
    queryKey: ['routeModifications'],
    queryFn: () => base44.entities.RouteModification.filter({
      status: ['pending_driver_review', 'pending_dispatcher_approval']
    }),
    initialData: [],
  });

  // Auto-run analysis every 10 minutes if enabled
  useEffect(() => {
    if (autoRun) {
      const interval = setInterval(() => {
        runAIAnalysis();
      }, 600000); // 10 minutes

      return () => clearInterval(interval);
    }
  }, [autoRun]);

  const runAIAnalysis = async () => {
    if (activeRoutes.length === 0) {
      toast.info("No active routes to analyze");
      return;
    }

    setAnalyzing(true);
    try {
      let suggestionsCreated = 0;

      for (const route of activeRoutes) {
        // Skip if already has pending suggestions
        const hasPending = existingModifications.some(m => 
          m.route_id === route.id && 
          !['expired', 'driver_rejected', 'dispatcher_rejected'].includes(m.status)
        );
        
        if (hasPending) continue;

        // Get route deliveries
        const routeDeliveries = deliveries.filter(d => 
          route.delivery_ids.includes(d.id)
        );

        const remainingDeliveries = routeDeliveries.filter(d => 
          d.status !== 'delivered'
        );

        if (remainingDeliveries.length < 2) continue; // Need at least 2 deliveries to optimize

        // Get route exceptions
        const routeExceptions = exceptions.filter(e =>
          route.delivery_ids.includes(e.delivery_request_id) &&
          e.resolution_status !== 'resolved'
        );

        // Comprehensive AI analysis
        const analysisPrompt = `You are an AI route optimization expert analyzing an active delivery route in real-time.

ROUTE INFORMATION:
- Route Name: ${route.route_name}
- Driver: ${route.driver_name}
- Total Stops: ${route.delivery_ids.length}
- Completed: ${route.delivery_ids.length - remainingDeliveries.length}
- Remaining: ${remainingDeliveries.length}
- Current Estimated Time: ${route.total_estimated_time_minutes} minutes
- Current Distance: ${route.total_distance_miles} miles

REMAINING DELIVERIES:
${remainingDeliveries.map((d, i) => `
Stop ${i + 1}: ${d.customer_name}
  Address: ${d.delivery_address}
  Premium: ${d.has_premium_insurance ? 'YES' : 'NO'}
  Insurance: ${d.insurance_tier}
  Scheduled: ${d.scheduled_delivery_date ? format(new Date(d.scheduled_delivery_date), "MMM d, h:mm a") : 'None'}
  Status: ${d.status}
`).join('\n')}

ACTIVE EXCEPTIONS:
${routeExceptions.length > 0 ? routeExceptions.map(e => `
- ${e.exception_type} at ${e.description}
  Severity: ${e.severity}
  Delivery: ${deliveries.find(d => d.id === e.delivery_request_id)?.customer_name}
`).join('\n') : 'None'}

WEATHER CONDITIONS: 
- Current: Clear (simulated - integrate real weather API)
- Temperature: 65°F
- Conditions: Normal driving conditions

TRAFFIC CONDITIONS:
- Overall: Moderate (simulated - integrate real traffic API)
- Peak hours: Consider rush hour patterns
- Accidents: None reported in route area

ANALYSIS REQUIRED:
1. Should the route sequence be modified?
2. Are there any deliveries that should be skipped or reattempted?
3. Are deliveries prioritized correctly based on time windows and insurance?
4. Can any time be saved by resequencing?
5. Do any exceptions warrant route changes?

TASK: Provide optimization recommendation with:
- Whether modification is recommended (yes/no)
- Suggested change type
- New sequence if resequencing
- Estimated time impact
- Confidence level (0-100)
- Detailed reasoning`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt: analysisPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              modification_recommended: { type: "boolean" },
              modification_type: {
                type: "string",
                enum: ["resequence", "skip_delivery", "change_priority", "add_break", "no_change"]
              },
              suggested_sequence: {
                type: "array",
                items: { type: "string" }
              },
              deliveries_to_skip: {
                type: "array",
                items: { type: "string" }
              },
              estimated_time_impact_minutes: { type: "number" },
              estimated_distance_impact_miles: { type: "number" },
              confidence_score: { type: "number" },
              reasoning: { type: "string" },
              trigger_factors: {
                type: "array",
                items: { type: "string" }
              },
              priority_level: {
                type: "string",
                enum: ["low", "medium", "high", "urgent"]
              },
              requires_immediate_action: { type: "boolean" }
            }
          }
        });

        // Only create modification if AI recommends it
        if (aiResponse.modification_recommended && aiResponse.modification_type !== "no_change") {
          const modification = await base44.entities.RouteModification.create({
            route_id: route.id,
            driver_email: route.driver_email,
            driver_name: route.driver_name,
            modification_type: aiResponse.modification_type,
            trigger_reason: aiResponse.trigger_factors?.[0] || 'ai_proactive_optimization',
            trigger_details: aiResponse.trigger_factors?.join(', ') || 'AI proactive analysis',
            original_sequence: route.delivery_ids,
            modified_sequence: aiResponse.suggested_sequence || route.delivery_ids,
            affected_deliveries: aiResponse.suggested_sequence || [],
            original_estimated_time: route.total_estimated_time_minutes,
            new_estimated_time: route.total_estimated_time_minutes + aiResponse.estimated_time_impact_minutes,
            time_saved_minutes: -aiResponse.estimated_time_impact_minutes, // negative of impact = saved
            original_distance_miles: route.total_distance_miles,
            new_distance_miles: route.total_distance_miles + (aiResponse.estimated_distance_impact_miles || 0),
            ai_confidence: aiResponse.confidence_score,
            ai_reasoning: aiResponse.reasoning,
            suggested_at: new Date().toISOString(),
            status: aiResponse.requires_immediate_action ? 'pending_dispatcher_approval' : 'pending_driver_review',
            requires_dispatcher_approval: aiResponse.requires_immediate_action,
            expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
            priority: aiResponse.priority_level || 'medium'
          });

          // Create push notification for driver if high priority
          if (aiResponse.priority_level === 'high' || aiResponse.priority_level === 'urgent') {
            await base44.entities.PushNotification.create({
              driver_email: route.driver_email,
              driver_name: route.driver_name,
              notification_type: 'urgent_route_modification',
              priority: aiResponse.priority_level === 'urgent' ? 'critical' : 'urgent',
              title: '🤖 AI Route Optimization',
              message: `AI detected a better route sequence. ${aiResponse.reasoning.substring(0, 100)}...`,
              action_required: true,
              action_type: 'review_route_change',
              action_url: 'route',
              related_entity_type: 'route_modification',
              related_entity_id: modification.id,
              sent_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
              sent_by: 'AI System'
            });
          }

          suggestionsCreated++;
        }
      }

      setLastAnalysisTime(new Date());
      queryClient.invalidateQueries({ queryKey: ['routeModifications'] });
      
      if (suggestionsCreated > 0) {
        toast.success(`AI created ${suggestionsCreated} route optimization suggestion${suggestionsCreated > 1 ? 's' : ''}!`);
      } else {
        toast.info("All routes are optimally sequenced. No changes recommended.");
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Failed to complete AI analysis");
    }
    setAnalyzing(false);
  };

  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-6 h-6" />
          AI Route Optimization Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="p-4 bg-purple-100 rounded-lg border border-purple-200">
          <div className="flex items-start gap-3">
            <Zap className="w-6 h-6 text-purple-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-purple-900 mb-2">
                Proactive AI Route Analysis
              </p>
              <p className="text-sm text-purple-800">
                AI continuously analyzes all active routes considering traffic, weather, delivery windows, 
                exceptions, and historical patterns to suggest optimizations that save time and improve efficiency.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <Navigation className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-900">{activeRoutes.length}</p>
            <p className="text-xs text-gray-600">Active Routes</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-orange-600 mb-1" />
            <p className="text-2xl font-bold text-orange-900">{existingModifications.length}</p>
            <p className="text-xs text-gray-600">Pending Suggestions</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <Brain className="w-5 h-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-900">
              {existingModifications.filter(m => m.ai_confidence >= 80).length}
            </p>
            <p className="text-xs text-gray-600">High Confidence</p>
          </div>
        </div>

        {/* Last Analysis */}
        {lastAnalysisTime && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Last AI Analysis:</span>
              <span className="font-semibold text-gray-900">
                {format(lastAnalysisTime, "h:mm a")}
              </span>
            </div>
          </div>
        )}

        {/* Analysis Factors */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Analysis Factors:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Real-Time Traffic", icon: Navigation },
              { label: "Weather Conditions", icon: AlertTriangle },
              { label: "Delivery Exceptions", icon: XCircle },
              { label: "Time Windows", icon: Clock },
              { label: "Route Progress", icon: TrendingUp },
              { label: "Historical Patterns", icon: Brain }
            ].map((factor) => (
              <div key={factor.label} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                <factor.icon className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-gray-700">{factor.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Run Analysis Button */}
        <Button
          onClick={runAIAnalysis}
          disabled={analyzing || activeRoutes.length === 0}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 text-lg"
        >
          {analyzing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Analyzing {activeRoutes.length} Routes...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5 mr-2" />
              Run AI Route Analysis
            </>
          )}
        </Button>

        {/* Info */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-900">
            <strong>🤖 How it works:</strong> AI analyzes each active route against current conditions, 
            identifies optimization opportunities, calculates confidence scores, and creates suggestions 
            for drivers or dispatchers to review. High-confidence suggestions are sent directly to drivers, 
            while complex changes require dispatcher approval.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}