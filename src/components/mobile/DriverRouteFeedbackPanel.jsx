import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, AlertTriangle, ThumbsUp, ThumbsDown,
  Clock, Navigation, Zap
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function DriverRouteFeedbackPanel({ route, driverEmail, driverName }) {
  const [feedbackType, setFeedbackType] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      // Analyze feedback with AI to generate route modification
      const analysisPrompt = `A driver has provided real-time feedback on their active route.

ROUTE: ${route.route_name}
DRIVER: ${driverName}
REMAINING STOPS: ${route.delivery_ids.length}

DRIVER FEEDBACK TYPE: ${feedbackType}
DRIVER FEEDBACK: ${feedbackText}

CURRENT ROUTE DETAILS:
- Distance: ${route.total_distance_miles} miles
- Estimated Time: ${route.total_estimated_time_minutes} minutes
- Current Status: ${route.status}

Based on this driver feedback, should we:
1. Modify the route sequence?
2. Add breaks or rest stops?
3. Skip problematic deliveries?
4. Adjust time estimates?
5. Change priorities?

Provide actionable route modification recommendation if needed.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            modification_recommended: { type: "boolean" },
            modification_type: {
              type: "string",
              enum: ["resequence", "add_break", "skip_delivery", "change_priority", "no_action"]
            },
            suggested_sequence: {
              type: "array",
              items: { type: "string" }
            },
            reasoning: { type: "string" },
            confidence_score: { type: "number" },
            estimated_impact_minutes: { type: "number" },
            requires_dispatcher_approval: { type: "boolean" },
            priority_level: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"]
            }
          }
        }
      });

      // Create route modification if recommended
      if (aiResponse.modification_recommended && aiResponse.modification_type !== "no_action") {
        const modification = await base44.entities.RouteModification.create({
          route_id: route.id,
          driver_email: driverEmail,
          driver_name: driverName,
          modification_type: aiResponse.modification_type,
          trigger_reason: 'driver_feedback',
          trigger_details: `Driver provided feedback: ${feedbackType} - ${feedbackText}`,
          original_sequence: route.delivery_ids,
          modified_sequence: aiResponse.suggested_sequence || route.delivery_ids,
          affected_deliveries: aiResponse.suggested_sequence || route.delivery_ids,
          original_estimated_time: route.total_estimated_time_minutes,
          new_estimated_time: route.total_estimated_time_minutes + (aiResponse.estimated_impact_minutes || 0),
          time_saved_minutes: -(aiResponse.estimated_impact_minutes || 0),
          ai_confidence: aiResponse.confidence_score,
          ai_reasoning: `Driver Feedback Analysis: ${aiResponse.reasoning}`,
          driver_feedback: feedbackText,
          suggested_at: new Date().toISOString(),
          status: aiResponse.requires_dispatcher_approval ? 'pending_dispatcher_approval' : 'driver_accepted',
          requires_dispatcher_approval: aiResponse.requires_dispatcher_approval,
          expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
          priority: aiResponse.priority_level || 'medium',
          driver_response_at: new Date().toISOString()
        });

        if (!aiResponse.requires_dispatcher_approval) {
          // Auto-apply if doesn't need approval
          await base44.entities.OptimizedRoute.update(route.id, {
            delivery_ids: aiResponse.suggested_sequence,
            optimized_sequence: aiResponse.suggested_sequence.map((id, idx) => ({
              delivery_id: id,
              sequence_number: idx + 1
            }))
          });

          await base44.entities.RouteModification.update(modification.id, {
            status: 'automatically_applied',
            applied_at: new Date().toISOString()
          });
        }

        return { modified: true, requiresApproval: aiResponse.requires_dispatcher_approval };
      }

      return { modified: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['activeDriverRoute'] });
      queryClient.invalidateQueries({ queryKey: ['driverDeliveries'] });
      
      if (result.modified) {
        if (result.requiresApproval) {
          toast.success("Feedback sent! Dispatcher will review your route adjustment request.");
        } else {
          toast.success("Route automatically optimized based on your feedback!");
        }
      } else {
        toast.success("Feedback received! No route changes needed at this time.");
      }
      
      setFeedbackType(null);
      setFeedbackText("");
    },
  });

  const handleSubmit = () => {
    if (!feedbackType || !feedbackText.trim()) {
      toast.error("Please select feedback type and provide details");
      return;
    }

    submitFeedbackMutation.mutate();
  };

  const feedbackOptions = [
    { 
      type: "traffic_issue", 
      icon: AlertTriangle, 
      label: "Traffic Problem",
      color: "bg-orange-600",
      description: "Heavy traffic or road closure"
    },
    { 
      type: "sequence_issue", 
      icon: Navigation, 
      label: "Better Route",
      color: "bg-blue-600",
      description: "I see a more efficient sequence"
    },
    { 
      type: "time_constraint", 
      icon: Clock, 
      label: "Time Issue",
      color: "bg-purple-600",
      description: "Running behind or need break"
    },
    { 
      type: "positive", 
      icon: ThumbsUp, 
      label: "Working Great",
      color: "bg-green-600",
      description: "Route is optimal"
    }
  ];

  return (
    <Card className="border-2 border-blue-300 bg-blue-50">
      <CardHeader className="pb-3 bg-blue-100 border-b border-blue-200">
        <CardTitle className="text-base text-blue-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Route Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-blue-800">
          💡 Share your experience with this route. AI will analyze and suggest improvements if needed.
        </p>

        {/* Feedback Type Selection */}
        <div className="grid grid-cols-2 gap-2">
          {feedbackOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                onClick={() => setFeedbackType(option.type)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  feedbackType === option.type
                    ? `${option.color} text-white border-transparent`
                    : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${
                  feedbackType === option.type ? 'text-white' : 'text-gray-600'
                }`} />
                <p className={`text-xs font-semibold ${
                  feedbackType === option.type ? 'text-white' : 'text-gray-900'
                }`}>
                  {option.label}
                </p>
                <p className={`text-xs ${
                  feedbackType === option.type ? 'text-white/90' : 'text-gray-600'
                }`}>
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Feedback Text */}
        {feedbackType && (
          <div>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Describe the issue or suggestion in detail..."
              rows={3}
              className="bg-white"
            />
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!feedbackType || !feedbackText.trim() || submitFeedbackMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
        >
          {submitFeedbackMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              AI Analyzing Feedback...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>

        <p className="text-xs text-blue-700">
          🤖 AI will analyze your feedback and may suggest route adjustments automatically
        </p>
      </CardContent>
    </Card>
  );
}