import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Star, ThumbsUp, MessageSquare, Send, CheckCircle2,
  Clock, MapPin, TrendingUp
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function CustomerFeedbackCollector({ delivery, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [speedRating, setSpeedRating] = useState(0);
  const [commRating, setCommRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [deliveryExperience, setDeliveryExperience] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [routeSuggestion, setRouteSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please provide an overall rating");
      return;
    }

    setSubmitting(true);
    try {
      // Create feedback record
      const feedback = await base44.entities.CustomerFeedback.create({
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        customer_name: delivery.customer_name,
        customer_email: delivery.customer_email,
        feedback_type: rating >= 4 ? 'praise' : rating <= 2 ? 'complaint' : 'delivery_rating',
        rating: rating,
        feedback_text: feedbackText,
        delivery_experience: deliveryExperience,
        driver_professionalism: driverRating,
        delivery_speed: speedRating,
        communication_quality: commRating,
        preferred_delivery_time: preferredTime || 'flexible',
        route_optimization_suggestion: routeSuggestion,
        related_driver_email: delivery.carrier_email,
        submitted_at: new Date().toISOString(),
        ai_analyzed: false
      });

      // AI analysis of feedback
      const analysisPrompt = `Analyze customer feedback for actionable insights.

DELIVERY DETAILS:
- Tracking: ${delivery.tracking_number}
- Driver: ${delivery.carrier_name}
- Address: ${delivery.delivery_address}

CUSTOMER FEEDBACK:
- Overall Rating: ${rating}/5
- Driver Rating: ${driverRating}/5
- Speed Rating: ${speedRating}/5
- Communication Rating: ${commRating}/5
- Experience: ${deliveryExperience}
- Comments: ${feedbackText}
${routeSuggestion ? `- Route Suggestion: ${routeSuggestion}` : ''}
${preferredTime ? `- Preferred Time: ${preferredTime}` : ''}

Provide:
1. Sentiment analysis (very_positive to very_negative)
2. Key themes (what customer cares about most)
3. Actionable insights for operations
4. Whether feedback should influence route optimization
5. Whether human follow-up is needed`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            sentiment: { 
              type: "string", 
              enum: ["very_positive", "positive", "neutral", "negative", "very_negative"] 
            },
            key_themes: {
              type: "array",
              items: { type: "string" }
            },
            actionable_insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  insight: { type: "string" },
                  action_type: { 
                    type: "string",
                    enum: ["route_optimization", "driver_coaching", "communication_improvement", "process_change"]
                  },
                  assigned_to: {
                    type: "string",
                    enum: ["route_ai", "driver_coach", "dispatch", "management"]
                  }
                }
              }
            },
            integrate_into_routing: { type: "boolean" },
            routing_integration_reason: { type: "string" },
            requires_followup: { type: "boolean" },
            followup_priority: {
              type: "string",
              enum: ["low", "medium", "high"]
            }
          }
        }
      });

      // Update feedback with AI analysis
      await base44.entities.CustomerFeedback.update(feedback.id, {
        ai_analyzed: true,
        ai_sentiment: aiAnalysis.sentiment,
        ai_key_themes: aiAnalysis.key_themes,
        actionable_insights: aiAnalysis.actionable_insights,
        integrated_into_routing: aiAnalysis.integrate_into_routing,
        followup_required: aiAnalysis.requires_followup
      });

      // If routing suggestion, create route optimization note
      if (aiAnalysis.integrate_into_routing && routeSuggestion) {
        // This would be picked up by route optimization AI
        console.log("Customer route suggestion flagged for AI integration");
      }

      // If requires followup, notify dispatch
      if (aiAnalysis.requires_followup) {
        await base44.integrations.Core.SendEmail({
          to: 'dispatch@usps.com',
          subject: `Customer Feedback Needs Follow-up: ${delivery.tracking_number}`,
          body: `Priority: ${aiAnalysis.followup_priority}

Customer: ${delivery.customer_name}
Tracking: ${delivery.tracking_number}
Rating: ${rating}/5
Sentiment: ${aiAnalysis.sentiment}

Feedback: ${feedbackText}

${routeSuggestion ? `Route Suggestion: ${routeSuggestion}\n\n` : ''}

AI Insights:
${aiAnalysis.actionable_insights.map(i => `- ${i.insight} (Action: ${i.action_type})`).join('\n')}

Please review and take appropriate action.`,
          from_name: 'Customer Feedback System'
        });
      }

      // Send thank you to customer
      await base44.integrations.Core.SendEmail({
        to: delivery.customer_email,
        subject: 'Thank you for your feedback!',
        body: `Dear ${delivery.customer_name},

Thank you for taking the time to share your feedback about your recent delivery (${delivery.tracking_number}).

${rating >= 4 ? "We're thrilled you had a positive experience! " : rating <= 2 ? "We sincerely apologize that we didn't meet your expectations. " : "We appreciate your honest feedback. "}Your input helps us improve our service every day.

${aiAnalysis.requires_followup ? "Our customer service team will be in touch with you shortly to address your concerns.\n\n" : ""}${routeSuggestion ? "Thank you especially for your route suggestion - we'll analyze it for future deliveries in your area.\n\n" : ""}Best regards,
USPS Customer Experience Team`,
        from_name: 'USPS Customer Service'
      });

      toast.success("Thank you for your feedback!");
      if (onSubmit) onSubmit();

    } catch (error) {
      console.error("Feedback submission error:", error);
      toast.error("Failed to submit feedback");
    }
    setSubmitting(false);
  };

  return (
    <Card className="border-2 border-blue-300">
      <CardHeader className="bg-blue-50 border-b border-blue-200">
        <CardTitle className="text-blue-900">Share Your Delivery Experience</CardTitle>
        <p className="text-sm text-blue-700">
          Your feedback helps us improve! 🎯
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Overall Rating */}
        <div>
          <Label className="text-base font-bold mb-3 block">
            How would you rate your overall experience?
          </Label>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-12 h-12 ${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-600 mt-2">
              {rating === 5 ? '⭐ Excellent!' : 
               rating === 4 ? '👍 Good' : 
               rating === 3 ? '👌 Average' : 
               rating === 2 ? '👎 Below Average' : 
               '😞 Poor'}
            </p>
          )}
        </div>

        {/* Detailed Ratings */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <Label className="text-xs text-gray-700 mb-2 block">Driver</Label>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setDriverRating(star)}
                >
                  <Star
                    className={`w-5 h-5 ${
                      star <= driverRating ? 'fill-blue-400 text-blue-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Label className="text-xs text-gray-700 mb-2 block">Speed</Label>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSpeedRating(star)}
                >
                  <Star
                    className={`w-5 h-5 ${
                      star <= speedRating ? 'fill-green-400 text-green-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Label className="text-xs text-gray-700 mb-2 block">Communication</Label>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setCommRating(star)}
                >
                  <Star
                    className={`w-5 h-5 ${
                      star <= commRating ? 'fill-purple-400 text-purple-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Experience Selection */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            How would you describe your experience?
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'excellent', label: 'Excellent', icon: '⭐' },
              { value: 'good', label: 'Good', icon: '👍' },
              { value: 'average', label: 'Average', icon: '👌' },
              { value: 'poor', label: 'Poor', icon: '👎' }
            ].map((exp) => (
              <button
                key={exp.value}
                onClick={() => setDeliveryExperience(exp.value)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  deliveryExperience === exp.value
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <span className="text-2xl mb-1 block">{exp.icon}</span>
                <span className="text-sm font-semibold">{exp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Delivery Time */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            <Clock className="w-4 h-4 inline mr-1" />
            When do you prefer deliveries? (Helps route planning)
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'morning_8am_12pm', label: 'Morning (8am-12pm)' },
              { value: 'afternoon_12pm_5pm', label: 'Afternoon (12pm-5pm)' },
              { value: 'evening_5pm_8pm', label: 'Evening (5pm-8pm)' },
              { value: 'flexible', label: 'Flexible' }
            ].map((time) => (
              <button
                key={time.value}
                onClick={() => setPreferredTime(time.value)}
                className={`p-2 rounded-lg border-2 text-sm transition-all ${
                  preferredTime === time.value
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div>
          <Label htmlFor="feedback">Additional Comments</Label>
          <Textarea
            id="feedback"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Tell us more about your experience, or share any suggestions..."
            rows={3}
            className="mt-2"
          />
        </div>

        {/* Route Suggestion */}
        <div>
          <Label htmlFor="route_suggestion" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Route Suggestion (Optional)
          </Label>
          <Textarea
            id="route_suggestion"
            value={routeSuggestion}
            onChange={(e) => setRouteSuggestion(e.target.value)}
            placeholder="E.g., 'Deliveries in my neighborhood are usually better in the afternoon' or 'Side entrance is faster than front door'..."
            rows={2}
            className="mt-2"
          />
          <p className="text-xs text-gray-600 mt-1">
            💡 Your local knowledge helps our AI optimize routes for your area
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-6 text-lg"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Analyzing Feedback...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>

        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs text-green-900">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            <strong>Your feedback matters!</strong> We use AI to analyze all feedback and continuously improve our delivery routes, timing, and driver training.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}