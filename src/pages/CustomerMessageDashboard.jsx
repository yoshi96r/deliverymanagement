import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, Search, Send, AlertTriangle, Smile,
  Frown, Meh, Heart, ThumbsUp, Clock, CheckCircle2,
  Mail, Phone, Package, TrendingUp, Users
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CustomerMessageDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [responseText, setResponseText] = useState("");

  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['customerMessages'],
    queryFn: () => base44.entities.CustomerMessage.list('-sent_at', 500),
    initialData: [],
    refetchInterval: 10000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ messageId, response, respondedBy }) => {
      await base44.entities.CustomerMessage.update(messageId, {
        status: "responded",
        response_text: response,
        responded_by: respondedBy,
        responded_at: new Date().toISOString(),
        response_time_minutes: Math.floor(
          (new Date() - new Date(selectedMessage.sent_at)) / 60000
        )
      });

      // Send email to customer
      await base44.integrations.Core.SendEmail({
        to: selectedMessage.customer_email,
        subject: `Re: ${selectedMessage.message_subject}`,
        body: `Dear ${selectedMessage.customer_name},

${response}

${selectedMessage.tracking_number ? `\nTracking Number: ${selectedMessage.tracking_number}` : ''}

If you have any other questions, please don't hesitate to reach out.

Best regards,
${respondedBy}
USPS Customer Service`,
        from_name: "USPS Customer Service"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerMessages'] });
      setShowResponseDialog(false);
      setResponseText("");
      toast.success("Response sent to customer!");
    },
  });

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      const matchesSearch = !searchQuery ||
        msg.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.message_subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || msg.status === statusFilter;
      const matchesSentiment = sentimentFilter === "all" || msg.sentiment === sentimentFilter;

      return matchesSearch && matchesStatus && matchesSentiment;
    });
  }, [messages, searchQuery, statusFilter, sentimentFilter]);

  const getSentimentIcon = (sentiment) => {
    const icons = {
      very_positive: { icon: Heart, color: "text-pink-600" },
      positive: { icon: Smile, color: "text-green-600" },
      appreciative: { icon: ThumbsUp, color: "text-green-600" },
      neutral: { icon: Meh, color: "text-gray-600" },
      confused: { icon: Meh, color: "text-blue-600" },
      negative: { icon: Frown, color: "text-orange-600" },
      frustrated: { icon: AlertTriangle, color: "text-orange-600" },
      very_negative: { icon: Frown, color: "text-red-600" },
      angry: { icon: AlertTriangle, color: "text-red-600" }
    };
    return icons[sentiment] || icons.neutral;
  };

  const getSentimentBadge = (sentiment) => {
    const badges = {
      very_positive: "bg-pink-100 text-pink-800",
      positive: "bg-green-100 text-green-800",
      appreciative: "bg-green-100 text-green-800",
      neutral: "bg-gray-100 text-gray-800",
      confused: "bg-blue-100 text-blue-800",
      negative: "bg-orange-100 text-orange-800",
      frustrated: "bg-orange-100 text-orange-800",
      very_negative: "bg-red-100 text-red-800",
      angry: "bg-red-100 text-red-800"
    };
    return badges[sentiment] || badges.neutral;
  };

  const stats = useMemo(() => {
    return {
      total: messages.length,
      new: messages.filter(m => m.status === "new").length,
      urgent: messages.filter(m => m.urgency_level === "critical" || m.urgency_level === "high").length,
      negative: messages.filter(m => 
        m.sentiment === "angry" || m.sentiment === "frustrated" || m.sentiment === "very_negative"
      ).length,
      avgResponseTime: messages.filter(m => m.response_time_minutes).length > 0
        ? messages.filter(m => m.response_time_minutes).reduce((sum, m) => sum + m.response_time_minutes, 0) / 
          messages.filter(m => m.response_time_minutes).length
        : 0
    };
  }, [messages]);

  const handleRespond = (message) => {
    setSelectedMessage(message);
    setResponseText(message.suggested_response || "");
    setShowResponseDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <MessageSquare className="w-10 h-10 text-purple-600" />
            Customer Messages
          </h1>
          <p className="text-gray-600">AI-powered sentiment analysis and response management</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <MessageSquare className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Messages</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <Mail className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{stats.new}</p>
              <p className="text-sm text-gray-600">New Messages</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
              <p className="text-3xl font-bold text-red-900">{stats.urgent}</p>
              <p className="text-sm text-gray-600">Urgent</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Frown className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{stats.negative}</p>
              <p className="text-sm text-gray-600">Negative Tone</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">{stats.avgResponseTime.toFixed(0)}m</p>
              <p className="text-sm text-gray-600">Avg Response</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2 border-gray-200 mb-6">
          <CardContent className="p-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name, email, subject, or tracking..."
                    className="pl-10 h-12"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setStatusFilter("all")}
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  onClick={() => setStatusFilter("new")}
                  variant={statusFilter === "new" ? "default" : "outline"}
                  size="sm"
                  className={statusFilter === "new" ? "bg-green-600" : ""}
                >
                  New
                </Button>
                <Button
                  onClick={() => setSentimentFilter("angry")}
                  variant={sentimentFilter === "angry" ? "default" : "outline"}
                  size="sm"
                  className={sentimentFilter === "angry" ? "bg-red-600" : ""}
                >
                  😠 Angry
                </Button>
                <Button
                  onClick={() => setSentimentFilter("frustrated")}
                  variant={sentimentFilter === "frustrated" ? "default" : "outline"}
                  size="sm"
                  className={sentimentFilter === "frustrated" ? "bg-orange-600" : ""}
                >
                  😤 Frustrated
                </Button>
                <Button
                  onClick={() => setSentimentFilter("confused")}
                  variant={sentimentFilter === "confused" ? "default" : "outline"}
                  size="sm"
                  className={sentimentFilter === "confused" ? "bg-blue-600" : ""}
                >
                  😕 Confused
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading messages...</p>
              </CardContent>
            </Card>
          ) : filteredMessages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No messages found</p>
              </CardContent>
            </Card>
          ) : (
            filteredMessages.map((msg) => {
              const sentimentInfo = getSentimentIcon(msg.sentiment);
              const SentimentIcon = sentimentInfo.icon;

              return (
                <Card 
                  key={msg.id}
                  className={`border-2 ${
                    msg.requires_immediate_attention ? 'border-red-400 bg-red-50 animate-pulse' :
                    msg.status === 'new' ? 'border-green-300 bg-green-50' :
                    msg.sentiment === 'angry' || msg.sentiment === 'very_negative' ? 'border-orange-300 bg-orange-50' :
                    'border-gray-200'
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Sentiment Icon */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.sentiment === 'angry' || msg.sentiment === 'very_negative' ? 'bg-red-200' :
                        msg.sentiment === 'frustrated' || msg.sentiment === 'negative' ? 'bg-orange-200' :
                        msg.sentiment === 'confused' ? 'bg-blue-200' :
                        msg.sentiment === 'positive' || msg.sentiment === 'appreciative' ? 'bg-green-200' :
                        'bg-gray-200'
                      }`}>
                        <SentimentIcon className={`w-6 h-6 ${sentimentInfo.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-bold text-lg text-gray-900">{msg.customer_name}</h3>
                              {msg.status === 'new' && (
                                <Badge className="bg-green-600 animate-pulse">NEW</Badge>
                              )}
                              {msg.requires_immediate_attention && (
                                <Badge className="bg-red-600 animate-pulse">⚡ URGENT</Badge>
                              )}
                              <Badge className={getSentimentBadge(msg.sentiment)}>
                                {msg.sentiment.replace(/_/g, ' ')}
                              </Badge>
                              <Badge variant="outline">
                                {msg.urgency_level}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{msg.customer_email}</p>
                            {msg.tracking_number && (
                              <p className="font-mono text-xs text-gray-600">📦 {msg.tracking_number}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-gray-600">
                              {format(new Date(msg.sent_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>

                        {/* Sentiment Score Bar */}
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-700">Sentiment:</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  msg.ai_sentiment_score >= 50 ? 'bg-green-500' :
                                  msg.ai_sentiment_score >= 0 ? 'bg-blue-500' :
                                  msg.ai_sentiment_score >= -50 ? 'bg-orange-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.abs(msg.ai_sentiment_score)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-700">{msg.ai_sentiment_score}</span>
                          </div>
                        </div>

                        {/* Emotions */}
                        {msg.emotion_detected && msg.emotion_detected.length > 0 && (
                          <div className="flex gap-2 mb-3 flex-wrap">
                            {msg.emotion_detected.map((emotion, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {emotion}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* AI Summary */}
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                          <p className="text-xs font-semibold text-blue-900 mb-1">🤖 AI Summary:</p>
                          <p className="text-sm text-blue-800">{msg.ai_summary}</p>
                        </div>

                        {/* Subject & Key Topics */}
                        <div className="mb-2">
                          <p className="font-semibold text-gray-900 mb-1">{msg.message_subject}</p>
                          {msg.key_topics && msg.key_topics.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {msg.key_topics.map((topic, idx) => (
                                <Badge key={idx} className="bg-purple-600 text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Message Preview */}
                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                          {msg.message_body}
                        </p>

                        {/* Response if exists */}
                        {msg.response_text && (
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-3">
                            <p className="text-xs font-semibold text-green-900 mb-1">
                              ✅ Responded by {msg.responded_by} - {format(new Date(msg.responded_at), "MMM d 'at' h:mm a")}
                            </p>
                            <p className="text-sm text-green-800">{msg.response_text}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setSelectedMessage(msg);
                              setShowResponseDialog(true);
                            }}
                            size="sm"
                            variant={msg.status === "new" ? "default" : "outline"}
                            className={msg.status === "new" ? "bg-blue-600" : ""}
                          >
                            {msg.status === "new" ? (
                              <>
                                <Send className="w-4 h-4 mr-1" />
                                Respond
                              </>
                            ) : (
                              <>View & Reply</>
                            )}
                          </Button>
                          {msg.customer_phone && (
                            <Button
                              onClick={() => window.location.href = `tel:${msg.customer_phone}`}
                              size="sm"
                              variant="outline"
                              className="border-green-300"
                            >
                              <Phone className="w-4 h-4 mr-1" />
                              Call
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Response Dialog */}
        <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Respond to Customer</DialogTitle>
            </DialogHeader>
            {selectedMessage && (
              <div className="space-y-4">
                {/* Customer Info */}
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Customer</p>
                        <p className="font-semibold">{selectedMessage.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Email</p>
                        <p className="font-semibold">{selectedMessage.customer_email}</p>
                      </div>
                      {selectedMessage.tracking_number && (
                        <div>
                          <p className="text-gray-600">Tracking</p>
                          <p className="font-mono font-semibold">{selectedMessage.tracking_number}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-600">Sentiment</p>
                        <Badge className={getSentimentBadge(selectedMessage.sentiment)}>
                          {selectedMessage.sentiment.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Original Message */}
                <Card className="border-2 border-gray-200">
                  <CardHeader className="bg-gray-50">
                    <CardTitle className="text-base">Customer's Message</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="font-semibold text-gray-900 mb-2">{selectedMessage.message_subject}</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedMessage.message_body}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Sent: {format(new Date(selectedMessage.sent_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </CardContent>
                </Card>

                {/* AI Suggested Response */}
                {selectedMessage.suggested_response && (
                  <Card className="border-2 border-purple-200 bg-purple-50">
                    <CardHeader className="bg-purple-100">
                      <CardTitle className="text-base text-purple-900">🤖 AI Suggested Response</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <p className="text-sm text-purple-800 whitespace-pre-wrap">
                        {selectedMessage.suggested_response}
                      </p>
                      <Button
                        onClick={() => setResponseText(selectedMessage.suggested_response)}
                        size="sm"
                        variant="outline"
                        className="mt-2 border-purple-300"
                      >
                        Use This Response
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Response Form */}
                <div>
                  <Label htmlFor="response">Your Response *</Label>
                  <Textarea
                    id="response"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Type your response to the customer..."
                    rows={8}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setShowResponseDialog(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!responseText) {
                        toast.error("Please write a response");
                        return;
                      }
                      respondMutation.mutate({
                        messageId: selectedMessage.id,
                        response: responseText,
                        respondedBy: "USPS Customer Service"
                      });
                    }}
                    disabled={!responseText || respondMutation.isPending}
                    className="bg-blue-600"
                  >
                    {respondMutation.isPending ? "Sending..." : "Send Response"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}