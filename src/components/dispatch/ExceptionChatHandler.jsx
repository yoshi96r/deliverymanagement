import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertTriangle, Send, CheckCircle2, Clock, XCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ExceptionChatHandler({ 
  exception, 
  delivery, 
  conversationId, 
  onActionTaken 
}) {
  const [actionType, setActionType] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [reattemptDate, setReattemptDate] = useState("");
  const queryClient = useQueryClient();

  const updateExceptionMutation = useMutation({
    mutationFn: async (updateData) => {
      await base44.entities.DeliveryException.update(exception.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allExceptions'] });
      toast.success("Exception updated!");
      if (onActionTaken) onActionTaken();
    },
  });

  const handleTakeAction = async () => {
    if (!actionType) {
      toast.error("Please select an action");
      return;
    }

    if (!resolutionNotes.trim()) {
      toast.error("Please provide details");
      return;
    }

    try {
      const updateData = {
        resolution_status: actionType,
        resolution_notes: resolutionNotes,
        resolved_by: "Dispatcher"
      };

      if (actionType === "reattempt_scheduled" && reattemptDate) {
        updateData.reattempt_date = reattemptDate;
      }

      if (actionType === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }

      await updateExceptionMutation.mutateAsync(updateData);

      // Send confirmation message in chat
      await base44.entities.ChatMessage.create({
        conversation_id: conversationId,
        sender_email: "system",
        sender_name: "System",
        sender_role: "system",
        message_text: `✅ Exception ${actionType.replace(/_/g, ' ').toUpperCase()}\n\nResolution: ${resolutionNotes}${reattemptDate ? `\n\nReattempt scheduled for: ${new Date(reattemptDate).toLocaleDateString()}` : ''}`,
        message_type: "system_notification",
        sent_at: new Date().toISOString(),
        read_by: [],
        delivered_to: []
      });

      // Update conversation
      await base44.entities.ChatConversation.update(conversationId, {
        last_message_at: new Date().toISOString(),
        last_message_text: `Exception ${actionType.replace(/_/g, ' ')}`,
        last_message_sender: "System",
        total_messages: (exception.total_messages || 0) + 1
      });

      setActionType("");
      setResolutionNotes("");
      setReattemptDate("");
    } catch (error) {
      console.error("Failed to update exception:", error);
      toast.error("Failed to update exception");
    }
  };

  return (
    <Card className="border-2 border-orange-300 bg-orange-50">
      <CardHeader className="pb-3 bg-orange-100 border-b border-orange-200">
        <CardTitle className="text-base text-orange-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Exception Resolution
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Exception Info */}
        <div className="p-3 bg-white rounded-lg border border-orange-200">
          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <p className="text-gray-600">Type:</p>
              <p className="font-semibold">{exception.exception_type.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-600">Severity:</p>
              <Badge className={
                exception.severity === 'critical' ? 'bg-red-600' :
                exception.severity === 'high' ? 'bg-orange-600' :
                'bg-yellow-600'
              }>
                {exception.severity}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-600">Description:</p>
            <p className="text-sm text-gray-900">{exception.description}</p>
          </div>
        </div>

        {/* Action Selection */}
        <div>
          <Label htmlFor="actionType">Resolution Action *</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger id="actionType">
              <SelectValue placeholder="Select action..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resolved">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Mark as Resolved
                </div>
              </SelectItem>
              <SelectItem value="reattempt_scheduled">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Schedule Reattempt
                </div>
              </SelectItem>
              <SelectItem value="held_at_facility">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Hold at Facility
                </div>
              </SelectItem>
              <SelectItem value="returned_to_sender">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Return to Sender
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reattempt Date (conditional) */}
        {actionType === "reattempt_scheduled" && (
          <div>
            <Label htmlFor="reattemptDate">Reattempt Date *</Label>
            <Input
              id="reattemptDate"
              type="date"
              value={reattemptDate}
              onChange={(e) => setReattemptDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}

        {/* Resolution Notes */}
        <div>
          <Label htmlFor="resolutionNotes">Resolution Details *</Label>
          <Textarea
            id="resolutionNotes"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Describe how this exception is being resolved..."
            rows={3}
          />
        </div>

        {/* Action Button */}
        <Button
          onClick={handleTakeAction}
          disabled={!actionType || !resolutionNotes.trim() || updateExceptionMutation.isPending}
          className="w-full bg-orange-600 hover:bg-orange-700 font-bold"
        >
          {updateExceptionMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Apply Resolution & Notify Driver
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}