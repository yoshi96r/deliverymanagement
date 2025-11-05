import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Zap, Plus, Play, Pause, Clock, CheckCircle2,
  AlertTriangle, Settings, Calendar, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AutomationHub() {
  const [showCreate, setShowCreate] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    automation_name: "",
    automation_type: "auto_route_assignment",
    schedule_type: "daily",
    schedule_time: "08:00",
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: automations } = useQuery({
    queryKey: ['scheduledAutomations'],
    queryFn: () => base44.entities.ScheduledAutomation.list('-created_date'),
    initialData: [],
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.ScheduledAutomation.create({
        ...data,
        total_executions: 0,
        success_count: 0,
        failure_count: 0,
        created_by: "Admin"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledAutomations'] });
      toast.success("Automation created!");
      setShowCreate(false);
      setNewAutomation({
        automation_name: "",
        automation_type: "auto_route_assignment",
        schedule_type: "daily",
        schedule_time: "08:00",
        is_active: true
      });
    },
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      await base44.entities.ScheduledAutomation.update(id, { is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledAutomations'] });
      toast.success("Automation updated");
    },
  });

  const automationTemplates = [
    {
      type: "auto_route_assignment",
      name: "Daily Route Assignment",
      description: "Automatically assign routes to drivers every morning",
      icon: Calendar,
      recommendedSchedule: "daily @ 6:00 AM"
    },
    {
      type: "report_generation",
      name: "Weekly Performance Reports",
      description: "Generate and email weekly performance summaries",
      icon: BarChart3,
      recommendedSchedule: "weekly on Monday @ 8:00 AM"
    },
    {
      type: "payment_batch_creation",
      name: "Bi-Weekly Payment Processing",
      description: "Create payment batches for driver earnings",
      icon: Clock,
      recommendedSchedule: "every 2 weeks on Friday"
    },
    {
      type: "compliance_check",
      name: "Monthly Compliance Review",
      description: "Check driver licenses, vehicle insurance, DOT compliance",
      icon: AlertTriangle,
      recommendedSchedule: "monthly on 1st @ 9:00 AM"
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Zap className="w-10 h-10 text-purple-600" />
            Automation Hub
          </h1>
          <p className="text-gray-600">Schedule automated tasks and workflows</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Zap className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">
                {automations.filter(a => a.is_active).length}
              </p>
              <p className="text-sm text-gray-600">Active Automations</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">
                {automations.reduce((sum, a) => sum + (a.success_count || 0), 0)}
              </p>
              <p className="text-sm text-gray-600">Successful Runs</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">
                {automations.filter(a => a.last_run_at).length}
              </p>
              <p className="text-sm text-gray-600">Executed Today</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Settings className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{automations.length}</p>
              <p className="text-sm text-gray-600">Total Configured</p>
            </CardContent>
          </Card>
        </div>

        {/* Templates */}
        {!showCreate && (
          <Card className="border-2 border-blue-200 mb-8">
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-blue-900">Automation Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {automationTemplates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <Card key={template.type} className="border-2 border-gray-200 hover:border-blue-300 transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Icon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 mb-1">{template.name}</h4>
                            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                            <Badge variant="outline" className="text-xs">
                              {template.recommendedSchedule}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-blue-600"
                          onClick={() => {
                            setNewAutomation({
                              ...newAutomation,
                              automation_name: template.name,
                              automation_type: template.type
                            });
                            setShowCreate(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {!showCreate && (
                <Button
                  onClick={() => setShowCreate(true)}
                  className="w-full bg-purple-600 h-12"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Custom Automation
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create Form */}
        {showCreate && (
          <Card className="border-2 border-purple-300 mb-8">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600">
              <CardTitle className="text-white">Create New Automation</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Automation Name</Label>
                <Input
                  value={newAutomation.automation_name}
                  onChange={(e) => setNewAutomation({...newAutomation, automation_name: e.target.value})}
                  placeholder="Daily morning route assignment"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Automation Type</Label>
                  <Select
                    value={newAutomation.automation_type}
                    onValueChange={(v) => setNewAutomation({...newAutomation, automation_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_route_assignment">Route Assignment</SelectItem>
                      <SelectItem value="report_generation">Report Generation</SelectItem>
                      <SelectItem value="payment_batch_creation">Payment Batch</SelectItem>
                      <SelectItem value="compliance_check">Compliance Check</SelectItem>
                      <SelectItem value="notification_send">Send Notifications</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Schedule</Label>
                  <Select
                    value={newAutomation.schedule_type}
                    onValueChange={(v) => setNewAutomation({...newAutomation, schedule_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every Hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Run Time</Label>
                <Input
                  type="time"
                  value={newAutomation.schedule_time}
                  onChange={(e) => setNewAutomation({...newAutomation, schedule_time: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Switch
                  checked={newAutomation.is_active}
                  onCheckedChange={(checked) => setNewAutomation({...newAutomation, is_active: checked})}
                />
                <Label>Start automation immediately</Label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowCreate(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createAutomationMutation.mutate(newAutomation)}
                  disabled={!newAutomation.automation_name || createAutomationMutation.isPending}
                  className="flex-1 bg-purple-600"
                >
                  Create Automation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Automations */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Active Automations</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {automations.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No automations configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map((automation) => (
                  <Card key={automation.id} className="border-2 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-900">{automation.automation_name}</h4>
                            <Badge className={automation.is_active ? "bg-green-600" : "bg-gray-600"}>
                              {automation.is_active ? "Active" : "Paused"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Schedule</p>
                              <p className="font-semibold">{automation.schedule_type} @ {automation.schedule_time}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Last Run</p>
                              <p className="font-semibold">
                                {automation.last_run_at 
                                  ? format(new Date(automation.last_run_at), "MMM d, h:mm a")
                                  : "Never"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Success Rate</p>
                              <p className="font-semibold">
                                {automation.total_executions > 0
                                  ? `${((automation.success_count / automation.total_executions) * 100).toFixed(0)}%`
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={(checked) => 
                            toggleAutomationMutation.mutate({ id: automation.id, isActive: checked })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}