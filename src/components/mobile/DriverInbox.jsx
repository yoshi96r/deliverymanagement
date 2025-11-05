import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Megaphone, CheckCircle2, AlertCircle, Send,
  Clock, Eye
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const QUICK_RESPONSES = [
  { id: 1, text: "✅ Acknowledged and understood", category: "acknowledgment" },
  { id: 2, text: "🚗 On my way to location now", category: "status" },
  { id: 3, text: "📞 Attempting customer contact", category: "status" },
  { id: 4, text: "❓ Need clarification on instructions", category: "question" },
  { id: 5, text: "⚠️ Encountering issues - need support", category: "help" },
  { id: 6, text: "✅ Task completed successfully", category: "completion" },
  { id: 7, text: "📦 Package secured, proceeding with delivery", category: "status" },
  { id: 8, text: "🔄 Will reattempt as instructed", category: "action" }
];

export default function DriverInbox({ driverEmail, driverName }) {
  const [messages, setMessages] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("direct");

  useEffect(() => {
    loadMessages();
    // Refresh every 30 seconds
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [driverEmail]);

  const loadMessages = async () => {
    try {
      // Load direct messages
      const directMessages = await base44.entities.DispatchMessage.filter({
        to_driver: driverEmail
      });
      setMessages(directMessages.sort((a, b) => 
        new Date(b.sent_at) - new Date(a.sent_at)
      ));

      // Load broadcast messages
      const allBroadcasts = await base44.entities.BroadcastMessage.list('-sent_at', 50);
      setBroadcasts(allBroadcasts.filter(b => 
        b.target_audience === 'all_drivers' || 
        b.specific_driver_emails?.includes(driverEmail)
      ));

      setLoading(false);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const handleReadMessage = async (message, type = 'direct') => {
    setSelectedMessage({ ...message, type });

    if (type === 'direct' && !message.read) {
      // Mark as read
      await base44.entities.DispatchMessage.update(message.id, {
        read: true,
        read_at: new Date().toISOString()
      });

      // Create read receipt
      await base44.entities.MessageReadReceipt.create({
        message_id: message.id,
        message_type: 'dispatch_message',
        driver_email: driverEmail,
        driver_name: driverName,
        read_at: new Date().toISOString()
      });

      loadMessages();
    } else if (type === 'broadcast') {
      // Check if already read
      const existingReceipts = await base44.entities.MessageReadReceipt.filter({
        message_id: message.id,
        driver_email: driverEmail
      });

      if (existingReceipts.length === 0) {
        // Create read receipt
        await base44.entities.MessageReadReceipt.create({
          message_id: message.id,
          message_type: 'broadcast_message',
          driver_email: driverEmail,
          driver_name: driverName,
          read_at: new Date().toISOString()
        });

        // Update broadcast read count
        await base44.entities.BroadcastMessage.update(message.id, {
          read_count: (message.read_count || 0) + 1
        });

        loadMessages();
      }
    }
  };

  const handleQuickResponse = async (quickResponse) => {
    if (!selectedMessage || selectedMessage.type !== 'direct') return;

    await sendResponse(quickResponse.text);
  };

  const handleSendResponse = async () => {
    if (!responseText.trim()) {
      toast.error("Please type a response");
      return;
    }

    await sendResponse(responseText);
  };

  const sendResponse = async (text) => {
    try {
      await base44.entities.DispatchMessage.update(selectedMessage.id, {
        driver_response: text,
        responded_at: new Date().toISOString()
      });

      toast.success("Response sent!");
      setResponseText("");
      loadMessages();
    } catch (error) {
      console.error(error);
      toast.error("Failed to send response");
    }
  };

  const handleAcknowledge = async (message) => {
    try {
      if (message.type === 'direct') {
        await base44.entities.DispatchMessage.update(message.id, {
          acknowledged: true,
          driver_response: "Acknowledged",
          responded_at: new Date().toISOString()
        });
      } else if (message.type === 'broadcast') {
        const receipts = await base44.entities.MessageReadReceipt.filter({
          message_id: message.id,
          driver_email: driverEmail
        });

        if (receipts.length > 0) {
          await base44.entities.MessageReadReceipt.update(receipts[0].id, {
            acknowledged_at: new Date().toISOString(),
            response_text: "Acknowledged"
          });
        }

        await base44.entities.BroadcastMessage.update(message.id, {
          acknowledged_count: (message.acknowledged_count || 0) + 1
        });
      }

      toast.success("Message acknowledged!");
      loadMessages();
      setSelectedMessage(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to acknowledge");
    }
  };

  const unreadDirectCount = messages.filter(m => !m.read).length;
  const unreadBroadcastCount = broadcasts.filter(b => {
    // This is simplified - in production you'd check MessageReadReceipt
    return !b.read_count || b.read_count < b.total_recipients;
  }).length;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-white shadow-md">
          <TabsTrigger value="direct" className="relative">
            <MessageSquare className="w-4 h-4 mr-2" />
            Direct Messages
            {unreadDirectCount > 0 && (
              <Badge className="ml-2 bg-red-600 text-white">{unreadDirectCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="relative">
            <Megaphone className="w-4 h-4 mr-2" />
            Announcements
            {unreadBroadcastCount > 0 && (
              <Badge className="ml-2 bg-purple-600 text-white">{unreadBroadcastCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Direct Messages Tab */}
        <TabsContent value="direct" className="mt-4 space-y-3">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No messages yet</p>
              </CardContent>
            </Card>
          ) : (
            messages.map((message) => (
              <Card
                key={message.id}
                className={`border-2 cursor-pointer ${
                  !message.read ? 'border-blue-300 bg-blue-50 shadow-md' : 'border-gray-200'
                } ${selectedMessage?.id === message.id ? 'ring-2 ring-blue-400' : ''}`}
                onClick={() => handleReadMessage(message, 'direct')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        message.priority === 'urgent' ? 'bg-red-600' :
                        message.priority === 'high' ? 'bg-orange-600' :
                        'bg-blue-600'
                      }>
                        {message.priority}
                      </Badge>
                      {!message.read && (
                        <Badge className="bg-blue-600 text-white">New</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">
                      {format(new Date(message.sent_at), "MMM d 'at' h:mm a")}
                    </span>
                  </div>

                  {message.subject && (
                    <p className="font-bold text-gray-900 mb-1">{message.subject}</p>
                  )}
                  
                  <p className="text-sm text-gray-700 line-clamp-2">{message.message_text}</p>

                  <div className="flex items-center gap-2 mt-2">
                    {message.read && (
                      <Badge variant="outline" className="text-xs">
                        <Eye className="w-3 h-3 mr-1" />
                        Read
                      </Badge>
                    )}
                    {message.requires_acknowledgment && !message.acknowledged && (
                      <Badge className="bg-orange-500 text-white text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Ack Required
                      </Badge>
                    )}
                    {message.acknowledged && (
                      <Badge className="bg-green-600 text-white text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Acknowledged
                      </Badge>
                    )}
                  </div>

                  {message.driver_response && (
                    <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                      <p className="text-xs font-semibold text-green-900">Your Response:</p>
                      <p className="text-sm text-green-800">{message.driver_response}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Broadcasts Tab */}
        <TabsContent value="broadcasts" className="mt-4 space-y-3">
          {broadcasts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Megaphone className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No announcements</p>
              </CardContent>
            </Card>
          ) : (
            broadcasts.map((broadcast) => (
              <Card
                key={broadcast.id}
                className={`border-2 cursor-pointer ${
                  broadcast.priority === 'urgent' ? 'border-red-300 bg-red-50' :
                  broadcast.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                  'border-purple-200 bg-purple-50'
                } ${selectedMessage?.id === broadcast.id ? 'ring-2 ring-purple-400' : ''}`}
                onClick={() => handleReadMessage(broadcast, 'broadcast')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        broadcast.priority === 'urgent' ? 'bg-red-600' :
                        broadcast.priority === 'high' ? 'bg-orange-600' :
                        'bg-purple-600'
                      }>
                        {broadcast.priority}
                      </Badge>
                      <Badge variant="outline">
                        {broadcast.message_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-600">
                      {format(new Date(broadcast.sent_at), "MMM d 'at' h:mm a")}
                    </span>
                  </div>

                  <h4 className="font-bold text-gray-900 mb-2">{broadcast.message_title}</h4>
                  <p className="text-sm text-gray-700 line-clamp-3">{broadcast.message_content}</p>

                  {broadcast.requires_acknowledgment && (
                    <Badge className="bg-orange-500 text-white text-xs mt-2">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Acknowledgment Required
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Message Detail View */}
      {selectedMessage && (
        <Card className="border-2 border-blue-300 bg-white">
          <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
            <CardTitle className="text-blue-900 text-base">
              {selectedMessage.type === 'direct' ? 'Message Details' : 'Announcement Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              {selectedMessage.subject && (
                <p className="font-bold text-gray-900 mb-2">{selectedMessage.subject}</p>
              )}
              {selectedMessage.message_title && (
                <p className="font-bold text-gray-900 mb-2">{selectedMessage.message_title}</p>
              )}
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {selectedMessage.message_text || selectedMessage.message_content}
              </p>
            </div>

            {selectedMessage.type === 'direct' && !selectedMessage.driver_response && (
              <>
                {/* Quick Responses */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Quick Responses:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_RESPONSES.slice(0, 4).map((qr) => (
                      <Button
                        key={qr.id}
                        onClick={() => handleQuickResponse(qr)}
                        variant="outline"
                        className="text-xs h-auto py-2 px-3 text-left whitespace-normal"
                      >
                        {qr.text}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom Response */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Or type your response:</p>
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Type your message to dispatch..."
                    rows={3}
                  />
                  <Button
                    onClick={handleSendResponse}
                    disabled={!responseText.trim()}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Response
                  </Button>
                </div>
              </>
            )}

            {/* Acknowledge Button */}
            {((selectedMessage.type === 'direct' && selectedMessage.requires_acknowledgment && !selectedMessage.acknowledged) ||
              (selectedMessage.type === 'broadcast' && selectedMessage.requires_acknowledgment)) && (
              <Button
                onClick={() => handleAcknowledge(selectedMessage)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Acknowledge Receipt
              </Button>
            )}

            <Button
              onClick={() => setSelectedMessage(null)}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}