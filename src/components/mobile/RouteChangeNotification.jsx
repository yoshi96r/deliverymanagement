
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Navigation, Clock, TrendingUp, AlertTriangle, CheckCircle2,
  X, Zap, MapPin, Package, Eye, XCircle // Added Package, Eye, XCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle // Added Dialog components
} from "@/components/ui/dialog";
import { differenceInMinutes } from 'date-fns'; // Added date-fns import

export default function RouteChangeNotification({ driverEmail, routeId, onRouteModified }) {
  const [selectedModification, setSelectedModification] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false); // New state
  const queryClient = useQueryClient();

  const { data: pendingModifications, refetch: refetchModifications } = useQuery({ // Added refetch
    queryKey: ['routeModifications', driverEmail],
    queryFn: async () => {
      const mods = await base44.entities.RouteModification.filter({
        driver_email: driverEmail,
        status: ['pending_driver_review', 'pending_dispatcher_approval']
      });
      return mods.sort((a, b) => new Date(b.suggested_at) - new Date(a.suggested_at));
    },
    initialData: [],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // New query for deliveries to be used in the Review Dialog
  const { data: deliveries = [] } = useQuery({
    queryKey: ['routeDeliveries', routeId],
    queryFn: async () => {
      if (!routeId) return [];
      const route = await base44.entities.OptimizedRoute.get(routeId);
      if (!route || !route.delivery_ids) return [];
      const deliveryRequests = await Promise.all(
        route.delivery_ids.map(id => base44.entities.DeliveryRequest.get(id))
      );
      return deliveryRequests.filter(Boolean); // Filter out any null/undefined deliveries if IDs don't exist
    },
    enabled: !!routeId && showReviewDialog, // Only fetch when dialog is open and routeId exists
  });


  const handleAcceptChange = async (modification) => {
    try {
      // Update modification status
      await base44.entities.RouteModification.update(modification.id, {
        status: 'driver_accepted',
        driver_response_at: new Date().toISOString(),
        driver_feedback: 'Accepted - will follow new sequence',
        applied_at: new Date().toISOString()
      });

      // Apply route changes
      await base44.entities.OptimizedRoute.update(modification.route_id, {
        delivery_ids: modification.modified_sequence,
        optimized_sequence: modification.modified_sequence.map((id, idx) => ({
          delivery_id: id,
          sequence_number: idx + 1
        })),
        total_estimated_time_minutes: modification.new_estimated_time,
        total_distance_miles: modification.new_distance_miles
      });

      // Update delivery sequences
      for (let i = 0; i < modification.modified_sequence.length; i++) {
        await base44.entities.DeliveryRequest.update(modification.modified_sequence[i], {
          route_sequence: i + 1
        });
      }

      refetchModifications(); // Invalidate routeModifications query
      queryClient.invalidateQueries({ queryKey: ['driverDeliveries'] }); // Invalidate driverDeliveries as route changed
      setSelectedModification(null); // Clear selected modification
      setShowReviewDialog(false); // Close review dialog
      if (onRouteModified) onRouteModified();
      toast.success("Route updated! Check your deliveries tab for new sequence.");
    } catch (error) {
      console.error("Failed to accept change:", error);
      toast.error("Failed to accept route change");
    }
  };

  const handleRejectChange = async (modification) => {
    const feedback = prompt("Why are you rejecting this route change? (This helps AI improve)");

    try {
      await base44.entities.RouteModification.update(modification.id, {
        status: 'driver_rejected',
        driver_response_at: new Date().toISOString(),
        driver_feedback: feedback || 'Rejected by driver'
      });

      // Notify dispatch about rejection
      await base44.integrations.Core.SendEmail({
        to: 'dispatch@usps.com', // Placeholder email, adjust if necessary
        subject: `Driver Rejected Route Change: ${modification.route_id}`,
        body: `Driver ${driverEmail} rejected a route modification.

Route: ${modification.route_id}
Modification Type: ${modification.modification_type}
Trigger: ${modification.trigger_reason}

Driver Feedback: ${feedback || 'No feedback provided'}

AI Confidence: ${modification.ai_confidence}%
Estimated Time Savings: ${modification.time_saved_minutes} minutes

Please review and consider manual intervention.`,
        from_name: 'Driver Route System'
      });

      refetchModifications(); // Invalidate routeModifications query
      setSelectedModification(null); // Clear selected modification
      setShowReviewDialog(false); // Close review dialog
      toast.info("Route change rejected. Dispatch has been notified.");
    } catch (error) {
      console.error("Failed to reject change:", error);
      toast.error("Failed to reject route change");
    }
  };

  const handleReviewChange = (modification) => {
    setSelectedModification(modification);
    setShowReviewDialog(true);
  };

  // Auto-select highest priority pending modification - this logic might be less important now that all are rendered,
  // but it can still set a default for the review dialog if needed.
  useEffect(() => {
    if (pendingModifications.length > 0 && !selectedModification) {
      const urgent = pendingModifications.find(m => m.priority === 'urgent');
      const high = pendingModifications.find(m => m.priority === 'high');
      setSelectedModification(urgent || high || pendingModifications[0]);
    }
  }, [pendingModifications, selectedModification]);


  if (pendingModifications.length === 0) return null;

  return (
    <> {/* Wrap in Fragment for Dialog */}
      <div className="space-y-3">
        {pendingModifications.map((modification) => {
          const minutesAgo = differenceInMinutes(new Date(), new Date(modification.suggested_at));
          const isExpiringSoon = modification.expires_at &&
            differenceInMinutes(new Date(modification.expires_at), new Date()) < 10 &&
            differenceInMinutes(new Date(modification.expires_at), new Date()) > 0; // Only if not expired yet

          return (
            <Alert
              key={modification.id}
              className={`border-2 ${
                modification.trigger_reason === 'heavy_traffic' ? 'border-orange-400 bg-orange-50' :
                modification.trigger_reason === 'exception_occurred' ? 'border-red-400 bg-red-50' :
                modification.trigger_reason === 'driver_feedback' ? 'border-blue-400 bg-blue-50' :
                modification.trigger_reason === 'weather_conditions' ? 'border-sky-400 bg-sky-50' :
                'border-purple-400 bg-purple-50'
              } ${isExpiringSoon ? 'animate-pulse' : ''}`}
            >
              <Navigation className="h-5 w-5" />
              <AlertDescription>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={
                          modification.priority === 'urgent' ? 'bg-red-600' :
                          modification.priority === 'high' ? 'bg-orange-600' :
                          'bg-blue-600'
                        }>
                          {modification.priority.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {modification.modification_type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-gray-600">
                          {minutesAgo}m ago
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 mb-1">
                        {modification.trigger_reason === 'heavy_traffic' ? '🚦 Traffic Detected' :
                         modification.trigger_reason === 'exception_occurred' ? '⚠️ Exception Route Change' :
                         modification.trigger_reason === 'driver_feedback' ? '💬 Based on Your Feedback' :
                         modification.trigger_reason === 'weather_conditions' ? '🌧️ Weather Adjustment' :
                         '🤖 AI Route Optimization'}
                      </p>
                      <p className="text-sm text-gray-700">{modification.trigger_details}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={
                        modification.ai_confidence >= 85 ? 'bg-green-600 text-white' :
                        modification.ai_confidence >= 70 ? 'bg-blue-600 text-white' :
                        'bg-yellow-600 text-white'
                      }>
                        {modification.ai_confidence}% confident
                      </Badge>
                    </div>
                  </div>

                  {/* Enhanced Impact Display */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-white rounded text-center">
                      <Clock className="w-4 h-4 mx-auto text-green-600 mb-1" />
                      <p className="text-lg font-bold text-green-700">
                        {modification.time_saved_minutes > 0 ? '-' : '+'}{Math.abs(modification.time_saved_minutes)}m
                      </p>
                      <p className="text-xs text-gray-600">Time Impact</p>
                    </div>
                    <div className="p-2 bg-white rounded text-center">
                      <Package className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                      <p className="text-lg font-bold text-blue-700">
                        {modification.affected_deliveries?.length || 0}
                      </p>
                      <p className="text-xs text-gray-600">Stops Changed</p>
                    </div>
                    <div className="p-2 bg-white rounded text-center">
                      <Navigation className="w-4 h-4 mx-auto text-purple-600 mb-1" />
                      <p className="text-lg font-bold text-purple-700">
                        {modification.new_distance_miles ? modification.new_distance_miles.toFixed(1) : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600">New Miles</p>
                    </div>
                  </div>

                  {/* AI Reasoning Preview */}
                  <div className="p-2 bg-white rounded border border-gray-200">
                    <p className="text-xs font-semibold text-gray-900 mb-1">AI Analysis:</p>
                    <p className="text-sm text-gray-800 line-clamp-2">{modification.ai_reasoning}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleReviewChange(modification)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Review Details
                    </Button>
                    <Button
                      onClick={() => handleRejectChange(modification)}
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleAcceptChange(modification)}
                      size="sm"
                      className={`flex-1 ${
                        modification.ai_confidence >= 85 ? 'bg-green-600 hover:bg-green-700' :
                        'bg-blue-600 hover:bg-blue-700'
                      } font-bold`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Accept Changes
                    </Button>
                  </div>

                  {isExpiringSoon && (
                    <p className="text-xs text-orange-700 font-semibold mt-2">
                      ⏰ Expires in {differenceInMinutes(new Date(modification.expires_at), new Date())} minutes
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </div>

      {/* Review Dialog - Enhanced with more details */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Route Change Details</DialogTitle>
          </DialogHeader>
          {selectedModification && (
            <div className="space-y-4">
              {/* General Info */}
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={
                    selectedModification.priority === 'urgent' ? 'bg-red-600' :
                    selectedModification.priority === 'high' ? 'bg-orange-600' :
                    'bg-blue-600'
                  }>
                    {selectedModification.priority.toUpperCase()}
                  </Badge>
                  <p className="font-bold text-gray-900 mt-2">
                    {selectedModification.trigger_reason === 'heavy_traffic' ? '🚦 Traffic Detected' :
                     selectedModification.trigger_reason === 'exception_occurred' ? '⚠️ Exception Route Change' :
                     selectedModification.trigger_reason === 'driver_feedback' ? '💬 Based on Your Feedback' :
                     selectedModification.trigger_reason === 'weather_conditions' ? '🌧️ Weather Adjustment' :
                     '🤖 AI Route Optimization'}
                  </p>
                </div>
                <Badge className={
                  selectedModification.ai_confidence >= 85 ? 'bg-green-600 text-white' :
                  selectedModification.ai_confidence >= 70 ? 'bg-blue-600 text-white' :
                  'bg-yellow-600 text-white'
                }>
                  {selectedModification.ai_confidence}% confident
                </Badge>
              </div>

              {/* AI Reasoning */}
              <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-1">🤖 AI Analysis:</p>
                <p className="text-sm text-gray-800">{selectedModification.ai_reasoning}</p>
              </div>

              {/* Trigger Details */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-900 mb-1">Situation:</p>
                <p className="text-sm text-gray-700">{selectedModification.trigger_details}</p>
              </div>

              {/* Benefits/Impact */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                  <Clock className="w-5 h-5 mx-auto text-green-600 mb-1" />
                  <p className="text-xs text-gray-600">Time Impact</p>
                  <p className="font-bold text-green-900">
                    {selectedModification.time_saved_minutes > 0 ? `Save ${selectedModification.time_saved_minutes}` : `Add ${Math.abs(selectedModification.time_saved_minutes)}`} min
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                  <Navigation className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                  <p className="text-xs text-gray-600">New Miles</p>
                  <p className="font-bold text-purple-900">{selectedModification.new_distance_miles ? selectedModification.new_distance_miles.toFixed(1) : 'N/A'}</p>
                </div>
                 <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <Package className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                  <p className="text-xs text-gray-600">Affected Stops</p>
                  <p className="font-bold text-blue-900">{selectedModification.affected_deliveries?.length || 0}</p>
                </div>
              </div>


              {/* Action Type */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Suggested Change:</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedModification.modification_type.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-sm text-gray-700">
                    {selectedModification.affected_deliveries?.length} {selectedModification.affected_deliveries?.length === 1 ? 'delivery' : 'deliveries'} affected
                  </span>
                </div>
              </div>

              {/* Approval Required Notice */}
              {selectedModification.requires_dispatcher_approval && (
                <Alert className="border-2 border-yellow-300 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-900 text-xs">
                    This change requires dispatcher approval before being applied
                  </AlertDescription>
                </Alert>
              )}

              {/* Enhanced Sequence Comparison - NEW */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sequence Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Original Sequence (first 5):</p>
                    <div className="space-y-1">
                      {selectedModification.original_sequence?.slice(0, 5).map((id, idx) => {
                        const delivery = deliveries.find(d => d.id === id);
                        return delivery ? (
                          <div key={id} className="text-xs p-2 bg-gray-100 rounded">
                            {idx + 1}. {delivery.customer_name}
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-gray-300"></div>

                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">New Sequence (first 5):</p>
                    <div className="space-y-1">
                      {selectedModification.modified_sequence?.slice(0, 5).map((id, idx) => {
                        const delivery = deliveries.find(d => d.id === id);
                        const isChanged = selectedModification.original_sequence?.[idx] !== id;
                        return delivery ? (
                          <div key={id} className={`text-xs p-2 rounded ${
                            isChanged ? 'bg-blue-100 border border-blue-300 font-semibold' : 'bg-gray-100'
                          }`}>
                            {idx + 1}. {delivery.customer_name} {isChanged && '(moved)'}
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons for Dialog */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => handleRejectChange(selectedModification)}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={() => handleAcceptChange(selectedModification)}
                  className={`font-bold ${
                    selectedModification.priority === 'urgent' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {selectedModification.requires_dispatcher_approval ? 'Request Approval' : 'Accept & Apply'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
