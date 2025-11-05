
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Package, Truck, AlertTriangle, DollarSign, Clock,
  TrendingUp, CheckCircle2, Users, Calendar, MapPin,
  Bell, Search, Zap, ArrowRight, Activity
} from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Home() {
  const [timeRange, setTimeRange] = useState("today");

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        return user;
      } catch (error) {
        return { role: "demo" };
      }
    },
    initialData: { role: "demo" }
  });

  // Redirect demo users to demo home
  React.useEffect(() => {
    if (currentUser?.role === "demo") {
      window.location.href = createPageUrl("DemoHome");
    }
  }, [currentUser]);

  const { data: deliveries } = useQuery({
    queryKey: ['recentDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date', 100),
    initialData: [],
  });

  const { data: exceptions } = useQuery({
    queryKey: ['recentExceptions'],
    queryFn: () => base44.entities.DeliveryException.list('-timestamp', 50),
    initialData: [],
  });

  const { data: earnings } = useQuery({
    queryKey: ['recentEarnings'],
    queryFn: () => base44.entities.CarrierEarnings.list('-earned_date', 50),
    initialData: [],
  });

  const { data: routes } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => base44.entities.RouteSchedule.filter({ status: 'in_progress' }),
    initialData: [],
  });

  const { data: activities } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: () => base44.entities.ActivityLog.list('-timestamp', 10),
    initialData: [],
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const todayDeliveries = deliveries.filter(d => 
      new Date(d.created_date).toDateString() === today
    );
    const todayExceptions = exceptions.filter(e =>
      new Date(e.timestamp).toDateString() === today
    );
    const todayEarnings = earnings.filter(e =>
      new Date(e.earned_date).toDateString() === today
    );

    return {
      totalDeliveries: todayDeliveries.length,
      completedDeliveries: todayDeliveries.filter(d => d.status === 'delivered').length,
      activeDeliveries: todayDeliveries.filter(d => d.status === 'out_for_delivery').length,
      pendingDeliveries: todayDeliveries.filter(d => d.status === 'pending' || d.status === 'signed').length,
      todayExceptions: todayExceptions.length,
      criticalExceptions: todayExceptions.filter(e => e.severity === 'critical' || e.severity === 'high').length,
      todayEarnings: todayEarnings.reduce((sum, e) => sum + e.amount_earned, 0),
      activeRoutes: routes.length,
      completionRate: todayDeliveries.length > 0 
        ? (todayDeliveries.filter(d => d.status === 'delivered').length / todayDeliveries.length * 100)
        : 0
    };
  }, [deliveries, exceptions, earnings, routes]);

  // Quick stats data for chart
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const hour = i + 8; // 8 AM to 7 PM
      const hourDeliveries = deliveries.filter(d => {
        const date = new Date(d.created_date);
        return date.getHours() === hour && date.toDateString() === new Date().toDateString();
      });
      return {
        hour: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`,
        deliveries: hourDeliveries.length,
        completed: hourDeliveries.filter(d => d.status === 'delivered').length
      };
    });
    return hours;
  }, [deliveries]);

  const quickActions = [
    { label: "New Delivery", icon: Package, url: "CarrierDashboard", color: "blue" },
    { label: "Driver Mobile", icon: Truck, url: "DriverMobile", color: "green" },
    { label: "Live Fleet", icon: MapPin, url: "FleetMap", color: "purple" },
    { label: "Analytics", icon: TrendingUp, url: "AnalyticsDashboard", color: "orange" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
          </div>
          <div className="flex gap-2">
            {["today", "week", "month"].map((range) => (
              <Button
                key={range}
                onClick={() => setTimeRange(range)}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                className={timeRange === range ? "bg-blue-600" : ""}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} to={createPageUrl(action.url)}>
                <Card className={`border-2 border-${action.color}-200 hover:shadow-lg transition-all cursor-pointer hover:scale-105`}>
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-${action.color}-100 flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 text-${action.color}-600`} />
                    </div>
                    <p className="font-semibold text-gray-900">{action.label}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <Badge className="bg-green-600 text-white">
                  {metrics.completionRate.toFixed(0)}%
                </Badge>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Completed Today</p>
              <p className="text-3xl font-bold text-gray-900">{metrics.completedDeliveries}</p>
              <p className="text-xs text-gray-500 mt-1">of {metrics.totalDeliveries} deliveries</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Truck className="w-8 h-8 text-blue-600" />
                <Badge className="bg-blue-600 text-white">Active</Badge>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Out for Delivery</p>
              <p className="text-3xl font-bold text-gray-900">{metrics.activeDeliveries}</p>
              <p className="text-xs text-gray-500 mt-1">{routes.length} active routes</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <Badge className={metrics.criticalExceptions > 0 ? "bg-red-600" : "bg-orange-600"}>
                  {metrics.criticalExceptions} Critical
                </Badge>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Exceptions</p>
              <p className="text-3xl font-bold text-gray-900">{metrics.todayExceptions}</p>
              <p className="text-xs text-gray-500 mt-1">Needs attention</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-purple-600" />
                <Badge className="bg-purple-600 text-white">Today</Badge>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Earnings</p>
              <p className="text-3xl font-bold text-gray-900">${metrics.todayEarnings.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Processed payments</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hourly Activity Chart */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Today's Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="deliveries" fill="#3b82f6" name="Deliveries" />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="border-2 border-gray-200">
            <CardHeader className="bg-gray-50">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {activities.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No recent activity</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-600"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(activity.timestamp), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 border-gray-200">
            <CardHeader className="bg-gray-50 flex flex-row items-center justify-between">
              <CardTitle>Delivery Pipeline</CardTitle>
              <Link to={createPageUrl("PackageManagement")}>
                <Button size="sm" variant="outline">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-gray-900">Pending</span>
                  </div>
                  <span className="text-2xl font-bold text-yellow-900">{metrics.pendingDeliveries}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Active</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-900">{metrics.activeDeliveries}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900">Completed</span>
                  </div>
                  <span className="text-2xl font-bold text-green-900">{metrics.completedDeliveries}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200">
            <CardHeader className="bg-gray-50 flex flex-row items-center justify-between">
              <CardTitle>Active Routes</CardTitle>
              <Link to={createPageUrl("FleetMap")}>
                <Button size="sm" variant="outline">
                  Track Live <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6">
              {routes.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600">No active routes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {routes.slice(0, 3).map((route) => (
                    <div key={route.id} className="p-3 bg-white border-2 border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-900">{route.route_name}</p>
                        <Badge className="bg-blue-600">{route.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{route.assigned_driver_name}</span>
                        <span className="font-semibold text-gray-900">{route.total_stops} stops</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
