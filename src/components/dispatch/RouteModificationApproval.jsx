
import React from 'react'; // useState removed as no longer needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Textarea and Label removed as no longer used for dispatcher notes in this component
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Navigation, Clock, CheckCircle2, XCircle, AlertTriangle,
  User, TrendingUp, Zap
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns"; // Added differenceInMinutes
import { toast } from "sonner";
import ComplexRouteReview from "./ComplexRouteReview";

export default function RouteModificationApproval() {
  // selectedMod and dispatcherNotes state variables are removed as they are no longer used
  // for the detailed view, which is handled by ComplexRouteReview or removed for simple mods.
  const queryClient = useQueryClient();

  // Renamed data variable to pendingApprovalsData to allow for pendingModifications alias
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['pendingRouteApprovals'],
    queryFn: async () => {
      const mods = await base44.entities.RouteModification.filter({
        status: 'pending_dispatcher_approval'
      });
      return mods.sort((a, b) => {
        // Sort by priority then time
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.suggested_at) - new Date(a.suggested_at);
      });
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const pendingModifications = pendingApprovalsData || [];

  // Filter modifications based on criteria defined in the outline
  const complexModifications = pendingModifications.filter(m =>
    m.requires_dispatcher_approval &&
    (m.modification_type === 'skip_delivery' ||
     (m.affected_deliveries && m.affected_deliveries.length > 5) || // Added null check for affected_deliveries
     m.trigger_reason === 'driver_feedback')
  );

  const simpleModifications = pendingModifications.filter(m =>
    !complexModifications.includes(m)
  );

  // approveModificationMutation and rejectModificationMutation are kept as per the outline's instruction
  // "// ... keep existing code (approveMutation, rejectMutation) ...",
  // even though their direct callers (handleApprove, handleReject) have been removed from this component.
  const approveModificationMutation = useMutation({
    mutationFn: async ({ modId, notes }) => {
      const mod = pendingModifications.find(m => m.id === modId);

      // Approve and apply the modification
      await base44.entities.RouteModification.update(modId, {
        status: 'dispatcher_approved',
        dispatcher_reviewed_by: 'Dispatcher',
        dispatcher_reviewed_at: new Date().toISOString(),
        dispatcher_notes: notes,
        applied_at: new Date().toISOString()
      });

      // Update the route
      await base44.entities.OptimizedRoute.update(mod.route_id, {
        delivery_ids: mod.modified_sequence,
        optimized_sequence: mod.modified_sequence.map((id, idx) => ({
          delivery_id: id,
          sequence_number: idx + 1
        }))
      });

      // Notify driver
      await base44.entities.DispatchMessage.create({
        message_type: 'route_update',
        from_dispatcher: 'Dispatch',
        to_driver: mod.driver_email,
        driver_name: mod.driver_name,
        subject: 'Route Modification Approved',
        message_text: `Your route change request has been approved. New sequence is now active.\n\nDispatcher Notes: ${notes || 'None'}`,
        priority: 'high',
        sent_at: new Date().toISOString(),
        requires_acknowledgment: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['routeModifications'] });
      toast.success("Route modification approved and applied!");
      // setSelectedMod(null); // No longer relevant
      // setDispatcherNotes(""); // No longer relevant
    },
  });

  const rejectModificationMutation = useMutation({
    mutationFn: async ({ modId, notes }) => {
      const mod = pendingModifications.find(m => m.id === modId);

      await base44.entities.RouteModification.update(modId, {
        status: 'dispatcher_rejected',
        dispatcher_reviewed_by: 'Dispatcher',
        dispatcher_reviewed_at: new Date().toISOString(),
        dispatcher_notes: notes
      });

      // Notify driver
      await base44.entities.DispatchMessage.create({
        message_type: 'route_update',
        from_dispatcher: 'Dispatch',
        to_driver: mod.driver_email,
        driver_name: mod.driver_name,
        subject: 'Route Change Request Declined',
        message_text: `Your route change request was reviewed and declined.\n\nReason: ${notes}\n\nPlease continue with your current route sequence.`,
        priority: 'normal',
        sent_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
      toast.success("Route modification declined");
      // setSelectedMod(null); // No longer relevant
      // setDispatcherNotes(""); // No longer relevant
    },
  });

  // handleApprove and handleReject functions are removed as they are no longer called
  // by the refactored UI in this component.

  const getModificationIcon = (type) => {
    switch (type) {
      case 'route_around_traffic': return Navigation;
      case 'skip_delivery': return AlertTriangle;
      case 'change_priority': return Zap;
      case 'resequence': return TrendingUp;
      default: return Navigation;
    }
  };

  return (
    <div className="space-y-4">
      {/* Complex Modifications Requiring Detailed Review */}
      {complexModifications.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">
              Complex Changes ({complexModifications.length}) - Detailed Review Required
            </h3>
          </div>

          {complexModifications.map((modification) => (
            <ComplexRouteReview
              key={modification.id}
              modification={modification}
              onApprove={() => {
                queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
                queryClient.invalidateQueries({ queryKey: ['optimizedRoutes'] });
                toast.success("Complex modification approved and applied!");
              }}
              onReject={() => {
                queryClient.invalidateQueries({ queryKey: ['pendingRouteApprovals'] });
                toast.success("Complex modification rejected!");
              }}
            />
          ))}
        </div>
      )}

      {/* Simple Modifications - Quick Review */}
      {simpleModifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-blue-900">
            Quick Review ({simpleModifications.length})
          </h3>

          {simpleModifications.map((mod) => {
            const minutesAgo = differenceInMinutes(new Date(), new Date(mod.suggested_at));
            const ModIcon = getModificationIcon(mod.modification_type);

            return (
              <Card
                key={mod.id}
                className={`border-2 transition-all ${
                  // The selectedMod logic is removed, so cards default to priority styling.
                  mod.priority === 'urgent'
                  ? 'border-red-300 bg-red-50'
                  : mod.priority === 'high'
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200'
                }`}
                // onClick removed as simple modifications no longer have a detailed view in this component
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        mod.priority === 'urgent' ? 'bg-red-600' :
                        mod.priority === 'high' ? 'bg-orange-600' :
                        'bg-blue-600'
                      }`}>
                        <ModIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{mod.driver_name}</CardTitle>
                        <p className="text-xs text-gray-600">{mod.driver_email}</p>
                      </div>
                    </div>
                    <Badge className={
                      mod.priority === 'urgent' ? 'bg-red-600' :
                      mod.priority === 'high' ? 'bg-orange-600' :
                      'bg-blue-600'
                    }>
                      {mod.priority}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">
                      {mod.modification_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-gray-600">
                      Reason: {mod.trigger_reason.replace(/_/g, ' ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {mod.time_saved_minutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-green-600" />
                        <span>{mod.time_saved_minutes > 0 ? '+' : ''}{mod.time_saved_minutes} min</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-blue-600" />
                      <span>{mod.ai_confidence}% confidence</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">
                    Suggested {format(new Date(mod.suggested_at), "MMM d 'at' h:mm a")} ({minutesAgo} min ago)
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* No Pending Modifications Message */}
      {pendingModifications.length === 0 && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-300 mb-4" />
            <p className="text-gray-600">No pending route modifications</p>
            {/* The line "All routes are running as planned" is not present in the outline's empty state */}
          </CardContent>
        </Card>
      )}

      {/* The Detail View section (selectedMod && ...) is completely removed as per the outline */}
    </div>
  );
}
