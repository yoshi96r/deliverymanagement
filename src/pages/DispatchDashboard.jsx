import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, CheckCircle2, Bell, MapPin, Package,
  Clock, MessageSquare, Camera, User, Map, UserCog, 
  Navigation, Megaphone, Shield, Users, DollarSign, 
  Brain, Calendar, FlaskConical, GraduationCap
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import MessagingPanel from "../components/dispatch/MessagingPanel";
import AssignmentManager from "../components/dispatch/AssignmentManager";
import TaskManager from "../components/dispatch/TaskManager";
import RouteOptimizer from "../components/dispatch/RouteOptimizer";
import DispatcherPerformance from "../components/dispatch/DispatcherPerformance";
import BroadcastManager from "../components/dispatch/BroadcastManager";
import SafetyReportsManager from "../components/dispatch/SafetyReportsManager";
import RouteModificationApproval from "../components/dispatch/RouteModificationApproval";
import RealTimeChatPanel from "../components/dispatch/RealTimeChatPanel";
import GroupChatManager from "../components/dispatch/GroupChatManager";
import DriverPaymentManager from "../components/dispatch/DriverPaymentManager";
import { reassignException, resolveAssignment } from "../components/dispatch/AutoAssignmentEngine";
import AdvancedRouteMap from "../components/dispatch/AdvancedRouteMap";
import ManualRouteEditor from "../components/dispatch/ManualRouteEditor";
import BatchRouteAssigner from "../components/dispatch/BatchRouteAssigner";
import InteractiveRouteMap from "../components/dispatch/InteractiveRouteMap";
import AIRouteSuggestionEngine from "../components/dispatch/AIRouteSuggestionEngine";
import AISuggestionsDashboard from "../components/dispatch/AISuggestionsDashboard";
import DispatchAIAssistant from "../components/dispatch/DispatchAIAssistant";
import DailySummaryDashboard from "../components/dispatch/DailySummaryDashboard";
import { startAIMonitoring, stopAIMonitoring } from "../components/dispatch/AIOperationsMonitor";
import { startGamificationManager, stopGamificationManager } from "../components/dispatch/GamificationManager";
import RouteSimulationLab from "../components/dispatch/RouteSimulationLab";
import DispatcherTrainingSimulator from "../components/dispatch/DispatcherTrainingSimulator";
import SimulationInsightsDashboard from "../components/dispatch/SimulationInsightsDashboard";

export default function DispatchDashboard() {
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showMessagingDialog, setShowMessagingDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [selectedExceptionForAction, setSelectedExceptionForAction] = useState(null);
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false);
  const [selectedRouteForEdit, setSelectedRouteForEdit] = useState(null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [showBatchAssigner, setShowBatchAssigner] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(true);

  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['dispatchNotifications'],
    queryFn: () => base44.entities.DispatchNotification.list('-sent_at'),
    initialData: [],
    refetchInterval: 5000,
  });

  const { data: exceptions } = useQuery({
    queryKey: ['allExceptions'],
    queryFn: () => base44.entities.DeliveryException.list('-timestamp'),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date'),
    initialData: [],
  });

  const { data: exceptionTasks } = useQuery({
    queryKey: ['exceptionTasks'],
    queryFn: () => base44.entities.ExceptionTask.list('-created_at'),
    initialData: [],
  });

  const { data: optimizedRoutes } = useQuery({
    queryKey: ['optimizedRoutes'],
    queryFn: () => base44.entities.OptimizedRoute.list('-created_at'),
    initialData: [],
  });

  const { data: dispatcherAssignments } = useQuery({
    queryKey: ['dispatcherAssignments'],
    queryFn: () => base44.entities.DispatcherAssignment.list('-assigned_at', 100),
    initialData: [],
  });

  const { data: dispatchers } = useQuery({
    queryKey: ['dispatchers'],
    queryFn: () => base44.entities.Dispatcher.list(),
    initialData: [],
  });

  const { data: pendingRouteChanges } = useQuery({
    queryKey: ['pendingRouteApprovals'],
    queryFn: async () => {
      const mods = await base44.entities.RouteModification.filter({
        status: 'pending_dispatcher_approval'
      });
      return mods;
    },
    initialData: [],
  });

  useEffect(() => {
    const monitor = startAIMonitoring();
    return () => stopAIMonitoring();
  }, []);

  useEffect(() => {
    const gamification = startGamificationManager();
    return () => stopGamificationManager();
  }, []);

  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.DispatchNotification.update(notificationId, {
        acknowledged: true,
        acknowledged_by: 'Dispatcher',
        acknowledged_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatchNotifications'] });
      toast.success("Alert acknowledged");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ notificationId, notes }) => {
      await base44.entities.DispatchNotification.update(notificationId, {
        resolved: true,
        resolution_notes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatchNotifications'] });
      setShowDetailDialog(false);
      setResolutionNotes("");
      toast.success("Issue marked as resolved");
    },
  });

  const viewDetails = (notification) => {
    setSelectedNotification(notification);
    setShowDetailDialog(true);
  };

  const handleAcknowledge = (notificationId) => {
    acknowledgeMutation.mutate(notificationId);
  };

  const handleResolve = async () => {
    if (!resolutionNotes) {
      toast.error("Please provide resolution notes");
      return;
    }

    const assignment = dispatcherAssignments.find(
      a => a.exception_id === selectedNotification.exception_id &&
      a.status !== 'resolved' &&
      a.status !== 'reassigned'
    );

    if (assignment) {
      await resolveAssignment(assignment.id, resolutionNotes);
      queryClient.invalidateQueries({ queryKey: ['dispatcherAssignments'] });
    }

    resolveMutation.mutate({
      notificationId: selectedNotification.id,
      notes: resolutionNotes,
    });
  };

  const handleSendMessage = (exception) => {
    setSelectedExceptionForAction(exception);
    setSelectedDriver({
      driverEmail: exception.reported_by_email,
      driverName: exception.reported_by
    });
    setShowMessagingDialog(true);
  };

  const handleAssignException = (exception) => {
    setSelectedExceptionForAction(exception);
    setShowAssignmentDialog(true);
  };

  const handleAssignmentComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['allExceptions'] });
    queryClient.invalidateQueries({ queryKey: ['dispatchNotifications'] });
    queryClient.invalidateQueries({ queryKey: ['dispatcherAssignments'] });
    setShowAssignmentDialog(false);
    setSelectedExceptionForAction(null);
    toast.success("Assignment updated successfully!");
  };

  const handleGroupCreated = () => {
    setShowGroupChatDialog(false);
    setActiveTab("messages");
    toast.success("Group chat created!");
  };

  const handleAIAction = (actionType, data) => {
    if (actionType === 'message') {
      setSelectedDriver({
        driverEmail: data.driverEmail,
        driverName: data.driverName || 'Driver'
      });
      setShowMessagingDialog(true);
    } else if (actionType === 'reassign_driver') {
      const exception = exceptions.find(e => e.id === data.exceptionId);
      if (exception) {
        setSelectedExceptionForAction(exception);
        setShowAssignmentDialog(true);
      }
    } else if (actionType === 'escalate_exception') {
      toast.info("AI suggested escalating an exception. Review 'Escalated' tab.");
      setActiveTab('escalated');
    }
  };

  const unacknowledgedCount = notifications.filter(n => !n.acknowledged && !n.resolved).length;
  const criticalCount = notifications.filter(n => n.priority === 'critical' && !n.resolved).length;
  const unresolvedCount = notifications.filter(n => !n.resolved).length;
  const escalatedCount = exceptions.filter(e => e.escalated && e.resolution_status === 'escalated').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-red-900 mb-2 flex items-center gap-3">
                <Bell className="w-10 h-10" />
                Dispatch Control Center
              </h1>
              <p className="text-red-600">Real-time exception monitoring and driver support</p>
            </div>
            <Button
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              variant="outline"
              className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Brain className="w-5 h-5 mr-2" />
              {showAIAssistant ? 'Hide' : 'Show'} AI Assistant
            </Button>
          </div>
        </div>

        {showAIAssistant && (
          <div className="mb-8">
            <DispatchAIAssistant onActionTrigger={handleAIAction} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-2 border-red-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Unacknowledged</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{unacknowledgedCount}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Critical Alerts</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{criticalCount}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-100 bg-white animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">🚨 Escalated</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{escalatedCount}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Unresolved</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">{unresolvedCount}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Resolved Today</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">
                    {notifications.filter(n => {
                      if (!n.resolved || !n.acknowledged_at) return false;
                      const today = new Date().toDateString();
                      return new Date(n.acknowledged_at).toDateString() === today;
                    }).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-gray-600 py-12">
          Dispatch Dashboard - System loading...
        </p>
      </div>
    </div>
  );
}