
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Send, MessageSquare, Users, CheckCheck, Check, Circle, ArrowLeft,
  Paperclip, MapPin, Image as ImageIcon, FileText, XCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function RealTimeChatDriver({ driverEmail, driverName }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const fileInputRef = useRef(null);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Location error:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    loadConversations();
    
    // Poll for updates every 2 seconds
    const interval = setInterval(() => {
      loadConversations();
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
        loadTypingIndicators(selectedConversation.id);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [driverEmail, selectedConversation]); // Added selectedConversation as dependency

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      loadTypingIndicators(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async () => {
    try {
      const allConversations = await base44.entities.ChatConversation.filter({
        is_active: true
      });

      const driverConversations = allConversations.filter(conv =>
        conv.participants?.some(p => p.email === driverEmail)
      ).sort((a, b) => 
        new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
      );

      setConversations(driverConversations);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const msgs = await base44.entities.ChatMessage.filter({
        conversation_id: conversationId
      });

      setMessages(msgs.sort((a, b) => 
        new Date(a.sent_at) - new Date(b.sent_at)
      ));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const loadTypingIndicators = async (conversationId) => {
    try {
      const indicators = await base44.entities.ChatTypingIndicator.filter({
        conversation_id: conversationId
      });

      const now = new Date();
      const activeIndicators = indicators.filter(ind => 
        new Date(ind.expires_at) > now && ind.user_email !== driverEmail
      );

      setTypingUsers(activeIndicators);
    } catch (error) {
      console.error("Failed to load typing indicators:", error);
    }
  };

  const markMessagesAsRead = async (conversationId) => {
    try {
      const unreadMessages = messages.filter(msg => 
        msg.sender_email !== driverEmail &&
        !msg.read_by?.some(r => r.email === driverEmail)
      );

      // Only mark if there are unread messages from others in the current view
      if (unreadMessages.length > 0) {
        // Create a new array of messages to mark as read, to avoid modifying state directly
        const updatedMessages = unreadMessages.map(msg => {
          const readBy = msg.read_by ? [...msg.read_by] : [];
          if (!readBy.some(r => r.email === driverEmail)) {
            readBy.push({
              email: driverEmail,
              read_at: new Date().toISOString()
            });
          }
          return { ...msg, read_by: readBy };
        });
  
        // Batch update to avoid multiple API calls
        await Promise.all(updatedMessages.map(msg => 
          base44.entities.ChatMessage.update(msg.id, {
            read_by: msg.read_by
          })
        ));
        
        // After successful update, refresh messages to reflect changes
        loadMessages(conversationId);
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  };

  const handleTyping = async () => {
    if (!selectedConversation) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const existingIndicators = await base44.entities.ChatTypingIndicator.filter({
      conversation_id: selectedConversation.id,
      user_email: driverEmail
    });

    const expiresAt = new Date(Date.now() + 10000).toISOString();

    if (existingIndicators.length > 0) {
      await base44.entities.ChatTypingIndicator.update(existingIndicators[0].id, {
        started_typing_at: new Date().toISOString(),
        expires_at: expiresAt
      });
    } else {
      await base44.entities.ChatTypingIndicator.create({
        conversation_id: selectedConversation.id,
        user_email: driverEmail,
        user_name: driverName,
        started_typing_at: new Date().toISOString(),
        expires_at: expiresAt
      });
    }

    typingTimeoutRef.current = setTimeout(async () => {
      const indicators = await base44.entities.ChatTypingIndicator.filter({
        conversation_id: selectedConversation.id,
        user_email: driverEmail
      });

      for (const indicator of indicators) {
        await base44.entities.ChatTypingIndicator.update(indicator.id, {
          expires_at: new Date().toISOString()
        });
      }
    }, 3000);
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !attachmentFile) || !selectedConversation) return;

    try {
      let attachmentUrl = null;
      let attachmentType = null;
      let messageType = "text";
      let messageContent = messageText.trim();

      // Upload file if present
      if (attachmentFile) {
        setUploading(true);
        const uploadResult = await base44.integrations.Core.UploadFile({
          file: attachmentFile,
          folder_name: "chat_attachments" // Optional: specify a folder
        });
        attachmentUrl = uploadResult.file_url;
        
        if (attachmentFile.type.startsWith('image/')) {
          attachmentType = 'image';
        } else if (attachmentFile.type.startsWith('video/')) {
          attachmentType = 'video';
        } else {
          attachmentType = 'document';
        }
        messageType = "file_attachment";
        messageContent = messageContent || `Sent ${attachmentType}`;
      }

      await base44.entities.ChatMessage.create({
        conversation_id: selectedConversation.id,
        sender_email: driverEmail,
        sender_name: driverName,
        sender_role: "driver",
        message_text: messageContent,
        message_type: messageType,
        sent_at: new Date().toISOString(),
        read_by: [{
          email: driverEmail,
          read_at: new Date().toISOString()
        }],
        delivered_to: [driverEmail],
        attachment_url: attachmentUrl,
        attachment_type: attachmentType
      });

      await base44.entities.ChatConversation.update(selectedConversation.id, {
        last_message_at: new Date().toISOString(),
        last_message_text: messageContent.substring(0, 100),
        last_message_sender: driverName,
        total_messages: (selectedConversation.total_messages || 0) + 1
      });

      const indicators = await base44.entities.ChatTypingIndicator.filter({
        conversation_id: selectedConversation.id,
        user_email: driverEmail
      });

      for (const indicator of indicators) {
        await base44.entities.ChatTypingIndicator.update(indicator.id, {
          expires_at: new Date().toISOString()
        });
      }

      setMessageText("");
      setAttachmentFile(null);
      setUploading(false);
      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      setUploading(false);
    }
  };

  const handleShareLocation = async () => {
    if (!selectedConversation || !currentLocation) {
      toast.error("Location not available or no conversation selected.");
      return;
    }

    try {
      // Find pending location request if any
      const requests = await base44.entities.LocationShareRequest.filter({
        conversation_id: selectedConversation.id,
        driver_email: driverEmail,
        status: "pending"
      });

      // Update request status if exists
      if (requests.length > 0) {
        await base44.entities.LocationShareRequest.update(requests[0].id, {
          status: "shared",
          shared_at: new Date().toISOString(),
          location_data: {
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            accuracy: 10 // Placeholder accuracy
          }
        });
      }

      // Send location message
      await base44.entities.ChatMessage.create({
        conversation_id: selectedConversation.id,
        sender_email: driverEmail,
        sender_name: driverName,
        sender_role: "driver",
        message_text: "📍 Shared my current location",
        message_type: "location_share",
        sent_at: new Date().toISOString(),
        read_by: [{
          email: driverEmail,
          read_at: new Date().toISOString()
        }],
        delivered_to: [driverEmail],
        location_data: {
          lat: currentLocation.lat,
          lng: currentLocation.lng
        }
      });

      await base44.entities.ChatConversation.update(selectedConversation.id, {
        last_message_at: new Date().toISOString(),
        last_message_text: "📍 Shared location",
        last_message_sender: driverName,
        total_messages: (selectedConversation.total_messages || 0) + 1
      });

      loadMessages(selectedConversation.id);
      loadConversations();
      toast.success("Location shared!");
    } catch (error) {
      console.error("Failed to share location:", error);
      toast.error("Failed to share location");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachmentFile(file);
      e.target.value = null; // Clear input so same file can be selected again
      toast.success(`File selected: ${file.name}`);
    }
  };

  const getUnreadCount = (conversation) => {
    // This function is still simplified and returns 0 as per original
    // To implement fully, one would need to filter messages for this conversation
    // and count those not read by driverEmail.
    return 0;
  };

  const getMessageStatus = (message) => {
    if (message.sender_email !== driverEmail) return null;

    // Filter out the current driver from the participants list
    const otherParticipants = selectedConversation?.participants?.filter(
      p => p.email !== driverEmail && p.email !== 'system'
    ) || [];
    
    // Count reads by other participants
    const readCount = message.read_by?.filter(
      r => otherParticipants.some(p => p.email === r.email)
    ).length || 0;

    // Check for "delivered" status (if other participants received it)
    const deliveredCount = message.delivered_to?.filter(
      d => otherParticipants.some(p => p.email === d)
    ).length || 0;

    if (readCount === otherParticipants.length && otherParticipants.length > 0) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />; // All read
    } else if (readCount > 0) {
      return <CheckCheck className="w-3 h-3 text-gray-400" />; // Some read
    } else if (deliveredCount === otherParticipants.length && otherParticipants.length > 0) {
      return <Check className="w-3 h-3 text-gray-400" />; // All delivered, none read
    } else {
      return <Check className="w-3 h-3 text-gray-400" />; // Sent, not necessarily delivered/read by others
    }
  };


  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedConversation ? (
        <Card className="border-2 border-blue-300">
          <CardHeader className="bg-blue-50 border-b-2 border-blue-200 p-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setSelectedConversation(null)}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-base">
                  {selectedConversation.conversation_type === 'group'
                    ? selectedConversation.conversation_name
                    : 'Dispatch'}
                </CardTitle>
                {selectedConversation.conversation_type === 'group' && (
                  <p className="text-xs text-gray-600">
                    {selectedConversation.participants?.filter(p => p.email !== 'system').length} participants
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => {
                const isOwnMessage = msg.sender_email === driverEmail;
                const showSender = idx === 0 || messages[idx - 1].sender_email !== msg.sender_email || (new Date(msg.sent_at).getTime() - new Date(messages[idx - 1].sent_at).getTime() > 300000); // Show sender if previous message was from different sender or if 5 minutes passed
                const isSystemMessage = msg.sender_role === "system";

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      isSystemMessage ? "justify-center" : (isOwnMessage ? "justify-end" : "justify-start")
                    )}
                  >
                    <div className={cn(
                      "max-w-[80%] space-y-1",
                      isSystemMessage ? "text-center" : (isOwnMessage && "items-end")
                    )}>
                      {showSender && !isOwnMessage && !isSystemMessage && (
                        <p className="text-xs font-semibold text-gray-700 px-3">
                          {msg.sender_name}
                        </p>
                      )}
                      <div className={cn(
                        "rounded-2xl px-3 py-2",
                        isOwnMessage 
                          ? "bg-blue-600 text-white" 
                          : isSystemMessage
                          ? "bg-gray-200 text-gray-800 text-xs italic"
                          : "bg-gray-100 text-gray-900"
                      )}>
                        {/* Attachment Display */}
                        {msg.attachment_url && (
                          <div className="mb-2">
                            {msg.attachment_type === 'image' ? (
                              <img
                                src={msg.attachment_url}
                                alt="Attachment"
                                className="max-w-full rounded-lg cursor-pointer max-h-48 object-cover"
                                onClick={() => window.open(msg.attachment_url, '_blank')}
                              />
                            ) : (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded border text-xs",
                                  isOwnMessage ? "border-white/30 text-white" : "border-gray-300 text-gray-900",
                                  "hover:underline"
                                )}
                              >
                                {msg.attachment_type === 'document' ? <FileText className="w-3 h-3" /> : <Paperclip className="w-3 h-3" />}
                                <span>View {msg.attachment_type === 'document' ? 'Document' : 'File'}</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Location Display */}
                        {msg.location_data && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${msg.location_data.lat},${msg.location_data.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 p-2 mb-2 rounded border text-xs",
                              isOwnMessage ? "border-white/30 text-white" : "border-gray-300 text-gray-900",
                              "hover:underline"
                            )}
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Location Shared - View on Map</span>
                          </a>
                        )}

                        <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                      </div>
                      {!isSystemMessage && (
                        <div className={cn(
                          "flex items-center gap-1 px-2",
                          isOwnMessage ? "justify-end" : "justify-start"
                        )}>
                          <span className="text-xs text-gray-500">
                            {format(new Date(msg.sent_at), 'h:mm a')}
                          </span>
                          {getMessageStatus(msg)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-xs text-gray-600">
                        {typingUsers.length === 1 
                          ? `${typingUsers[0].user_name} is typing...`
                          : "Several people are typing..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              {/* File attachment preview */}
              {attachmentFile && (
                <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-3 h-3 text-blue-600" />
                    <span className="text-xs text-blue-900 truncate max-w-[150px]">{attachmentFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachmentFile(null)}
                    className="h-6 w-6 p-0"
                  >
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2 mb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 text-xs"
                >
                  <Paperclip className="w-3 h-3 mr-1" />
                  File
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareLocation}
                  disabled={!currentLocation || uploading}
                  className="flex-1 text-xs"
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  Location
                </Button>
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={uploading ? "Uploading..." : "Type a message..."}
                  rows={2}
                  className="resize-none text-sm"
                  disabled={uploading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !attachmentFile) || uploading}
                  className="bg-blue-600 hover:bg-blue-700 h-auto"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Chat Conversations
          </h3>

          {conversations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No conversations yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Dispatch will start a chat when needed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <Card
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className="border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        conv.conversation_type === 'group' ? "bg-purple-100" : "bg-blue-100"
                      )}>
                        {conv.conversation_type === 'group' ? (
                          <Users className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {conv.conversation_type === 'group' 
                              ? conv.conversation_name
                              : 'Dispatch'}
                          </p>
                          <span className="text-xs text-gray-500">
                            {conv.last_message_at && format(new Date(conv.last_message_at), 'h:mm a')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {conv.last_message_text || 'No messages yet'}
                        </p>
                        {conv.conversation_type === 'group' && (
                          <p className="text-xs text-gray-500 mt-1">
                            {conv.participants?.filter(p => p.email !== 'system').length} participants
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
