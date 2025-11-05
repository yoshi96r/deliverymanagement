import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, TrendingUp, Package, Truck, AlertTriangle, 
  DollarSign, Clock, CheckCircle2, Users, Calendar 
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState(7); // Last 7 days

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date', 1000),
    initialData: [],
  });

  const { data: exceptions } = useQuery({
    queryKey: ['allExceptions'],
    queryFn: () => base44.entities.DeliveryException.list('-timestamp', 500),
    initialData: [],
  });

  const { data: earnings } = useQuery({
    queryKey: ['carrierEarnings'],
    queryFn: () => base44.entities.CarrierEarnings.list('-earned_date', 500),
    initialData: [],
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const startDate = startOfDay(subDays(now, dateRange));
    
    const recentDeliveries = deliveries.filter(d => 
      new Date(d.created_date) >= startDate
    );

    const recentExceptions = exceptions.filter(e => 
      new Date(e.timestamp) >= startDate
    );

    const recentEarnings = earnings.filter(e => 
      new Date(e.earned_date) >= startDate
    );

    return {
      totalDeliveries: recentDeliveries.length,
      completedDeliveries: recentDeliveries.filter(d => d.status === 'delivered').length,
      activeDeliveries: recentDeliveries.filter(d => d.status === 'out_for_delivery').length,
      totalExceptions: recentExceptions.length,
      totalRevenue: recentEarnings.reduce((sum, e) => sum + (e.amount_earned || 0), 0),
      avgDeliveryTime: recentDeliveries.filter(d => d.delivery_timestamp && d.scheduled_delivery_date)
        .reduce((sum, d) => {
          const scheduled = new Date(d.scheduled_delivery_date);
          const delivered = new Date(d.delivery_timestamp);
          return sum + Math.abs(delivered - scheduled) / (1000 * 60 * 60);
        }, 0) / Math.max(recentDeliveries.filter(d => d.delivery_timestamp).length, 1),
      onTimeRate: (() => {
        const completed = recentDeliveries.filter(d => d.delivery_timestamp && d.scheduled_delivery_date);
        const onTime = completed.filter(d => {
          const scheduled = new Date(d.scheduled_delivery_date);
          const delivered = new Date(d.delivery_timestamp);
          return delivered <= scheduled;
        });
        return completed.length > 0 ? (onTime.length / completed.length * 100) : 0;
      })(),
      exceptionRate: recentDeliveries.length > 0 
        ? (recentExceptions.length / recentDeliveries.length * 100) 
        : 0,
    };
  }, [deliveries, exceptions, earnings, dateRange]);

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const days = [];
    for (let i = dateRange - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const dayDeliveries = deliveries.filter(d => {
        const created = new Date(d.created_date);
        return created >= dayStart && created <= dayEnd;
      });

      const dayExceptions = exceptions.filter(e => {
        const timestamp = new Date(e.timestamp);
        return timestamp >= dayStart && timestamp <= dayEnd;
      });

      days.push({
        date: format(date, 'MMM dd'),
        deliveries: dayDeliveries.length,
        completed: dayDeliveries.filter(d => d.status === 'delivered').length,
        exceptions: dayExceptions.length,
      });
    }
    return days;
  }, [deliveries, exceptions, dateRange]);

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const statusCounts = {};
    deliveries.forEach(d => {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
    }));
  }, [deliveries]);

  // Exception breakdown
  const exceptionBreakdown = useMemo(() => {
    const typeCounts = {};
    exceptions.forEach(e => {
      typeCounts[e.exception_type] = (typeCounts[e.exception_type] || 0) + 1;
    });
    return Object.entries(typeCounts)
      .map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [exceptions]);

  // Top drivers
  const topDrivers = useMemo(() => {
    const driverStats = {};
    deliveries.forEach(d => {
      if (!d.carrier_email) return;
      if (!driverStats[d.carrier_email]) {
        driverStats[d.carrier_email] = {
          name: d.carrier_name || d.carrier_email,
          email: d.carrier_email,
          deliveries: 0,
          completed: 0,
        };
      }
      driverStats[d.carrier_email].deliveries++;
      if (d.status === 'delivered') {
        driverStats[d.carrier_email].completed++;
      }
    });
    return Object.values(driverStats)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  }, [deliveries]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-blue-600" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">Real-time insights into delivery operations</p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6 flex gap-2">
          {[7, 14, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                dateRange === days
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-blue-600" />
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">Total Deliveries</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{metrics.totalDeliveries}</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.completedDeliveries} completed</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">On-Time Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{metrics.onTimeRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Delivered on time</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">Exception Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{metrics.exceptionRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.totalExceptions} exceptions</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">${metrics.totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Earnings paid out</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="trends" className="mb-8">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-md">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="mt-4">
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle>Daily Delivery Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="deliveries" stroke="#3b82f6" strokeWidth={2} name="Total Deliveries" />
                    <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                    <Line type="monotone" dataKey="exceptions" stroke="#ef4444" strokeWidth={2} name="Exceptions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-2 border-green-200">
                <CardHeader>
                  <CardTitle>Delivery Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle>Status Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statusBreakdown.map((status, index) => (
                      <div key={status.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-semibold text-gray-900 capitalize">{status.name}</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">{status.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            <Card className="border-2 border-red-200">
              <CardHeader>
                <CardTitle>Top Exception Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={exceptionBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" name="Exceptions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers" className="mt-4">
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Top Performing Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topDrivers.map((driver, index) => (
                    <div key={driver.email} className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-purple-300 transition-all">
                      <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{driver.name}</p>
                        <p className="text-sm text-gray-600">{driver.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-900">{driver.completed}</p>
                        <p className="text-xs text-gray-600">of {driver.deliveries} total</p>
                      </div>
                      <div className="w-20">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-600"
                            style={{ width: `${(driver.completed / driver.deliveries * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-center text-gray-600 mt-1">
                          {((driver.completed / driver.deliveries * 100).toFixed(0))}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardContent className="p-6">
              <Truck className="w-8 h-8 text-orange-600 mb-3" />
              <p className="text-sm font-semibold text-orange-900 mb-2">Active Deliveries</p>
              <p className="text-3xl font-bold text-orange-900">{metrics.activeDeliveries}</p>
              <p className="text-xs text-orange-700 mt-2">Currently out for delivery</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-blue-600 mb-3" />
              <p className="text-sm font-semibold text-blue-900 mb-2">Avg Delivery Time</p>
              <p className="text-3xl font-bold text-blue-900">{metrics.avgDeliveryTime.toFixed(1)}h</p>
              <p className="text-xs text-blue-700 mt-2">From scheduled to delivered</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-3" />
              <p className="text-sm font-semibold text-green-900 mb-2">Success Rate</p>
              <p className="text-3xl font-bold text-green-900">
                {((metrics.completedDeliveries / Math.max(metrics.totalDeliveries, 1)) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-green-700 mt-2">Completed successfully</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}