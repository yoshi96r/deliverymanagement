import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, TrendingUp, Calendar, Award, CheckCircle2,
  Clock, Star, Package, AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export default function DriverEarningsDetail({ driverEmail, driverName }) {
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const { data: allEarnings, isLoading } = useQuery({
    queryKey: ['detailedEarnings', driverEmail],
    queryFn: () => base44.entities.CarrierEarnings.filter({
      carrier_email: driverEmail
    }),
    initialData: [],
  });

  // Calculate period boundaries
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Filter earnings by period
  const periodEarnings = allEarnings.filter(e => {
    const earnDate = new Date(e.earned_date);
    if (selectedPeriod === "week") {
      return isWithinInterval(earnDate, { start: weekStart, end: weekEnd });
    } else if (selectedPeriod === "month") {
      return isWithinInterval(earnDate, { start: monthStart, end: monthEnd });
    } else {
      return earnDate.toDateString() === now.toDateString();
    }
  });

  // Calculate totals
  const totalEarnings = periodEarnings.reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  const totalBonuses = periodEarnings.reduce((sum, e) => sum + (e.total_bonuses || 0), 0);
  const totalDeductions = periodEarnings.reduce((sum, e) => sum + (e.total_deductions || 0), 0);
  const pendingAmount = periodEarnings
    .filter(e => e.payment_status === 'pending')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  const paidAmount = periodEarnings
    .filter(e => e.payment_status === 'paid')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);

  // Breakdown by earning type
  const earningsByType = periodEarnings.reduce((acc, e) => {
    const type = e.earning_type || 'other';
    if (!acc[type]) {
      acc[type] = { count: 0, amount: 0 };
    }
    acc[type].count++;
    acc[type].amount += e.amount_earned || 0;
    return acc;
  }, {});

  // All time stats
  const allTimeTotal = allEarnings.reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  const allTimePaid = allEarnings
    .filter(e => e.payment_status === 'paid')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  const allTimePending = allEarnings
    .filter(e => e.payment_status === 'pending')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);

  const earningTypeIcons = {
    delivery: Package,
    checkpoint: CheckCircle2,
    bonus: Award,
    premium_care: Star,
    route_completion: TrendingUp,
    on_time_bonus: Clock,
    safety_bonus: CheckCircle2,
    performance_bonus: TrendingUp
  };

  const paymentStatusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    processing: "bg-blue-100 text-blue-800 border-blue-300",
    approved: "bg-purple-100 text-purple-800 border-purple-300",
    paid: "bg-green-100 text-green-800 border-green-300",
    on_hold: "bg-orange-100 text-orange-800 border-orange-300",
    cancelled: "bg-red-100 text-red-800 border-red-300"
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading earnings data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
        <TabsList className="grid w-full grid-cols-3 bg-white shadow-md">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 mb-1">Total Earnings</p>
            <p className="text-3xl font-bold text-green-900">${totalEarnings.toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <p className="text-xs text-green-700">{periodEarnings.length} transactions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 mb-1">Pending Payment</p>
            <p className="text-3xl font-bold text-purple-900">${pendingAmount.toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-2">
              <Clock className="w-3 h-3 text-purple-600" />
              <p className="text-xs text-purple-700">Awaiting payout</p>
            </div>
          </CardContent>
        </Card>

        {totalBonuses > 0 && (
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <p className="text-xs text-gray-600 mb-1">Bonuses Earned</p>
              <p className="text-3xl font-bold text-blue-900">+${totalBonuses.toFixed(2)}</p>
              <div className="flex items-center gap-1 mt-2">
                <Award className="w-3 h-3 text-blue-600" />
                <p className="text-xs text-blue-700">Extra earnings</p>
              </div>
            </CardContent>
          </Card>
        )}

        {totalDeductions > 0 && (
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
            <CardContent className="p-4">
              <p className="text-xs text-gray-600 mb-1">Deductions</p>
              <p className="text-3xl font-bold text-red-900">-${totalDeductions.toFixed(2)}</p>
              <div className="flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3 text-red-600" />
                <p className="text-xs text-red-700">Applied fees</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Earnings Breakdown by Type */}
      {Object.keys(earningsByType).length > 0 && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Earnings Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(earningsByType).map(([type, data]) => {
              const Icon = earningTypeIcons[type] || DollarSign;
              const percentage = (data.amount / totalEarnings) * 100;

              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold capitalize">
                        {type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">${data.amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-600">{data.count} items</p>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {periodEarnings.length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">No earnings in this period</p>
          ) : (
            <div className="space-y-2">
              {periodEarnings
                .sort((a, b) => new Date(b.earned_date) - new Date(a.earned_date))
                .map((earning) => {
                  const Icon = earningTypeIcons[earning.earning_type] || DollarSign;
                  
                  return (
                    <div 
                      key={earning.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {earning.earning_type.replace(/_/g, ' ')}
                            </p>
                            {earning.tracking_number && (
                              <p className="text-xs font-mono text-gray-600 truncate">
                                {earning.tracking_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-700">
                            ${earning.amount_earned.toFixed(2)}
                          </p>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${paymentStatusColors[earning.payment_status]}`}
                          >
                            {earning.payment_status}
                          </Badge>
                        </div>
                      </div>

                      {/* Bonuses */}
                      {earning.bonuses && earning.bonuses.length > 0 && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-1">💰 Bonuses:</p>
                          {earning.bonuses.map((bonus, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-blue-800">{bonus.reason}</span>
                              <span className="font-bold text-blue-900">+${bonus.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Deductions */}
                      {earning.deductions && earning.deductions.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                          <p className="text-xs font-semibold text-red-900 mb-1">⚠️ Deductions:</p>
                          {earning.deductions.map((deduction, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-red-800">{deduction.reason}</span>
                              <span className="font-bold text-red-900">-${deduction.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-gray-600">
                          {format(new Date(earning.earned_date), "MMM d 'at' h:mm a")}
                        </span>
                        {earning.payment_date && (
                          <span className="text-xs text-green-700">
                            Paid: {format(new Date(earning.payment_date), "MMM d")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Time Summary */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            All Time Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-white rounded-lg border border-indigo-200">
              <p className="text-2xl font-bold text-indigo-900">${allTimeTotal.toFixed(2)}</p>
              <p className="text-xs text-gray-600">Total Earned</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-green-200">
              <p className="text-2xl font-bold text-green-900">${allTimePaid.toFixed(2)}</p>
              <p className="text-xs text-gray-600">Paid Out</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-900">${allTimePending.toFixed(2)}</p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-indigo-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Transactions</span>
              <span className="font-bold text-indigo-900">{allEarnings.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Info */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900 mb-1">Payment Schedule</p>
              <p className="text-xs text-blue-800">
                Earnings are paid out every Friday via direct deposit. Pending earnings will be processed in the next payment cycle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No Earnings Message */}
      {allEarnings.length === 0 && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-8 text-center">
            <DollarSign className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 text-lg mb-2">No earnings yet</p>
            <p className="text-sm text-gray-500">
              Complete deliveries with photo proof to start earning!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}