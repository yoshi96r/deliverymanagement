
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Send, Users, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

export default function BroadcastManager() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState("company_announcement");
  const [priority, setPriority] = useState("normal");
  const [targetAudience, setTargetAudience] = useState("all_drivers");
  const [requiresAck, setRequiresAck] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: broadcasts } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => base44.entities.BroadcastMessage.list('-sent_at', 20),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const handleSendBroadcast = async () => {
    if (!title || !content) {
      toast.error("Please provide title and message content");
      return;
    }

    setSending(true);
    try {
      // Get all unique active driver emails
      const driverEmails = [...new Set(
        deliveries
          .filter(d => d.carrier_email && d.status !== 'delivered')
          .map(d => d.carrier_email)
      )];

      const broadcast = await base44.entities.BroadcastMessage.create({
        message_title: title,
        message_content: content,
        message_type: messageType,
        priority: priority,
        sent_by: 'Dispatcher',
        sent_by_email: 'dispatch@usps.com',
        sent_at: new Date().toISOString(),
        target_audience: targetAudience,
        requires_acknowledgment: requiresAck,
        total_recipients: driverEmails.length,
        read_count: 0,
        acknowledged_count: 0
      });

      // Create push notifications for urgent/critical broadcasts
      if (priority === 'urgent' || priority === 'high') {
        const pushNotificationPromises = driverEmails.map(async (email) => {
          // Find a delivery associated with this driver email to get carrier_name
          const driver = deliveries.find(d => d.carrier_email === email);
          await base44.entities.PushNotification.create({
            driver_email: email,
            driver_name: driver?.carrier_name || 'Driver', // Fallback name if not found
            notification_type: 'dispatcher_urgent_message',
            priority: priority === 'urgent' ? 'critical' : 'urgent', // Map broadcast priority to push notification priority
            title: title,
            message: content.substring(0, 200) + (content.length > 200 ? '...' : ''), // Truncate message
            action_required: requiresAck,
            action_type: 'acknowledge',
            action_url: 'inbox', // Assuming an inbox route in the driver app
            related_entity_type: 'broadcast_message',
            related_entity_id: broadcast.id,
            sent_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 48 * 60 * 60000).toISOString(), // 48 hours expiry
            sent_by: 'Dispatcher'
          });
        });
        await Promise.all(pushNotificationPromises);
      }

      // Send email notification to all drivers
      const emailPromises = driverEmails.map(email => 
        base44.integrations.Core.SendEmail({
          to: email,
          subject: `📢 ${priority === 'urgent' ? 'URGENT: ' : ''}${title}`,
          body: `${priority === 'urgent' ? '🚨 URGENT MESSAGE 🚨\n\n' : ''}${content}\n\n${requiresAck ? '\n⚠️ This message requires your acknowledgment in the Driver Mobile app.' : ''}\n\nMessage Type: ${messageType.replace(/_/g, ' ')}\nSent: ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}\n\n- USPS Dispatch Team`,
          from_name: 'USPS Broadcast System'
        })
      );

      await Promise.all(emailPromises);

      toast.success(`Broadcast sent to ${driverEmails.length} drivers!`);
      
      // Reset form
      setTitle("");
      setContent("");
      setMessageType("company_announcement");
      setPriority("normal");
      setRequiresAck(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send broadcast");
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Send Broadcast Form */}
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-6 h-6" />
            Send Broadcast Message
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="title">Message Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief, clear title..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="messageType">Message Type</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger id="messageType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company_announcement">📢 Company Announcement</SelectItem>
                  <SelectItem value="safety_alert">⚠️ Safety Alert</SelectItem>
                  <SelectItem value="policy_update">📋 Policy Update</SelectItem>
                  <SelectItem value="weather_alert">🌦️ Weather Alert</SelectItem>
                  <SelectItem value="system_update">💻 System Update</SelectItem>
                  <SelectItem value="recognition">⭐ Recognition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" className="mt-1">
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
            <Label htmlFor="content">Message Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message to all drivers..."
              rows={6}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="checkbox"
              id="requiresAck"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="requiresAck" className="text-sm font-semibold text-blue-900">
              Require driver acknowledgment
            </label>
          </div>

          <Button
            onClick={handleSendBroadcast}
            disabled={sending || !title || !content}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 text-lg"
          >
            <Send className="w-5 h-5 mr-2" />
            {sending ? "Sending Broadcast..." : "Send to All Drivers"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Broadcasts */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Recent Broadcasts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {broadcasts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No broadcasts sent yet</p>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((broadcast) => (
                <Card key={broadcast.id} className={`border-2 ${
                  broadcast.priority === 'urgent' ? 'border-red-300 bg-red-50' :
                  broadcast.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            broadcast.priority === 'urgent' ? 'bg-red-600' :
                            broadcast.priority === 'high' ? 'bg-orange-600' :
                            'bg-blue-600'
                          }>
                            {broadcast.priority}
                          </Badge>
                          <Badge variant="outline">
                            {broadcast.message_type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {format(new Date(broadcast.sent_at), "MMM d 'at' h:mm a")}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900">{broadcast.message_title}</h4>
                        <p className="text-sm text-gray-700 mt-1">{broadcast.message_content}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm mt-3 pt-3 border-t">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-600">{broadcast.total_recipients} recipients</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4 text-green-600" />
                        <span className="text-gray-600">{broadcast.read_count} read</span>
                      </div>
                      {broadcast.requires_acknowledgment && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          <span className="text-gray-600">{broadcast.acknowledged_count} acknowledged</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
