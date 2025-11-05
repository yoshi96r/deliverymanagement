import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, AlertTriangle, CheckCircle2, Calendar,
  TrendingUp, User, FileText
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { toast } from "sonner";

export default function HOSManagement() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const queryClient = useQueryClient();

  const { data: hosLogs } = useQuery({
    queryKey: ['hosLogs'],
    queryFn: () => base44.entities.HOSLog.list('-log_date', 500),
    initialData: [],
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
    initialData: [],
  });

  // Get today's logs
  const todayLogs = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return hosLogs.filter(log => log.log_date === today);
  }, [hosLogs]);

  // Get violations
  const violations = useMemo(() => {
    return hosLogs.filter(log => log.violation_detected);
  }, [hosLogs]);

  // Driver compliance status
  const driverStatus = useMemo(() => {
    const statusMap = {};
    
    drivers.forEach(driver => {
      const driverLogs = todayLogs.filter(l => l.driver_id === driver.driver_id || l.driver_email === driver.email);
      const latestLog = driverLogs.sort((a, b) => 
        new Date(b.status_start_time) - new Date(a.status_start_time)
      )[0];

      if (latestLog) {
        statusMap[driver.email] = {
          driver,
          currentStatus: latestLog.duty_status,
          driveTimeRemaining: latestLog.remaining_drive_time || 0,
          onDutyTimeRemaining: latestLog.remaining_on_duty_time || 0,
          hasViolation: driverLogs.some(l => l.violation_detected),
          needsBreak: latestLog.remaining_drive_time < 30,
          lastUpdate: latestLog.status_start_time
        };
      }
    });

    return Object.values(statusMap);
  }, [drivers, todayLogs]);

  const driversNeedingBreak = driverStatus.filter(d => d.needsBreak && d.currentStatus === 'driving');
  const driversInViolation = driverStatus.filter(d => d.hasViolation);
  const activelyCertified = todayLogs.filter(l => l.certified).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Clock className="w-10 h-10 text-blue-600" />
            Hours of Service (HOS) Management
          </h1>
          <p className="text-gray-600">Track driver hours and ensure FMCSA compliance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Active Drivers</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{driverStatus.length}</p>
                </div>
                <User className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Violations</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{violations.length}</p>
                </div>
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Need Break</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{driversNeedingBreak.length}</p>
                </div>
                <Clock className="w-12 h-12 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Certified Logs</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{activelyCertified}</p>
                </div>
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="drivers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-md">
            <TabsTrigger value="drivers">
              <User className="w-4 h-4 mr-2" />
              Driver Status
            </TabsTrigger>
            <TabsTrigger value="violations">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Violations
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="space-y-4">
            {driverStatus.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No active driver logs today</p>
                </CardContent>
              </Card>
            ) : (
              driverStatus.map((status) => (
                <Card key={status.driver.email} className={`border-2 ${
                  status.hasViolation ? 'border-red-300 bg-red-50' :
                  status.needsBreak ? 'border-orange-300 bg-orange-50' :
                  'border-gray-200'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{status.driver.full_name}</h3>
                        <p className="text-sm text-gray-600">{status.driver.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={
                          status.currentStatus === 'driving' ? 'bg-green-600' :
                          status.currentStatus === 'on_duty_not_driving' ? 'bg-blue-600' :
                          status.currentStatus === 'sleeper_berth' ? 'bg-purple-600' :
                          'bg-gray-600'
                        }>
                          {status.currentStatus.replace(/_/g, ' ')}
                        </Badge>
                        {status.hasViolation && (
                          <Badge className="bg-red-600 animate-pulse">VIOLATION</Badge>
                        )}
                        {status.needsBreak && (
                          <Badge className="bg-orange-600">BREAK NEEDED</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Drive Time Left</p>
                        <p className={`text-2xl font-bold ${
                          status.driveTimeRemaining < 60 ? 'text-red-900' :
                          status.driveTimeRemaining < 120 ? 'text-orange-900' :
                          'text-green-900'
                        }`}>
                          {Math.floor(status.driveTimeRemaining / 60)}h {status.driveTimeRemaining % 60}m
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">On-Duty Time Left</p>
                        <p className={`text-2xl font-bold ${
                          status.onDutyTimeRemaining < 60 ? 'text-red-900' :
                          status.onDutyTimeRemaining < 120 ? 'text-orange-900' :
                          'text-blue-900'
                        }`}>
                          {Math.floor(status.onDutyTimeRemaining / 60)}h {status.onDutyTimeRemaining % 60}m
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-lg col-span-2">
                        <p className="text-xs text-gray-600 mb-1">Last Update</p>
                        <p className="font-semibold text-gray-900">
                          {format(new Date(status.lastUpdate), "h:mm a")}
                        </p>
                      </div>
                    </div>

                    {status.needsBreak && (
                      <div className="mt-4 p-3 bg-orange-100 rounded-lg border border-orange-300">
                        <p className="text-sm font-semibold text-orange-900">
                          ⚠️ Driver should take a 30-minute break soon to remain compliant
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="violations">
            <Card className="border-2 border-red-200">
              <CardHeader className="bg-red-50">
                <CardTitle className="text-red-900">HOS Violations</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {violations.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
                    <p className="text-gray-600">No HOS violations detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {violations.map((violation) => (
                      <Card key={violation.id} className="border-2 border-red-300">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900">{violation.driver_name}</h4>
                              <p className="text-sm text-gray-600">
                                {format(new Date(violation.log_date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Badge className="bg-red-600">
                              {violation.violation_type?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-800">{violation.violation_details}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-900">Recent HOS Logs</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {todayLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{log.driver_name}</p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(log.status_start_time), "h:mm a")} - {
                              log.status_end_time ? format(new Date(log.status_end_time), "h:mm a") : 'Ongoing'
                            }
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            log.duty_status === 'driving' ? 'bg-green-600' :
                            log.duty_status === 'on_duty_not_driving' ? 'bg-blue-600' :
                            'bg-gray-600'
                          }>
                            {log.duty_status.replace(/_/g, ' ')}
                          </Badge>
                          {log.certified && (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}