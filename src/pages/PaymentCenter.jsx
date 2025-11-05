
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, Users, CheckCircle2, Clock, 
  TrendingUp, Calendar, Download, CreditCard
} from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

export default function PaymentCenter() {
  const queryClient = useQueryClient();

  const { data: earnings } = useQuery({
    queryKey: ['allEarnings'],
    queryFn: () => base44.entities.CarrierEarnings.list('-earned_date', 500),
    initialData: [],
  });

  const { data: batches } = useQuery({
    queryKey: ['paymentBatches'],
    queryFn: () => base44.entities.PaymentBatch.list('-created_date'),
    initialData: [],
  });

  const { data: drivers } = useQuery({
    queryKey: ['driversPayment'],
    queryFn: () => base44.entities.Driver.list(),
    initialData: [],
  });

  const createBatchMutation = useMutation({
    mutationFn: async ({ startDate, endDate }) => {
      const periodEarnings = earnings.filter(e => {
        const earnedDate = new Date(e.earned_date);
        return earnedDate >= new Date(startDate) && earnedDate <= new Date(endDate) &&
               e.payment_status === 'pending';
      });

      const totalEarnings = periodEarnings.reduce((sum, e) => sum + e.amount_earned, 0);
      const totalBonuses = periodEarnings.reduce((sum, e) => sum + (e.total_bonuses || 0), 0);
      const totalDeductions = periodEarnings.reduce((sum, e) => sum + (e.total_deductions || 0), 0);

      const uniqueDrivers = new Set(periodEarnings.map(e => e.carrier_email)).size;

      const batch = await base44.entities.PaymentBatch.create({
        batch_number: `BATCH-${Date.now()}`,
        pay_period_start: startDate,
        pay_period_end: endDate,
        total_drivers: uniqueDrivers,
        total_earnings: totalEarnings,
        total_bonuses: totalBonuses,
        total_deductions: totalDeductions,
        net_amount: totalEarnings + totalBonuses - totalDeductions,
        payment_method: "direct_deposit",
        status: "pending_approval",
        created_by: "System Admin",
        earnings_included: periodEarnings.map(e => e.id)
      });

      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentBatches'] });
      toast.success("Payment batch created!");
    },
  });

  const approveBatchMutation = useMutation({
    mutationFn: async (batchId) => {
      await base44.entities.PaymentBatch.update(batchId, {
        status: "approved",
        approved_by: "Admin",
        approved_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentBatches'] });
      toast.success("Batch approved!");
    },
  });

  const thisWeekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
  const thisWeekEnd = format(endOfWeek(new Date()), 'yyyy-MM-dd');

  const pendingEarnings = earnings.filter(e => e.payment_status === 'pending');
  const totalPending = pendingEarnings.reduce((sum, e) => sum + e.amount_earned, 0);

  const thisWeekEarnings = earnings.filter(e => {
    const earnedDate = new Date(e.earned_date);
    return earnedDate >= new Date(thisWeekStart) && earnedDate <= new Date(thisWeekEnd);
  });

  const driverEarnings = useMemo(() => {
    const byDriver = {};
    earnings.forEach(e => {
      if (!byDriver[e.carrier_email]) {
        byDriver[e.carrier_email] = {
          email: e.carrier_email,
          name: e.carrier_name,
          total: 0,
          pending: 0,
          paid: 0,
          deliveries: 0
        };
      }
      byDriver[e.carrier_email].total += e.amount_earned;
      if (e.payment_status === 'pending') byDriver[e.carrier_email].pending += e.amount_earned;
      if (e.payment_status === 'paid') byDriver[e.carrier_email].paid += e.amount_earned;
      byDriver[e.carrier_email].deliveries++;
    });
    return Object.values(byDriver).sort((a, b) => b.total - a.total);
  }, [earnings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <DollarSign className="w-10 h-10 text-green-600" />
            Payment & Billing Center
          </h1>
          <p className="text-gray-600">Manage driver payments and earnings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">${totalPending.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Pending Payment</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{batches.filter(b => b.status === 'approved').length}</p>
              <p className="text-sm text-gray-600">Approved Batches</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Users className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{driverEarnings.length}</p>
              <p className="text-sm text-gray-600">Active Earners</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">
                ${thisWeekEarnings.reduce((sum, e) => sum + e.amount_earned, 0).toFixed(0)}
              </p>
              <p className="text-sm text-gray-600">This Week</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="earnings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-md">
            <TabsTrigger value="earnings">
              <DollarSign className="w-4 h-4 mr-2" />
              Driver Earnings
            </TabsTrigger>
            <TabsTrigger value="batches">
              <CreditCard className="w-4 h-4 mr-2" />
              Payment Batches
            </TabsTrigger>
            <TabsTrigger value="create">
              <Calendar className="w-4 h-4 mr-2" />
              Create Batch
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earnings">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Driver Earnings Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {driverEarnings.map((driver) => (
                    <Card key={driver.email} className="border-2 border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-bold text-gray-900">{driver.name}</h4>
                            <p className="text-sm text-gray-600">{driver.email}</p>
                          </div>
                          <p className="text-2xl font-bold text-green-900">${driver.total.toFixed(2)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Pending</p>
                            <p className="font-bold text-orange-700">${driver.pending.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Paid</p>
                            <p className="font-bold text-green-700">${driver.paid.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Deliveries</p>
                            <p className="font-bold text-gray-900">{driver.deliveries}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batches">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Payment Batches</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {batches.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No payment batches yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {batches.map((batch) => (
                      <Card key={batch.id} className="border-2 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-gray-900">{batch.batch_number}</h4>
                              <p className="text-sm text-gray-600">
                                {format(new Date(batch.pay_period_start), "MMM d")} - {format(new Date(batch.pay_period_end), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Badge className={
                              batch.status === 'completed' ? 'bg-green-600' :
                              batch.status === 'approved' ? 'bg-blue-600' :
                              batch.status === 'pending_approval' ? 'bg-orange-600' :
                              'bg-gray-600'
                            }>
                              {batch.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <p className="text-gray-600">Drivers</p>
                              <p className="font-bold text-gray-900">{batch.total_drivers}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Earnings</p>
                              <p className="font-bold text-gray-900">${batch.total_earnings?.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Bonuses</p>
                              <p className="font-bold text-green-700">+${batch.total_bonuses?.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Net</p>
                              <p className="font-bold text-blue-900">${batch.net_amount?.toFixed(2)}</p>
                            </div>
                          </div>

                          {batch.status === 'pending_approval' && (
                            <Button
                              onClick={() => approveBatchMutation.mutate(batch.id)}
                              className="w-full bg-green-600"
                              size="sm"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Approve Batch
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-green-50">
                <CardTitle className="text-green-900">Create Payment Batch</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-semibold text-blue-900 mb-2">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => createBatchMutation.mutate({
                          startDate: thisWeekStart,
                          endDate: thisWeekEnd
                        })}
                        className="bg-blue-600"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        This Week
                      </Button>
                      <Button
                        onClick={() => {
                          const lastWeekStart = format(startOfWeek(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), 'yyyy-MM-dd');
                          const lastWeekEnd = format(endOfWeek(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), 'yyyy-MM-dd');
                          createBatchMutation.mutate({
                            startDate: lastWeekStart,
                            endDate: lastWeekEnd
                          });
                        }}
                        className="bg-purple-600"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Last Week
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="font-semibold text-orange-900 mb-2">Pending Payments</p>
                    <p className="text-3xl font-bold text-orange-900 mb-1">
                      ${totalPending.toFixed(2)}
                    </p>
                    <p className="text-sm text-orange-700">
                      {pendingEarnings.length} earnings records ready to process
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
