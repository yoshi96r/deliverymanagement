import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Navigation, Zap, CheckCircle2, XCircle, Clock, 
  TrendingUp, AlertTriangle, Lightbulb, Eye
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RealTimeReroutingDisplay({ driverEmail, routeId }) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedModification, setSelectedModification] = useState(null);
  const queryClient = useQueryClient();

  const { data: liveModifications, refetch } = useQuery({
    queryKey: ['liveReroutingSuggestions', routeId, driverEmail],
    queryFn: async () => {
      const mods = await base44.entities.RouteModification.filter({
        route_id: routeId,
        driver_email: driverEmail,
        status: ['pending_driver_review', 'driver_accepted'],
        created_at: { $gte: new Date(Date.now() - 60 * 60000).toISOString() } // Last hour
      });
      return mods.sort((a, b) => new Date(b.suggested_at).getTime() - new Date(a.suggested_at).getTime());
    },
    enabled: !!routeId && !!driverEmail,
    initialData: [],
    refetchInterval: 10000, // Check every 10 seconds for new suggestions
  });

  const acceptModificationMutation = useMutation({
    mutationFn: async (modificationId) => {
      const modification = liveModifications.find(m => m.id === modificationId);
      
      await base44.entities.RouteModification.update(modificationId, {
        status: 'driver_accepted',
        driver_response_at: new Date().toISOString(),
        applied_at: new Date().toISOString()
      });

      // Apply route changes
      await base44.entities.OptimizedRoute.update(modification.route_id, {
        delivery_ids: modification.modified_sequence,
        optimized_sequence: modification.modified_sequence.map((id, idx) => ({
          delivery_id: id,
          sequence_number: idx + 1
        }))
      });

      // Update delivery sequences
      for (let i = 0; i < modification.modified_sequence.length; i++) {
        await base44.entities.DeliveryRequest.update(modification.modified_sequence[i], {
          route_sequence: i + 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeDriverRoute'] });
      queryClient.invalidateQueries({ queryKey: ['driverDeliveries'] });
      refetch();
      toast.success("Route updated! Check your deliveries for new sequence.");
    },
  });

  const rejectModificationMutation = useMutation({
    mutationFn: async ({ modificationId, feedback }) => {
      await base44.entities.RouteModification.update(modificationId, {
        status: 'driver_rejected',
        driver_response_at: new Date().toISOString(),
        driver_feedback: feedback
      });
    },
    onSuccess: () => {
      refetch();
      toast.info("Suggestion rejected. Original route maintained.");
    },
  });

  const pendingSuggestions = liveModifications.filter(m => m.status === 'pending_driver_review');
  
  if (pendingSuggestions.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {pendingSuggestions.map((modification) => {
          const minutesAgo = differenceInMinutes(new Date(), new Date(modification.suggested_at));
          const isUrgent = modification.priority === 'urgent' || modification.priority === 'high';

          return (
            <Alert 
              key={modification.id}
              className={`border-2 ${
                isUrgent ? 'border-red-400 bg-red-50 animate-pulse' : 'border-blue-400 bg-blue-50'
              }`}
            >
              <Navigation className="h-5 w-5" />
              <AlertDescription>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={
                          modification.trigger_reason === 'driver_feedback' ? 'bg-blue-600' :
                          modification.trigger_reason === 'heavy_traffic' ? 'bg-orange-600' :
                          modification.trigger_reason === 'exception_occurred' ? 'bg-red-600' :
                          'bg-purple-600'
                        }>
                          {modification.trigger_reason.replace(/_/g, ' ')}
                        </Badge>
                        <Badge className={isUrgent ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}>
                          {modification.priority.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-600">{minutesAgo}m ago</span>
                      </div>
                      <p className="font-bold text-gray-900">
                        🤖 AI Rerouting Suggestion
                      </p>
                    </div>
                    <Badge className={
                      modification.ai_confidence >= 85 ? 'bg-green-600 text-white' :
                      modification.ai_confidence >= 70 ? 'bg-blue-600 text-white' :
                      'bg-yellow-600 text-white'
                    }>
                      {modification.ai_confidence}% Confident
                    </Badge>
                  </div>

                  {/* Trigger Details */}
                  <div className="p-2 bg-white rounded border border-gray-200">
                    <p className="text-sm text-gray-800">{modification.trigger_details}</p>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-white rounded text-center">
                      <Clock className="w-4 h-4 mx-auto text-green-600 mb-1" />
                      <p className="text-lg font-bold text-green-700">
                        {modification.time_saved_minutes > 0 ? '-' : '+'}{Math.abs(modification.time_saved_minutes)}m
                      </p>
                      <p className="text-xs text-gray-600">Impact</p>
                    </div>
                    <div className="p-2 bg-white rounded text-center">
                      <Navigation className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                      <p className="text-lg font-bold text-blue-700">
                        {modification.affected_deliveries?.length || 0}
                      </p>
                      <p className="text-xs text-gray-600">Stops</p>
                    </div>
                    <div className="p-2 bg-white rounded text-center">
                      <TrendingUp className="w-4 h-4 mx-auto text-purple-600 mb-1" />
                      <p className="text-lg font-bold text-purple-700">
                        {modification.ai_confidence}%
                      </p>
                      <p className="text-xs text-gray-600">AI Score</p>
                    </div>
                  </div>

                  {/* AI Reasoning Preview */}
                  <div className="p-2 bg-purple-50 rounded border border-purple-200">
                    <p className="text-xs font-semibold text-purple-900 mb-1">AI Analysis:</p>
                    <p className="text-sm text-purple-800 line-clamp-2">
                      {modification.ai_reasoning?.split('\n')[0]}
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => {
                        setSelectedModification(modification);
                        setShowDetails(true);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                    <Button
                      onClick={() => {
                        const feedback = prompt("Why are you rejecting this suggestion?");
                        if (feedback) {
                          rejectModificationMutation.mutate({ 
                            modificationId: modification.id, 
                            feedback 
                          });
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => acceptModificationMutation.mutate(modification.id)}
                      disabled={acceptModificationMutation.isPending}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 font-bold"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Apply
                    </Button>
                  </div>

                  {isUrgent && (
                    <div className="flex items-center gap-2 text-xs text-red-700 font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      Urgent: Immediate action recommended for optimal route completion
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Rerouting Details</DialogTitle>
          </DialogHeader>
          {selectedModification && (
            <div className="space-y-4">
              {/* Full AI Reasoning */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Complete AI Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedModification.ai_reasoning}
                  </div>
                </CardContent>
              </Card>

              {/* Driver Feedback Context */}
              {selectedModification.driver_feedback && (
                <Card className="border-2 border-orange-300 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-900">Your Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-orange-800 whitespace-pre-wrap">
                      {selectedModification.driver_feedback}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    const feedback = prompt("Why are you rejecting this suggestion?");
                    if (feedback) {
                      rejectModificationMutation.mutate({ 
                        modificationId: selectedModification.id, 
                        feedback 
                      });
                      setShowDetails(false);
                    }
                  }}
                  variant="outline"
                  className="border-red-300 text-red-700"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    acceptModificationMutation.mutate(selectedModification.id);
                    setShowDetails(false);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Accept & Apply
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}