import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function MessagingPanel({ exception, delivery, driver, onMessageSent }) {
  const [messageType, setMessageType] = useState("exception_message");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [priority, setPriority] = useState("normal");
  const [requiresAck, setRequiresAck] = useState(false);
  const [sending, setSending] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);

  // Load recent messages for this driver/exception
  React.useEffect(() => {
    const loadMessages = async () => {
      if (!driver?.driverEmail) return;
      
      const messages = await base44.entities.DispatchMessage.filter({
        to_driver: driver.driverEmail,
        ...(exception?.id && { exception_id: exception.id })
      });
      
      setRecentMessages(messages.sort((a, b) => 
        new Date(b.sent_at) - new Date(a.sent_at)
      ));
    };
    
    loadMessages();
  }, [driver, exception]);

  const handleSendMessage = async () => {
    if (!messageText || !driver?.driverEmail) {
      toast.error("Please provide message content and select a driver");
      return;
    }

    setSending(true);
    try {
      await base44.entities.DispatchMessage.create({
        message_type: messageType,
        exception_id: exception?.id,
        delivery_request_id: delivery?.id,
        tracking_number: delivery?.tracking_number || exception?.tracking_number,
        from_dispatcher: 'Dispatcher', // In production, use actual dispatcher name
        to_driver: driver.driverEmail,
        driver_name: driver.driverName,
        subject: subject || `${messageType.replace(/_/g, ' ')} - ${delivery?.tracking_number || 'General'}`,
        message_text: messageText,
        priority: priority,
        sent_at: new Date().toISOString(),
        requires_acknowledgment: requiresAck,
        read: false,
        acknowledged: false
      });

      // Send email notification to driver
      await base44.integrations.Core.SendEmail({
        to: driver.driverEmail,
        subject: `📨 Dispatch Message: ${subject || messageType.replace(/_/g, ' ')}`,
        body: `Hello ${driver.driverName},

You have received a ${priority.toUpperCase()} priority message from dispatch:

${messageText}

${exception ? `\nRegarding Exception: ${exception.exception_type.replace(/_/g, ' ')}\nTracking: ${exception.tracking_number}` : ''}

${requiresAck ? '\n⚠️ This message requires your acknowledgment. Please respond in the driver app.' : ''}

Check the driver app for full details and to respond.

- Dispatch Team`,
        from_name: 'USPS Dispatch'
      });

      toast.success("Message sent to driver!");
      setMessageText("");
      setSubject("");
      
      if (onMessageSent) onMessageSent();
      
      // Reload messages
      const messages = await base44.entities.DispatchMessage.filter({
        to_driver: driver.driverEmail,
        ...(exception?.id && { exception_id: exception.id })
      });
      setRecentMessages(messages.sort((a, b) => 
        new Date(b.sent_at) - new Date(a.sent_at)
      ));
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* New Message */}
      <Card className="border-2 border-blue-300">
        <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send Message to Driver
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-900 mb-1">Driver:</p>
            <p className="text-sm text-blue-800">{driver?.driverName} ({driver?.driverEmail})</p>
            {exception && (
              <p className="text-xs text-blue-700 mt-1">
                Re: {exception.exception_type.replace(/_/g, ' ')} - {exception.tracking_number}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="message_type">Message Type</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger id="message_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exception_message">Exception Guidance</SelectItem>
                  <SelectItem value="general_alert">General Alert</SelectItem>
                  <SelectItem value="route_update">Route Update</SelectItem>
                  <SelectItem value="support_request">Support Request</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">🚨 Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Subject (Optional)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief message subject..."
            />
          </div>

          <div>
            <Label htmlFor="message_text">Message *</Label>
            <Textarea
              id="message_text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message to the driver..."
              rows={5}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requires_ack"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="requires_ack" className="text-sm">
              Requires driver acknowledgment
            </label>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={sending || !messageText}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle className="text-gray-900 text-base">Recent Messages</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {recentMessages.slice(0, 10).map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg border-2 ${
                  msg.priority === 'urgent' ? 'border-red-300 bg-red-50' :
                  msg.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={
                      msg.priority === 'urgent' ? 'bg-red-600' :
                      msg.priority === 'high' ? 'bg-orange-600' :
                      'bg-blue-600'
                    }>
                      {msg.priority}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      {format(new Date(msg.sent_at), "MMM d 'at' h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {msg.read && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" title="Read" />
                    )}
                    {msg.requires_acknowledgment && !msg.acknowledged && (
                      <AlertCircle className="w-4 h-4 text-orange-600" title="Awaiting acknowledgment" />
                    )}
                    {msg.acknowledged && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" title="Acknowledged" />
                    )}
                  </div>
                </div>

                {msg.subject && (
                  <p className="text-sm font-bold text-gray-900 mb-1">{msg.subject}</p>
                )}
                
                <p className="text-sm text-gray-700 mb-2">{msg.message_text}</p>

                {msg.driver_response && (
                  <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Driver Response:</p>
                    <p className="text-xs text-blue-800">{msg.driver_response}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(msg.responded_at), "MMM d 'at' h:mm a")}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}