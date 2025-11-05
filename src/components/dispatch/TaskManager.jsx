import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Clock, AlertCircle, Plus, User, Calendar,
  Link as LinkIcon, PlayCircle, XCircle, Edit
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format, isPast, isToday, isTomorrow } from "date-fns";

const taskTypes = [
  { value: "contact_customer", label: "Contact Customer", icon: "📞" },
  { value: "contact_driver", label: "Contact Driver", icon: "🚗" },
  { value: "verify_address", label: "Verify Address", icon: "📍" },
  { value: "arrange_reattempt", label: "Arrange Reattempt", icon: "🔄" },
  { value: "process_claim", label: "Process Claim", icon: "📋" },
  { value: "update_tracking", label: "Update Tracking", icon: "📦" },
  { value: "investigate", label: "Investigate Issue", icon: "🔍" },
  { value: "escalate", label: "Escalate to Management", icon: "⬆️" },
  { value: "other", label: "Other Action", icon: "✏️" }
];

const teams = [
  { value: "customer_service", label: "Customer Service" },
  { value: "route_planning", label: "Route Planning" },
  { value: "operations", label: "Operations" },
  { value: "emergency", label: "Emergency" },
  { value: "management", label: "Management" }
];

export default function TaskManager({ exception, delivery, tasks, onTaskCreated, onTaskUpdated }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    task_title: "",
    task_description: "",
    task_type: "",
    priority: "normal",
    assigned_team: "",
    assigned_to: "",
    due_date: "",
    estimated_duration: "",
    depends_on_task_id: "",
    notes: ""
  });
  const [creating, setCreating] = useState(false);

  const handleCreateTask = async () => {
    if (!formData.task_title || !formData.assigned_team) {
      toast.error("Please provide task title and assign to a team");
      return;
    }

    setCreating(true);
    try {
      await base44.entities.ExceptionTask.create({
        exception_id: exception.id,
        delivery_request_id: delivery.id,
        tracking_number: exception.tracking_number || delivery.tracking_number,
        task_title: formData.task_title,
        task_description: formData.task_description,
        task_type: formData.task_type || "other",
        priority: formData.priority,
        status: formData.depends_on_task_id ? "blocked" : "pending",
        assigned_team: formData.assigned_team,
        assigned_to: formData.assigned_to || undefined,
        created_by: "Dispatcher",
        created_at: new Date().toISOString(),
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        depends_on_task_id: formData.depends_on_task_id || undefined,
        estimated_duration: formData.estimated_duration || undefined,
        notes: formData.notes || undefined,
        requires_customer_contact: formData.task_type === "contact_customer",
        requires_driver_contact: formData.task_type === "contact_driver",
        is_blocker: formData.priority === "urgent" || formData.priority === "high"
      });

      // If this task is dependent on another, update the blocking task
      if (formData.depends_on_task_id) {
        const blockingTask = tasks.find(t => t.id === formData.depends_on_task_id);
        if (blockingTask) {
          const blockingIds = blockingTask.blocking_task_ids || [];
          await base44.entities.ExceptionTask.update(formData.depends_on_task_id, {
            blocking_task_ids: [...blockingIds, "new_task_id"] // Would need the actual ID
          });
        }
      }

      // Send notification email to assigned team
      const teamEmail = `${formData.assigned_team}@usps-dispatch.com`;
      await base44.integrations.Core.SendEmail({
        to: teamEmail,
        subject: `📋 New Task Assigned: ${formData.task_title}`,
        body: `A new task has been assigned to ${formData.assigned_team.replace(/_/g, ' ')} team:

Task: ${formData.task_title}
Priority: ${formData.priority.toUpperCase()}
${formData.due_date ? `Due: ${format(new Date(formData.due_date), "MMM d, yyyy 'at' h:mm a")}` : ''}

Exception: ${exception.exception_type.replace(/_/g, ' ')}
Tracking: ${exception.tracking_number}

${formData.task_description ? `Description:\n${formData.task_description}\n\n` : ''}

${formData.notes ? `Notes:\n${formData.notes}\n\n` : ''}

View in Dispatch Dashboard to take action.
`,
        from_name: 'USPS Task Management'
      });

      toast.success("Task created and team notified!");
      setShowCreateForm(false);
      setFormData({
        task_title: "",
        task_description: "",
        task_type: "",
        priority: "normal",
        assigned_team: "",
        assigned_to: "",
        due_date: "",
        estimated_duration: "",
        depends_on_task_id: "",
        notes: ""
      });

      if (onTaskCreated) onTaskCreated();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create task");
    }
    setCreating(false);
  };

  const handleUpdateTaskStatus = async (taskId, newStatus, completionNotes = "") => {
    try {
      const updateData = {
        status: newStatus,
        ...(newStatus === "in_progress" && { started_at: new Date().toISOString() }),
        ...(newStatus === "completed" && {
          completed_at: new Date().toISOString(),
          completed_by: "Dispatcher",
          completion_notes: completionNotes
        })
      };

      await base44.entities.ExceptionTask.update(taskId, updateData);

      // If task is completed, check if any blocked tasks can now start
      if (newStatus === "completed") {
        const completedTask = tasks.find(t => t.id === taskId);
        if (completedTask?.blocking_task_ids?.length > 0) {
          for (const blockedId of completedTask.blocking_task_ids) {
            const blockedTask = tasks.find(t => t.id === blockedId);
            if (blockedTask?.status === "blocked") {
              await base44.entities.ExceptionTask.update(blockedId, {
                status: "pending"
              });
            }
          }
        }
      }

      toast.success("Task updated!");
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update task");
    }
  };

  const handleAddUpdate = async (taskId, note) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const updates = task.updates || [];
      
      await base44.entities.ExceptionTask.update(taskId, {
        updates: [
          ...updates,
          {
            timestamp: new Date().toISOString(),
            updated_by: "Dispatcher",
            note: note
          }
        ]
      });

      toast.success("Update added!");
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add update");
    }
  };

  const getDueDateColor = (dueDate) => {
    if (!dueDate) return "text-gray-500";
    const due = new Date(dueDate);
    if (isPast(due)) return "text-red-600";
    if (isToday(due)) return "text-orange-600";
    if (isTomorrow(due)) return "text-yellow-600";
    return "text-gray-700";
  };

  const getDueDateLabel = (dueDate) => {
    if (!dueDate) return "No due date";
    const due = new Date(dueDate);
    if (isToday(due)) return "Due today";
    if (isTomorrow(due)) return "Due tomorrow";
    if (isPast(due)) return "Overdue";
    return `Due ${format(due, "MMM d")}`;
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    // Priority: urgent > high > normal > low
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // Then by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return 0;
  });

  const pendingTasks = sortedTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = sortedTasks.filter(t => t.status === "completed");
  const blockedTasks = sortedTasks.filter(t => t.status === "blocked");

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50 border-b-2 border-purple-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-purple-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Exception Tasks & Follow-ups
            </CardTitle>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant="outline"
              className="border-purple-300 text-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Task Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <p className="text-2xl font-bold text-blue-900">{pendingTasks.length}</p>
              <p className="text-xs text-blue-600">Active</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
              <p className="text-2xl font-bold text-orange-900">{blockedTasks.length}</p>
              <p className="text-xs text-orange-600">Blocked</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-2xl font-bold text-green-900">{completedTasks.length}</p>
              <p className="text-xs text-green-600">Completed</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
              <p className="text-2xl font-bold text-red-900">
                {pendingTasks.filter(t => t.due_date && isPast(new Date(t.due_date))).length}
              </p>
              <p className="text-xs text-red-600">Overdue</p>
            </div>
          </div>

          {/* Create Task Form */}
          {showCreateForm && (
            <Card className="border-2 border-blue-300">
              <CardHeader className="pb-3 bg-blue-50">
                <CardTitle className="text-base text-blue-900">Create New Task</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label htmlFor="task_title">Task Title *</Label>
                  <Input
                    id="task_title"
                    value={formData.task_title}
                    onChange={(e) => setFormData({...formData, task_title: e.target.value})}
                    placeholder="Brief description of what needs to be done"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="task_type">Task Type</Label>
                    <Select
                      value={formData.task_type}
                      onValueChange={(value) => setFormData({...formData, task_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {taskTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="mr-2">{type.icon}</span>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({...formData, priority: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">🚨 Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="task_description">Description</Label>
                  <Textarea
                    id="task_description"
                    value={formData.task_description}
                    onChange={(e) => setFormData({...formData, task_description: e.target.value})}
                    placeholder="Detailed description of the task..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="assigned_team">Assign to Team *</Label>
                    <Select
                      value={formData.assigned_team}
                      onValueChange={(value) => setFormData({...formData, assigned_team: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.value} value={team.value}>
                            {team.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="assigned_to">Assign to Person (Optional)</Label>
                    <Input
                      id="assigned_to"
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                      placeholder="Email or name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="estimated_duration">Est. Duration</Label>
                    <Input
                      id="estimated_duration"
                      value={formData.estimated_duration}
                      onChange={(e) => setFormData({...formData, estimated_duration: e.target.value})}
                      placeholder="e.g., 30 minutes, 2 hours"
                    />
                  </div>
                </div>

                {tasks.length > 0 && (
                  <div>
                    <Label htmlFor="depends_on">Depends On (Optional)</Label>
                    <Select
                      value={formData.depends_on_task_id}
                      onValueChange={(value) => setFormData({...formData, depends_on_task_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No dependency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No dependency</SelectItem>
                        {tasks.filter(t => t.status !== "completed").map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.task_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional context or instructions..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowCreateForm(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTask}
                    disabled={creating || !formData.task_title || !formData.assigned_team}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {creating ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Tasks */}
          {pendingTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Active Tasks</h3>
              {pendingTasks.map((task) => (
                <Card key={task.id} className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            task.priority === "urgent" ? "bg-red-600" :
                            task.priority === "high" ? "bg-orange-600" :
                            task.priority === "normal" ? "bg-blue-600" :
                            "bg-gray-600"
                          }>
                            {task.priority}
                          </Badge>
                          {task.status === "in_progress" && (
                            <Badge className="bg-green-500">
                              <PlayCircle className="w-3 h-3 mr-1" />
                              In Progress
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900">{task.task_title}</h4>
                        {task.task_description && (
                          <p className="text-sm text-gray-700 mt-1">{task.task_description}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-500" />
                        <span>{task.assigned_team.replace(/_/g, ' ')}</span>
                      </div>
                      {task.due_date && (
                        <div className={`flex items-center gap-1 ${getDueDateColor(task.due_date)}`}>
                          <Calendar className="w-3 h-3" />
                          <span className="font-semibold">{getDueDateLabel(task.due_date)}</span>
                        </div>
                      )}
                      {task.depends_on_task_id && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <LinkIcon className="w-3 h-3" />
                          <span>Has dependency</span>
                        </div>
                      )}
                      {task.estimated_duration && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{task.estimated_duration}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {task.status === "pending" && (
                        <Button
                          onClick={() => handleUpdateTaskStatus(task.id, "in_progress")}
                          size="sm"
                          variant="outline"
                          className="border-green-300 text-green-700"
                        >
                          <PlayCircle className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          const notes = prompt("Completion notes (optional):");
                          if (notes !== null) {
                            handleUpdateTaskStatus(task.id, "completed", notes);
                          }
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                      <Button
                        onClick={() => {
                          const note = prompt("Add progress update:");
                          if (note) handleAddUpdate(task.id, note);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Update
                      </Button>
                    </div>

                    {task.updates && task.updates.length > 0 && (
                      <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Updates:</p>
                        {task.updates.map((update, idx) => (
                          <div key={idx} className="text-xs text-gray-600 mb-1">
                            <span className="font-semibold">{format(new Date(update.timestamp), "MMM d h:mm a")}</span>
                            {" - "}{update.note}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Blocked Tasks */}
          {blockedTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-orange-900">Blocked Tasks</h3>
              {blockedTasks.map((task) => (
                <Card key={task.id} className="border-2 border-orange-200 bg-orange-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{task.task_title}</p>
                        <p className="text-xs text-gray-600">Waiting on another task to complete</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-green-900">Completed Tasks</h3>
              {completedTasks.slice(0, 5).map((task) => (
                <Card key={task.id} className="border border-green-200 bg-green-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm line-through">{task.task_title}</p>
                        <p className="text-xs text-gray-600">
                          Completed {format(new Date(task.completed_at), "MMM d 'at' h:mm a")}
                          {task.completion_notes && ` - ${task.completion_notes}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {tasks.length === 0 && !showCreateForm && (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No tasks yet. Create tasks to track exception resolution.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}