import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, Send, Package, Search, Mail, Phone
} from "lucide-react";
import { toast } from "sonner";

export default function CustomerCommunication() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const submitMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      // AI analyze sentiment and urgency
      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this customer message for sentiment, urgency, and key topics. Be empathetic and accurate.

Customer Message:
Subject: ${messageData.subject}
Message: ${messageData.message}

Provide detailed analysis including:
1. Overall sentiment (very_positive, positive, neutral, negative, very_negative, angry, frustrated, confused, appreciative)
2. Sentiment score (-100 to 100)
3. Detected emotions (array of emotions like angry, frustrated, happy, confused, worried, appreciative)
4. Urgency level (low, medium, high, critical)
5. Key topics mentioned
6. Brief summary of what customer wants
7. Suggested professional response
8. Whether this needs immediate attention`,
        response_json_schema: {
          type: "object",
          properties: {
            sentiment: { type: "string" },
            sentiment_score: { type: "number" },
            emotions: { type: "array", items: { type: "string" } },
            urgency_level: { type: "string" },
            key_topics: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            suggested_response: { type: "string" },
            requires_immediate_attention: { type: "boolean" }
          }
        }
      });

      // Find related delivery
      let deliveryId = null;
      if (messageData.tracking_number) {
        const deliveries = await base44.entities.DeliveryRequest.filter({
          tracking_number: messageData.tracking_number
        });
        if (deliveries.length > 0) {
          deliveryId = deliveries[0].id;
        }
      }

      // Create customer message record
      const customerMsg = await base44.entities.CustomerMessage.create({
        ...messageData,
        delivery_request_id: deliveryId,
        sentiment: aiAnalysis.sentiment,
        ai_sentiment_score: aiAnalysis.sentiment_score,
        emotion_detected: aiAnalysis.emotions,
        urgency_level: aiAnalysis.urgency_level,
        key_topics: aiAnalysis.key_topics,
        ai_summary: aiAnalysis.summary,
        suggested_response: aiAnalysis.suggested_response,
        requires_immediate_attention: aiAnalysis.requires_immediate_attention,
        sent_at: new Date().toISOString(),
        status: "new",
        assigned_team: aiAnalysis.urgency_level === "critical" ? "escalation" : "customer_service"
      });

      // Send notification to USPS management
      await base44.integrations.Core.SendEmail({
        to: "management@usps.com",
        subject: `${aiAnalysis.urgency_level === "critical" ? "🚨 URGENT" : "📩"} Customer Message: ${messageData.subject}`,
        body: `New customer message received:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: ${messageData.customer_name}
Email: ${messageData.customer_email}
Phone: ${messageData.customer_phone || 'Not provided'}
Tracking: ${messageData.tracking_number || 'Not provided'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI SENTIMENT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Tone: ${aiAnalysis.sentiment.toUpperCase().replace(/_/g, ' ')}
Sentiment Score: ${aiAnalysis.sentiment_score}/100
Emotions Detected: ${aiAnalysis.emotions.join(', ')}
Urgency: ${aiAnalysis.urgency_level.toUpperCase()}

${aiAnalysis.requires_immediate_attention ? '⚠️ REQUIRES IMMEDIATE ATTENTION' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MESSAGE CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject: ${messageData.subject}

${messageData.message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary: ${aiAnalysis.summary}

Key Topics: ${aiAnalysis.key_topics.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUGGESTED RESPONSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${aiAnalysis.suggested_response}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View and respond in Customer Messages Dashboard`,
        from_name: "USPS Customer Message System"
      });

      // Auto-respond to customer with confirmation
      await base44.integrations.Core.SendEmail({
        to: messageData.customer_email,
        subject: `Re: ${messageData.subject}`,
        body: `Dear ${messageData.customer_name},

Thank you for contacting USPS. We have received your message and our team is reviewing it.

${messageData.tracking_number ? `\nTracking Number: ${messageData.tracking_number}` : ''}

${aiAnalysis.urgency_level === "critical" || aiAnalysis.urgency_level === "high" 
  ? `Due to the urgent nature of your inquiry, a customer service representative will contact you within 2 hours.`
  : `A customer service representative will respond to you within 24 hours.`}

In the meantime, you can track your package status at any time using your tracking number.

Thank you for your patience.

USPS Customer Service`,
        from_name: "USPS Customer Service"
      });

      return customerMsg;
    },
    onSuccess: () => {
      toast.success("Message sent! We'll respond soon.");
      setTrackingNumber("");
      setSubject("");
      setMessage("");
      setSubmitting(false);
    },
    onError: () => {
      toast.error("Failed to send message");
      setSubmitting(false);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerName || !customerEmail || !subject || !message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    submitMessageMutation.mutate({
      tracking_number: trackingNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      subject: subject,
      message: message,
      message_type: "inquiry"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <MessageSquare className="w-10 h-10 text-blue-600" />
            Contact USPS
          </h1>
          <p className="text-gray-600">Send a message to your local carrier or management</p>
        </div>

        {/* Contact Form */}
        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b-2 border-blue-200">
            <CardTitle className="text-blue-900">Send Us a Message</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Your Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Your Phone (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="tracking">Tracking Number (Optional)</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="tracking"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="9400111111111111111111"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is your message about?"
                  required
                />
              </div>

              <div>
                <Label htmlFor="message">Your Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your question, concern, or feedback..."
                  rows={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Please be as detailed as possible so we can help you better
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <h3 className="font-bold text-green-900 mb-2">✅ What We Can Help With</h3>
              <ul className="space-y-1 text-sm text-green-800">
                <li>• Track your package</li>
                <li>• Update delivery preferences</li>
                <li>• Report delivery issues</li>
                <li>• Reschedule deliveries</li>
                <li>• Update address information</li>
                <li>• File claims or complaints</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <h3 className="font-bold text-blue-900 mb-2">⏱️ Response Times</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• <strong>Urgent issues:</strong> Within 2 hours</li>
                <li>• <strong>General inquiries:</strong> Within 24 hours</li>
                <li>• <strong>Feedback:</strong> Within 48 hours</li>
                <li>• We monitor messages 7 days a week</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}