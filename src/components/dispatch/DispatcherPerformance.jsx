import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Clock, CheckCircle2, User, Award } from "lucide-react";
import { format } from "date-fns";

export default function DispatcherPerformance() {
  const { data: dispatchers } = useQuery({
    queryKey: ['dispatchers'],
    queryFn: () => base44.entities.Dispatcher.list('-performance_rating'),
    initialData: [],
  });

  const { data: assignments } = useQuery({
    queryKey: ['dispatcherAssignments'],
    queryFn: () => base44.entities.DispatcherAssignment.list('-assigned_at', 100),
    initialData: [],
  });

  const activeDispatchers = dispatchers.filter(d => d.status !== 'offline');
  const totalWorkload = dispatchers.reduce((sum, d) => sum + (d.current_workload || 0), 0);
  const avgResolutionTime = dispatchers.reduce((sum, d) => sum + (d.average_resolution_time_minutes || 0), 0) / (dispatchers.length || 1);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-900">{activeDispatchers.length}</p>
            <p className="text-sm text-gray-600">Active Dispatchers</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto text-purple-600 mb-2" />
            <p className="text-3xl font-bold text-purple-900">{totalWorkload}</p>
            <p className="text-sm text-gray-600">Total Active Tasks</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-900">
              {assignments.filter(a => a.status === 'resolved').length}
            </p>
            <p className="text-sm text-gray-600">Resolved Today</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-orange-900">{Math.round(avgResolutionTime)}</p>
            <p className="text-sm text-gray-600">Avg Resolution (min)</p>
          </CardContent>
        </Card>
      </div>

      {/* Dispatcher List */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Dispatcher Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {dispatchers.map((dispatcher) => (
              <Card key={dispatcher.id} className={`border-2 ${
                dispatcher.status === 'available' ? 'border-green-200 bg-green-50' :
                dispatcher.status === 'busy' ? 'border-orange-200 bg-orange-50' :
                'border-gray-200'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        dispatcher.status === 'available' ? 'bg-green-200' :
                        dispatcher.status === 'busy' ? 'bg-orange-200' :
                        'bg-gray-200'
                      }`}>
                        <User className={`w-5 h-5 ${
                          dispatcher.status === 'available' ? 'text-green-700' :
                          dispatcher.status === 'busy' ? 'text-orange-700' :
                          'text-gray-700'
                        }`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{dispatcher.full_name}</p>
                        <p className="text-sm text-gray-600">{dispatcher.email}</p>
                      </div>
                    </div>
                    <Badge className={
                      dispatcher.status === 'available' ? 'bg-green-600' :
                      dispatcher.status === 'busy' ? 'bg-orange-600' :
                      'bg-gray-600'
                    }>
                      {dispatcher.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="text-center p-2 bg-white rounded">
                      <p className="font-bold text-blue-900">{dispatcher.primary_team?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-600">Primary Team</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <p className="font-bold text-purple-900">
                        {dispatcher.current_workload}/{dispatcher.max_concurrent_assignments}
                      </p>
                      <p className="text-xs text-gray-600">Workload</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <p className="font-bold text-green-900">{dispatcher.total_assignments_handled || 0}</p>
                      <p className="text-xs text-gray-600">Total Handled</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <p className="font-bold text-orange-900">
                        {Math.round(dispatcher.average_resolution_time_minutes || 0)}m
                      </p>
                      <p className="text-xs text-gray-600">Avg Time</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <p className="font-bold text-yellow-900">{dispatcher.performance_rating?.toFixed(1)}/10</p>
                      <p className="text-xs text-gray-600">Rating</p>
                    </div>
                  </div>

                  {dispatcher.last_assignment_time && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last assignment: {format(new Date(dispatcher.last_assignment_time), "MMM d 'at' h:mm a")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {dispatchers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No dispatchers in the system</p>
                <p className="text-sm mt-2">Add dispatchers to enable auto-assignment</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Assignments */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle>Recent Assignment Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2">
            {assignments.slice(0, 10).map((assignment) => (
              <div key={assignment.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{assignment.dispatcher_name}</p>
                    <p className="text-xs text-gray-600">{assignment.tracking_number}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={
                      assignment.status === 'resolved' ? 'bg-green-600' :
                      assignment.status === 'in_progress' ? 'bg-blue-600' :
                      'bg-orange-600'
                    }>
                      {assignment.status}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(assignment.assigned_at), "MMM d h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Badge variant="outline">{assignment.team_assigned?.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{assignment.priority}</Badge>
                  <span className="text-gray-500">• {assignment.assignment_method?.replace(/_/g, ' ')}</span>
                </div>
                {assignment.resolution_time_minutes && (
                  <p className="text-xs text-green-700 mt-1">
                    Resolved in {Math.round(assignment.resolution_time_minutes)} minutes
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}