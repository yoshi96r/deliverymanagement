import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, Send, Bot, User, Package, Clock, MapPin, AlertTriangle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AICustomerChatAssistant({ trackingNumber, customerEmail }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I'm your AI delivery assistant. I can help you track your package, answer questions about delivery times, and assist with any concerns.

What would you like to know about your delivery?`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Get delivery data
      const deliveries = await base44.entities.DeliveryRequest.filter({
        tracking_number: trackingNumber
      });

      const delivery = deliveries[0];
      
      if (!delivery) {
        const errorMsg = {
          role: 'assistant',
          content: "I couldn't find that tracking number in our system. Please verify the number and try again.",
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMsg]);
        setLoading(false);
        return;
      }

      // Get route info if available
      let routeInfo = null;
      if (delivery.status === 'out_for_delivery') {
        const routes = await base44.entities.OptimizedRoute.filter({
          delivery_ids: delivery.id,
          status: ['active', 'in_progress']
        });

        if (routes.length > 0) {
          const route = routes[0];
          const allRouteDeliveries = await base44.entities.DeliveryRequest.filter({
            id: { $in: route.delivery_ids }
          });
          const completed = allRouteDeliveries.filter(d => d.status === 'delivered').length;
          const position = route.delivery_ids.indexOf(delivery.id);
          const stopsAway = position - completed;

          routeInfo = {
            stops_away: stopsAway,
            estimated_minutes: stopsAway * 8,
            driver_name: delivery.carrier_name,
            total_stops: route.delivery_ids.length
          };
        }
      }

      // Get exception info if any
      let exceptionInfo = null;
      if (delivery.has_active_exception) {
        const exceptions = await base44.entities.DeliveryException.filter({
          delivery_request_id: delivery.id,
          resolution_status: ['pending', 'reattempt_scheduled', 'escalated']
        });
        exceptionInfo = exceptions[0];
      }

      // Prepare conversation context
      const conversationHistory = messages.map(m => 
        `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`
      ).join('\n');

      // AI response generation
      const aiPrompt = `You are a friendly, helpful USPS customer service AI assistant. Answer the customer's question based on the delivery information.

CUSTOMER QUESTION:
${input}

PREVIOUS CONVERSATION:
${conversationHistory}

DELIVERY INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tracking: ${delivery.tracking_number}
Customer: ${delivery.customer_name}
Address: ${delivery.delivery_address}
Current Status: ${delivery.status.replace(/_/g, ' ')}
${delivery.scheduled_delivery_date ? `Scheduled: ${format(new Date(delivery.scheduled_delivery_date), "EEEE, MMMM d 'at' h:mm a")}` : ''}
${delivery.carrier_name ? `Driver: ${delivery.carrier_name}` : ''}

${routeInfo ? `
REAL-TIME ROUTE INFO:
- Driver is ${routeInfo.stops_away} stops away
- Estimated arrival: ${routeInfo.estimated_minutes} minutes
- Route progress: Stop ${routeInfo.total_stops - routeInfo.stops_away + 1} of ${routeInfo.total_stops}
` : ''}

${exceptionInfo ? `
EXCEPTION INFORMATION:
- Issue: ${exceptionInfo.exception_type.replace(/_/g, ' ')}
- Description: ${exceptionInfo.description}
- Status: ${exceptionInfo.resolution_status.replace(/_/g, ' ')}
${exceptionInfo.reattempt_date ? `- Reattempt: ${format(new Date(exceptionInfo.reattempt_date), "EEEE, MMMM d")}` : ''}
` : ''}

${delivery.delivered ? `
DELIVERY COMPLETED:
- Delivered: ${format(new Date(delivery.delivery_timestamp), "MMMM d, yyyy 'at' h:mm a")}
- Proof available: ${delivery.delivery_proof_photo_url ? 'Yes (photo)' : 'No'}
` : ''}

RESPONSE GUIDELINES:
1. Be warm, friendly, and professional
2. Provide specific information from delivery data
3. If asking about delivery time and driver is en route, give the specific ETA
4. If there's an exception, explain clearly and provide next steps
5. Offer to escalate to human if needed for complex issues
6. Keep responses concise but complete
7. Use emojis sparingly and professionally
8. If customer seems frustrated, be extra empathetic

IMPORTANT:
- Don't make up information not in the data
- If you don't know something, say so and offer to connect with human agent
- For complaints or complex issues, suggest speaking with customer service
- Always end with asking if there's anything else you can help with`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            response: { type: "string" },
            sentiment_detected: { 
              type: "string", 
              enum: ["happy", "neutral", "concerned", "frustrated", "angry"] 
            },
            requires_human_followup: { type: "boolean" },
            suggested_action: { type: "string" },
            confidence: { type: "number" }
          }
        }
      });

      const assistantMessage = {
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date().toISOString(),
        confidence: aiResponse.confidence,
        requires_followup: aiResponse.requires_human_followup
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Log communication
      await base44.entities.CustomerCommunication.create({
        delivery_request_id: delivery.id,
        tracking_number: trackingNumber,
        customer_name: delivery.customer_name,
        customer_email: customerEmail,
        communication_type: 'automated_chat',
        message_category: 'inquiry_response',
        trigger_event: 'customer_inquiry_received',
        message_subject: 'AI Chat Response',
        message_body: `Customer: ${input}\n\nAI Response: ${aiResponse.response}`,
        ai_generated: true,
        ai_confidence: aiResponse.confidence,
        sent_at: new Date().toISOString(),
        delivered: true,
        sentiment: aiResponse.sentiment_detected === 'happy' || aiResponse.sentiment_detected === 'neutral' ? 'positive' : 
                   aiResponse.sentiment_detected === 'frustrated' || aiResponse.sentiment_detected === 'angry' ? 'negative' : 'neutral',
        requires_followup: aiResponse.requires_human_followup,
        customer_replied: true,
        customer_reply: input
      });

      // If requires human followup, create alert
      if (aiResponse.requires_human_followup) {
        toast.warning("This conversation may need human assistance");
      }

    } catch (error) {
      console.error("AI chat error:", error);
      const errorMsg = {
        role: 'assistant',
        content: "I apologize, but I'm having trouble processing your request right now. Please contact customer service at 1-800-ASK-USPS for immediate assistance.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setLoading(false);
  };

  return (
    <Card className="border-2 border-blue-300">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-6 h-6" />
          AI Delivery Assistant
        </CardTitle>
        <p className="text-xs text-blue-100">
          Ask me anything about your delivery • Powered by AI
        </p>
      </CardHeader>

      <ScrollArea className="h-96 p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`rounded-2xl px-4 py-2 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1 px-2">
                  {format(new Date(msg.timestamp), 'h:mm a')}
                  {msg.confidence && msg.role === 'assistant' && (
                    <span className="ml-2">• {msg.confidence}% confident</span>
                  )}
                </p>
                {msg.requires_followup && (
                  <Badge className="bg-orange-600 text-white text-xs mt-1">
                    May need human assistance
                  </Badge>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your delivery..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Try asking: "When will my package arrive?" or "Why is my delivery delayed?"
        </p>
      </div>
    </Card>
  );
}