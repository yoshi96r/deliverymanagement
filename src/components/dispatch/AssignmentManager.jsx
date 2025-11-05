
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { format } from "date-fns"; // Import format from date-fns

const dispatcherTeams = [
  { value: "customer_service", label: "Customer Service", icon: "💬" },
  { value: "route_planning", label: "Route Planning", icon: "🗺️" },
  { value: "operations", label: "Operations", icon: "⚙️" },
  { value: "emergency", label: "Emergency Response", icon: "🚨" },
  { value: "management", label: "Management", icon: "👔" }
];

const escalationPriorities = [
  { value: "standard", label: "Standard", color: "bg-blue-500" },
  { value: "urgent", label: "Urgent", color: "bg-orange-500" },
  { value: "emergency", label: "Emergency", color: "bg-red-500" }
];

export default function AssignmentManager({ exception, onAssigned }) {
  const [assignedTeam, setAssignedTeam] = useState(exception?.dispatcher_team || "");
  const [assignedDispatcher, setAssignedDispatcher] = useState(exception?.assigned_dispatcher || "");
  const [escalationPriority, setEscalationPriority] = useState(exception?.escalation_priority || "standard");
  const [updating, setUpdating] = useState(false);

  // Load related tasks
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  React.useEffect(() => {
    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const tasks = await base44.entities.ExceptionTask.filter({
          exception_id: exception.id
        });
        setRelatedTasks(tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } catch (error) {
        console.error("Failed to load tasks:", error);
      }
      setLoadingTasks(false);
    };

    if (exception?.id) {
      loadTasks();
    }
  }, [exception?.id]);

  const handleAssign = async () => {
    if (!assignedTeam) {
      toast.error("Please select a team");
      return;
    }

    setUpdating(true);
    try {
      // Generate dispatcher ID if not provided
      const dispatcherId = assignedDispatcher || `${assignedTeam}_dispatcher_${Date.now() % 10}`;

      // Update exception with assignment
      await base44.entities.DeliveryException.update(exception.id, {
        dispatcher_team: assignedTeam,
        assigned_dispatcher: dispatcherId,
        escalation_priority: escalationPriority,
        escalated: true,
        escalated_at: exception.escalated_at || new Date().toISOString(),
        resolution_status: 'escalated'
      });

      // Create or update dispatch notification
      const existingNotifications = await base44.entities.DispatchNotification.filter({
        exception_id: exception.id,
        notification_type: 'dashboard_alert'
      });

      if (existingNotifications.length > 0) {
        await base44.entities.DispatchNotification.update(existingNotifications[0].id, {
          priority: escalationPriority === 'emergency' ? 'critical' : 'high',
          sent_to: dispatcherId
        });
      } else {
        await base44.entities.DispatchNotification.create({
          exception_id: exception.id,
          delivery_request_id: exception.delivery_request_id,
          tracking_number: exception.tracking_number,
          notification_type: 'dashboard_alert',
          priority: escalationPriority === 'emergency' ? 'critical' : 'high',
          sent_to: dispatcherId,
          sent_at: new Date().toISOString(),
          acknowledged: false,
          resolved: false
        });
      }

      // Send email notification to team
      const teamEmail = `${assignedTeam}@usps-dispatch.com`; // In production, use actual team emails
      await base44.integrations.Core.SendEmail({
        to: teamEmail,
        subject: `🚨 Exception Assigned: ${exception.exception_type.replace(/_/g, ' ')} - ${exception.tracking_number}`,
        body: `An exception has been assigned to ${assignedTeam.replace(/_/g, ' ').toUpperCase()} team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSIGNMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority: ${escalationPriority.toUpperCase()}
Assigned To: ${dispatcherId}
Team: ${assignedTeam.replace(/_/g, ' ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXCEPTION INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: ${exception.exception_type.replace(/_/g, ' ')}
Tracking: ${exception.tracking_number}
Driver: ${exception.reported_by}
Severity: ${exception.severity}

Description:
${exception.description}

${exception.escalation_reason ? `\nEscalation Reason:\n${exception.escalation_reason}` : ''}

${exception.attempted_actions ? `\nActions Attempted:\n${exception.attempted_actions}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please review and take appropriate action in the Dispatch Dashboard.

View full details: https://app.usps.com/dispatch
`,
        from_name: 'USPS Dispatch Assignment System'
      });

      toast.success(`Exception assigned to ${assignedTeam.replace(/_/g, ' ')} team!`);
      
      if (onAssigned) onAssigned();
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign exception");
    }
    setUpdating(false);
  };

  const handleReassign = async () => {
    if (!assignedTeam) {
      toast.error("Please select a team");
      return;
    }

    setUpdating(true);
    try {
      const newDispatcherId = assignedDispatcher || `${assignedTeam}_dispatcher_${Date.now() % 10}`;

      await base44.entities.DeliveryException.update(exception.id, {
        dispatcher_team: assignedTeam,
        assigned_dispatcher: newDispatcherId,
        escalation_priority: escalationPriority
      });

      // Send reassignment notification
      const teamEmail = `${assignedTeam}@usps-dispatch.com`;
      await base44.integrations.Core.SendEmail({
        to: teamEmail,
        subject: `🔄 Exception Reassigned: ${exception.tracking_number}`,
        body: `An exception has been reassigned to ${assignedTeam.replace(/_/g, ' ').toUpperCase()} team

Previous Assignment: ${exception.dispatcher_team?.replace(/_/g, ' ') || 'None'}
New Assignment: ${assignedTeam.replace(/_/g, ' ')}
Priority: ${escalationPriority.toUpperCase()}

Exception: ${exception.exception_type.replace(/_/g, ' ')}
Tracking: ${exception.tracking_number}

Please review in the Dispatch Dashboard.
`,
        from_name: 'USPS Dispatch Assignment System'
      });

      toast.success("Exception reassigned successfully!");
      
      if (onAssigned) onAssigned();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reassign exception");
    }
    setUpdating(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-purple-50 border-b-2 border-purple-200">
          <CardTitle className="text-purple-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {exception?.assigned_dispatcher ? "Reassign Exception" : "Assign Exception"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {exception?.assigned_dispatcher && (
            <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">Current Assignment:</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">Team:</span>
                  <span>{exception.dispatcher_team?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">Dispatcher:</span>
                  <span>{exception.assigned_dispatcher}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">Priority:</span>
                  <Badge className={
                    exception.escalation_priority === 'emergency' ? 'bg-red-500' :
                    exception.escalation_priority === 'urgent' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }>
                    {exception.escalation_priority?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="team">Assign to Team *</Label>
            <Select value={assignedTeam} onValueChange={setAssignedTeam}>
              <SelectTrigger id="team" className="mt-1">
                <SelectValue placeholder="Select dispatcher team..." />
              </SelectTrigger>
              <SelectContent>
                {dispatcherTeams.map((team) => (
                  <SelectItem key={team.value} value={team.value}>
                    <span className="mr-2">{team.icon}</span>
                    {team.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dispatcher_id">Specific Dispatcher (Optional)</Label>
            <Input
              id="dispatcher_id"
              value={assignedDispatcher}
              onChange={(e) => setAssignedDispatcher(e.target.value)}
              placeholder="e.g., dispatcher_john_doe or leave blank for auto-assign"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to auto-assign to team queue
            </p>
          </div>

          <div>
            <Label htmlFor="escalation_priority">Escalation Priority</Label>
            <Select value={escalationPriority} onValueChange={setEscalationPriority}>
              <SelectTrigger id="escalation_priority" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {escalationPriorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${priority.color}`} />
                      {priority.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {exception?.assigned_dispatcher ? (
            <Button
              onClick={handleReassign}
              disabled={updating || !assignedTeam}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {updating ? "Reassigning..." : "Reassign to New Team"}
            </Button>
          ) : (
            <Button
              onClick={handleAssign}
              disabled={updating || !assignedTeam}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {updating ? "Assigning..." : "Assign Exception"}
            </Button>
          )}

          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xs font-semibold text-yellow-900 mb-1">💡 Assignment Tips:</p>
            <ul className="text-xs text-yellow-800 space-y-1 ml-4 list-disc">
              <li>Customer Service: Customer communication issues</li>
              <li>Route Planning: Address or access problems</li>
              <li>Operations: Package or vehicle issues</li>
              <li>Emergency: Critical safety or damage concerns</li>
              <li>Management: Policy decisions required</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Related Tasks Summary - NEW */}
      {relatedTasks.length > 0 && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3 bg-blue-50">
            <CardTitle className="text-base text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Related Tasks ({relatedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {loadingTasks ? (
              <p className="text-sm text-gray-600">Loading tasks...</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="p-2 bg-blue-50 rounded text-center">
                    <p className="text-lg font-bold text-blue-900">
                      {relatedTasks.filter(t => t.status === "pending" || t.status === "in_progress").length}
                    </p>
                    <p className="text-xs text-blue-600">Active</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded text-center">
                    <p className="text-lg font-bold text-orange-900">
                      {relatedTasks.filter(t => t.status === "blocked").length}
                    </p>
                    <p className="text-xs text-orange-600">Blocked</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded text-center">
                    <p className="text-lg font-bold text-green-900">
                      {relatedTasks.filter(t => t.status === "completed").length}
                    </p>
                    <p className="text-xs text-green-600">Done</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded text-center">
                    <p className="text-lg font-bold text-red-900">
                      {relatedTasks.filter(t => 
                        t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed"
                      ).length}
                    </p>
                    <p className="text-xs text-red-600">Overdue</p>
                  </div>
                </div>

                {relatedTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3 rounded-lg border-2",
                      task.status === "completed" ? "border-green-200 bg-green-50" :
                      task.status === "blocked" ? "border-orange-200 bg-orange-50" :
                      task.status === "in_progress" ? "border-blue-200 bg-blue-50" :
                      "border-gray-200 bg-gray-50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            task.priority === "urgent" ? "bg-red-600" :
                            task.priority === "high" ? "bg-orange-600" :
                            "bg-blue-600"
                          }>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {task.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{task.task_title}</p>
                        <p className="text-xs text-gray-600">
                          {task.assigned_team.replace(/_/g, ' ')} team
                          {task.due_date && ` • Due ${format(new Date(task.due_date), "MMM d")}`}
                        </p>
                      </div>
                      {task.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {task.status === "blocked" && (
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </div>
                ))}

                {relatedTasks.length > 5 && (
                  <p className="text-xs text-center text-gray-500 mt-2">
                    And {relatedTasks.length - 5} more tasks...
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {relatedTasks.length === 0 && !loadingTasks && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-600">
              No tasks created yet. Add tasks in the exception details to track resolution steps.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
