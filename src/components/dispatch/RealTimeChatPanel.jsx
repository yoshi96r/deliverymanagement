
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Send, MessageSquare, Users, Search, Archive, MoreVertical,
  CheckCheck, Check, Circle, Paperclip, MapPin, Zap, Image as ImageIcon,
  FileText, AlertTriangle, XCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import QuickReplyPanel from "./QuickReplyPanel";

export default function RealTimeChatPanel({ currentUserEmail, currentUserName, currentUserRole = "dispatcher" }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadConversations();
    
    // Poll for updates every 2 seconds for real-time feel
    const interval = setInterval(() => {
      loadConversations();
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
        loadTypingIndicators(selectedConversation.id);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentUserEmail]);

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

      // Filter conversations where current user is a participant
      const userConversations = allConversations.filter(conv =>
        conv.participants?.some(p => p.email === currentUserEmail)
      ).sort((a, b) => 
        new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
      );

      setConversations(userConversations);
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

      // Filter out expired indicators and current user
      const now = new Date();
      const activeIndicators = indicators.filter(ind => 
        new Date(ind.expires_at) > now && ind.user_email !== currentUserEmail
      );

      setTypingUsers(activeIndicators);
    } catch (error) {
      console.error("Failed to load typing indicators:", error);
    }
  };

  const markMessagesAsRead = async (conversationId) => {
    try {
      // Fetch messages again to ensure we have the latest read_by status
      const currentMessages = await base44.entities.ChatMessage.filter({
        conversation_id: conversationId
      });

      const unreadMessages = currentMessages.filter(msg => 
        msg.sender_email !== currentUserEmail &&
        !msg.read_by?.some(r => r.email === currentUserEmail)
      );

      for (const msg of unreadMessages) {
        const readBy = msg.read_by || [];
        readBy.push({
          email: currentUserEmail,
          read_at: new Date().toISOString()
        });

        await base44.entities.ChatMessage.update(msg.id, {
          read_by: readBy
        });
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  };

  const handleTyping = async () => {
    if (!selectedConversation) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Find or create typing indicator
    const existingIndicators = await base44.entities.ChatTypingIndicator.filter({
      conversation_id: selectedConversation.id,
      user_email: currentUserEmail
    });

    const expiresAt = new Date(Date.now() + 10000).toISOString(); // 10 seconds

    if (existingIndicators.length > 0) {
      await base44.entities.ChatTypingIndicator.update(existingIndicators[0].id, {
        started_typing_at: new Date().toISOString(),
        expires_at: expiresAt
      });
    } else {
      await base44.entities.ChatTypingIndicator.create({
        conversation_id: selectedConversation.id,
        user_email: currentUserEmail,
        user_name: currentUserName,
        started_typing_at: new Date().toISOString(),
        expires_at: expiresAt
      });
    }

    // Auto-remove typing indicator after 3 seconds of no typing
    typingTimeoutRef.current = setTimeout(async () => {
      const indicators = await base44.entities.ChatTypingIndicator.filter({
        conversation_id: selectedConversation.id,
        user_email: currentUserEmail
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
          folder: 'chat_attachments'
        });
        attachmentUrl = uploadResult.file_url;
        
        // Determine attachment type
        if (attachmentFile.type.startsWith('image/')) {
          attachmentType = 'image';
        } else if (attachmentFile.type.startsWith('video/')) {
          attachmentType = 'video';
        } else {
          attachmentType = 'document';
        }
        messageType = "file_attachment";
        if (!messageContent) { // If only attachment, set a default message
          messageContent = `Sent ${attachmentType}`;
        }
        setUploading(false);
      }

      // Create message
      const newMessage = await base44.entities.ChatMessage.create({
        conversation_id: selectedConversation.id,
        sender_email: currentUserEmail,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        message_text: messageContent,
        message_type: messageType,
        sent_at: new Date().toISOString(),
        read_by: [{
          email: currentUserEmail,
          read_at: new Date().toISOString()
        }],
        delivered_to: selectedConversation.participants.map(p => p.email), // Deliver to all participants
        attachment_url: attachmentUrl,
        attachment_type: attachmentType
      });

      // Update conversation
      await base44.entities.ChatConversation.update(selectedConversation.id, {
        last_message_at: new Date().toISOString(),
        last_message_text: messageContent.substring(0, 100),
        last_message_sender: currentUserName,
        total_messages: (selectedConversation.total_messages || 0) + 1
      });

      // Clear typing indicator
      const indicators = await base44.entities.ChatTypingIndicator.filter({
        conversation_id: selectedConversation.id,
        user_email: currentUserEmail
      });

      for (const indicator of indicators) {
        await base44.entities.ChatTypingIndicator.update(indicator.id, {
          expires_at: new Date().toISOString()
        });
      }

      setMessageText("");
      setAttachmentFile(null);
      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      setUploading(false);
    }
  };

  const handleRequestLocation = async () => {
    if (!selectedConversation) return;

    // Get driver from conversation
    const driver = selectedConversation.participants?.find(
      p => p.role === "driver" && p.email !== currentUserEmail
    );

    if (!driver) {
      toast.error("No driver in this conversation");
      return;
    }

    const reason = prompt("Reason for location request:");
    if (!reason) return;

    try {
      // Create location request
      const request = await base44.entities.LocationShareRequest.create({
        conversation_id: selectedConversation.id,
        requested_by_email: currentUserEmail,
        requested_by_name: currentUserName,
        driver_email: driver.email,
        driver_name: driver.name,
        requested_at: new Date().toISOString(),
        reason: reason,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 60000).toISOString() // 30 minutes
      });

      // Send system message
      await base44.entities.ChatMessage.create({
        conversation_id: selectedConversation.id,
        sender_email: "system",
        sender_name: "System",
        sender_role: "system",
        message_text: `📍 ${currentUserName} requested your current location: ${reason}`,
        message_type: "system_notification",
        sent_at: new Date().toISOString(),
        read_by: [],
        delivered_to: selectedConversation.participants.map(p => p.email)
      });

      loadMessages(selectedConversation.id);
      toast.success("Location request sent to driver");
    } catch (error) {
      console.error("Failed to request location:", error);
      toast.error("Failed to request location");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachmentFile(file);
      e.target.value = null; // Clear input to allow re-selection of the same file
      toast.success(`File selected: ${file.name}`);
    }
  };

  const handleQuickReplySelect = (message) => {
    setMessageText(message);
    setShowQuickReplies(false);
  };

  const getUnreadCount = (conversation) => {
    // This would be calculated from messages
    return 0; // Simplified for now
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, date);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return format(date, 'h:mm a');
    return format(date, 'MMM d');
  };

  const getMessageStatus = (message) => {
    if (message.sender_email !== currentUserEmail) return null;

    const allParticipants = selectedConversation?.participants?.filter(
      p => p.email !== currentUserEmail
    ) || [];
    
    // Check if message has been read by all other participants
    const readCount = message.read_by?.filter(
      r => r.email !== currentUserEmail && allParticipants.some(p => p.email === r.email)
    ).length || 0;

    // Check if message has been delivered to all other participants
    const deliveredCount = message.delivered_to?.filter(
      dEmail => dEmail !== currentUserEmail && allParticipants.some(p => p.email === dEmail)
    ).length || 0;

    if (readCount > 0 && readCount === allParticipants.length) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />; // All read
    } else if (deliveredCount > 0 && deliveredCount === allParticipants.length) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />; // All delivered, not all read
    } else {
      return <Check className="w-4 h-4 text-gray-400" />; // Sent, not all delivered
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.conversation_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.participants?.some(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="h-[600px] flex border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Messages</h3>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-600">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedConversation?.id === conv.id && "bg-blue-50 hover:bg-blue-50"
                  )}
                >
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
                            : conv.participants?.find(p => p.email !== currentUserEmail)?.name || 'Unknown'}
                        </p>
                        <span className="text-xs text-gray-500">
                          {formatMessageTime(conv.last_message_at || conv.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {conv.last_message_text || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">
                  {selectedConversation.conversation_type === 'group'
                    ? selectedConversation.conversation_name
                    : selectedConversation.participants?.find(p => p.email !== currentUserEmail)?.name || 'Unknown'}
                </h3>
                {selectedConversation.conversation_type === 'group' && (
                  <p className="text-xs text-gray-600">
                    {selectedConversation.participants?.length} participants
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {currentUserRole === "dispatcher" && selectedConversation.participants?.some(p => p.role === "driver") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestLocation}
                    className="border-blue-300 text-blue-700"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    Request Location
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className="border-purple-300 text-purple-700"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Quick Replies
                </Button>
              </div>
            </div>

            {/* Quick Reply Panel */}
            {showQuickReplies && (
              <div className="p-3 border-b border-gray-200 bg-purple-50">
                <QuickReplyPanel
                  onSelectTemplate={handleQuickReplySelect}
                  driverName={selectedConversation.participants?.find(p => p.role === 'driver')?.name}
                  trackingNumber={selectedConversation.related_delivery_id}
                />
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isOwnMessage = msg.sender_email === currentUserEmail;
                  const showSender = idx === 0 || messages[idx - 1].sender_email !== msg.sender_email;

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[70%] space-y-1",
                        isOwnMessage && "items-end"
                      )}>
                        {showSender && !isOwnMessage && msg.sender_role !== "system" && (
                          <p className="text-xs font-semibold text-gray-700 px-3">
                            {msg.sender_name}
                          </p>
                        )}
                        <div className={cn(
                          "rounded-2xl px-4 py-2",
                          isOwnMessage 
                            ? "bg-blue-600 text-white" 
                            : msg.sender_role === "system"
                            ? "bg-gray-200 text-gray-800 italic"
                            : "bg-gray-100 text-gray-900"
                        )}>
                          {/* Attachment Display */}
                          {msg.attachment_url && (
                            <div className="mb-2">
                              {msg.attachment_type === 'image' ? (
                                <img
                                  src={msg.attachment_url}
                                  alt="Attachment"
                                  className="max-w-full rounded-lg cursor-pointer max-h-64 object-cover"
                                  onClick={() => window.open(msg.attachment_url, '_blank')}
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded border",
                                    isOwnMessage ? "border-white/30 text-white hover:bg-blue-700" : "border-gray-300 text-gray-800 hover:bg-gray-200"
                                  )}
                                >
                                  <FileText className="w-4 h-4" />
                                  <span className="text-sm">View Attachment</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Location Display */}
                          {msg.location_data && (
                            <a
                              href={`https://www.google.com/maps/search/${msg.location_data.lat},${msg.location_data.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 p-2 mb-2 rounded border",
                                isOwnMessage ? "border-white/30 text-white hover:bg-blue-700" : "border-gray-300 text-gray-800 hover:bg-gray-200"
                              )}
                            >
                              <MapPin className="w-4 h-4" />
                              <div className="text-xs">
                                <p className="font-semibold">Location Shared</p>
                                <p className="opacity-80">{msg.location_data.address || 'View on map'}</p>
                              </div>
                            </a>
                          )}

                          <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                        </div>
                        {msg.sender_role !== "system" && (
                          <div className={cn(
                            "flex items-center gap-1 px-3",
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
                
                {/* Typing Indicators */}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-xs text-gray-600">
                          {typingUsers[0].user_name} is typing...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              {/* File attachment preview */}
              {attachmentFile && (
                <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {attachmentFile.type.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="text-sm text-blue-900">{attachmentFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachmentFile(null)}
                  >
                    <XCircle className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
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
                  placeholder={uploading ? "Uploading file..." : "Type a message..."}
                  rows={1}
                  className="resize-none"
                  disabled={uploading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !attachmentFile) || uploading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
