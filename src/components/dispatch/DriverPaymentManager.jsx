import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  DollarSign, User, CheckCircle2, XCircle, Search,
  TrendingUp, Calendar, Download, Filter
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

export default function DriverPaymentManager() {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEarnings, setSelectedEarnings] = useState([]);
  const [processingNotes, setProcessingNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: allEarnings } = useQuery({
    queryKey: ['allDriverEarnings'],
    queryFn: () => base44.entities.CarrierEarnings.list('-earned_date', 500),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const approvePaymentMutation = useMutation({
    mutationFn: async ({ earningIds, notes }) => {
      for (const id of earningIds) {
        await base44.entities.CarrierEarnings.update(id, {
          payment_status: 'approved',
          approved_by: 'Dispatcher',
          approved_at: new Date().toISOString(),
          notes: notes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDriverEarnings'] });
      setSelectedEarnings([]);
      setProcessingNotes("");
      toast.success("Payments approved!");
    },
  });

  const processPaymentMutation = useMutation({
    mutationFn: async ({ earningIds, paymentReference }) => {
      const now = new Date().toISOString();
      for (const id of earningIds) {
        await base44.entities.CarrierEarnings.update(id, {
          payment_status: 'paid',
          payment_date: now,
          payment_reference: paymentReference,
          payment_method: 'direct_deposit'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDriverEarnings'] });
      setSelectedEarnings([]);
      toast.success("Payments processed and marked as paid!");
    },
  });

  const holdPaymentMutation = useMutation({
    mutationFn: async ({ earningIds, reason }) => {
      for (const id of earningIds) {
        await base44.entities.CarrierEarnings.update(id, {
          payment_status: 'on_hold',
          notes: `Payment held: ${reason}`
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDriverEarnings'] });
      setSelectedEarnings([]);
      toast.success("Payments put on hold");
    },
  });

  // Group earnings by driver
  const driverEarnings = React.useMemo(() => {
    const driversMap = {};
    
    allEarnings.forEach(earning => {
      if (!driversMap[earning.carrier_email]) {
        driversMap[earning.carrier_email] = {
          email: earning.carrier_email,
          name: earning.carrier_name || 'Unknown Driver',
          earnings: [],
          totalEarned: 0,
          pendingAmount: 0,
          paidAmount: 0,
          approvedAmount: 0,
          onHoldAmount: 0
        };
      }

      const driver = driversMap[earning.carrier_email];
      driver.earnings.push(earning);
      driver.totalEarned += earning.amount_earned || 0;
      
      if (earning.payment_status === 'pending') {
        driver.pendingAmount += earning.amount_earned || 0;
      } else if (earning.payment_status === 'paid') {
        driver.paidAmount += earning.amount_earned || 0;
      } else if (earning.payment_status === 'approved') {
        driver.approvedAmount += earning.amount_earned || 0;
      } else if (earning.payment_status === 'on_hold') {
        driver.onHoldAmount += earning.amount_earned || 0;
      }
    });

    return Object.values(driversMap).sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [allEarnings]);

  // Filter drivers
  const filteredDrivers = driverEarnings.filter(driver =>
    (driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     driver.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (statusFilter === "all" || 
     (statusFilter === "pending" && driver.pendingAmount > 0) ||
     (statusFilter === "approved" && driver.approvedAmount > 0) ||
     (statusFilter === "on_hold" && driver.onHoldAmount > 0))
  );

  // Calculate totals
  const totalPending = allEarnings
    .filter(e => e.payment_status === 'pending')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  
  const totalApproved = allEarnings
    .filter(e => e.payment_status === 'approved')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);

  const totalOnHold = allEarnings
    .filter(e => e.payment_status === 'on_hold')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);

  const handleBulkApprove = () => {
    if (selectedEarnings.length === 0) {
      toast.error("Please select earnings to approve");
      return;
    }

    const notes = prompt("Add notes for this approval (optional):");
    approvePaymentMutation.mutate({ 
      earningIds: selectedEarnings,
      notes: notes || ''
    });
  };

  const handleBulkProcess = () => {
    if (selectedEarnings.length === 0) {
      toast.error("Please select earnings to process");
      return;
    }

    const reference = prompt("Enter payment batch reference number:");
    if (!reference) {
      toast.error("Payment reference is required");
      return;
    }

    processPaymentMutation.mutate({ 
      earningIds: selectedEarnings,
      paymentReference: reference
    });
  };

  const handleBulkHold = () => {
    if (selectedEarnings.length === 0) {
      toast.error("Please select earnings to hold");
      return;
    }

    const reason = prompt("Reason for holding payment:");
    if (!reason) {
      toast.error("Reason is required");
      return;
    }

    holdPaymentMutation.mutate({ 
      earningIds: selectedEarnings,
      reason
    });
  };

  const toggleSelectEarning = (earningId) => {
    setSelectedEarnings(prev =>
      prev.includes(earningId)
        ? prev.filter(id => id !== earningId)
        : [...prev, earningId]
    );
  };

  const selectAllDriverEarnings = (driver, status) => {
    const earningsToSelect = driver.earnings
      .filter(e => status === 'all' || e.payment_status === status)
      .map(e => e.id);
    
    setSelectedEarnings(earningsToSelect);
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-yellow-200">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
            <p className="text-3xl font-bold text-yellow-900">${totalPending.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Pending Approval</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-purple-600 mb-2" />
            <p className="text-3xl font-bold text-purple-900">${totalApproved.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Approved</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-orange-900">${totalOnHold.toFixed(2)}</p>
            <p className="text-sm text-gray-600">On Hold</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200">
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-900">{driverEarnings.length}</p>
            <p className="text-sm text-gray-600">Active Drivers</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedEarnings.length > 0 && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-blue-900">
                  {selectedEarnings.length} earning{selectedEarnings.length > 1 ? 's' : ''} selected
                </span>
                <span className="text-sm text-blue-700">
                  (${allEarnings
                    .filter(e => selectedEarnings.includes(e.id))
                    .reduce((sum, e) => sum + (e.amount_earned || 0), 0)
                    .toFixed(2)})
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkApprove}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  onClick={handleBulkProcess}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Process Payment
                </Button>
                <Button
                  onClick={handleBulkHold}
                  size="sm"
                  variant="outline"
                  className="border-orange-300 text-orange-700"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Hold
                </Button>
                <Button
                  onClick={() => setSelectedEarnings([])}
                  size="sm"
                  variant="outline"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drivers by name or email..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                <SelectItem value="pending">With Pending Payments</SelectItem>
                <SelectItem value="approved">With Approved Payments</SelectItem>
                <SelectItem value="on_hold">With Payments On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Driver Earnings List */}
      <div className="space-y-4">
        {filteredDrivers.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="p-8 text-center">
              <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No drivers found</p>
            </CardContent>
          </Card>
        ) : (
          filteredDrivers.map((driver) => (
            <Card 
              key={driver.email}
              className={`border-2 ${
                selectedDriver?.email === driver.email 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-200'
              }`}
            >
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setSelectedDriver(selectedDriver?.email === driver.email ? null : driver)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{driver.name}</CardTitle>
                      <p className="text-sm text-gray-600">{driver.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">${driver.totalEarned.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Total Earned</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Status Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2 bg-yellow-50 rounded text-center border border-yellow-200">
                    <p className="text-lg font-bold text-yellow-900">${driver.pendingAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Pending</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded text-center border border-purple-200">
                    <p className="text-lg font-bold text-purple-900">${driver.approvedAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Approved</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded text-center border border-green-200">
                    <p className="text-lg font-bold text-green-900">${driver.paidAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Paid</p>
                  </div>
                  {driver.onHoldAmount > 0 && (
                    <div className="p-2 bg-orange-50 rounded text-center border border-orange-200">
                      <p className="text-lg font-bold text-orange-900">${driver.onHoldAmount.toFixed(2)}</p>
                      <p className="text-xs text-gray-600">On Hold</p>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 flex-wrap">
                  {driver.pendingAmount > 0 && (
                    <Button
                      onClick={() => selectAllDriverEarnings(driver, 'pending')}
                      size="sm"
                      variant="outline"
                      className="border-yellow-300 text-yellow-700"
                    >
                      Select All Pending
                    </Button>
                  )}
                  {driver.approvedAmount > 0 && (
                    <Button
                      onClick={() => selectAllDriverEarnings(driver, 'approved')}
                      size="sm"
                      variant="outline"
                      className="border-purple-300 text-purple-700"
                    >
                      Select All Approved
                    </Button>
                  )}
                </div>

                {/* Expanded Details */}
                {selectedDriver?.email === driver.email && (
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">Recent Transactions:</p>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {driver.earnings
                        .sort((a, b) => new Date(b.earned_date) - new Date(a.earned_date))
                        .slice(0, 20)
                        .map((earning) => (
                          <div 
                            key={earning.id}
                            className={`p-3 rounded-lg border-2 cursor-pointer ${
                              selectedEarnings.includes(earning.id)
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 bg-white'
                            }`}
                            onClick={() => toggleSelectEarning(earning.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {earning.earning_type.replace(/_/g, ' ')}
                                  </Badge>
                                  <Badge className={
                                    earning.payment_status === 'pending' ? 'bg-yellow-600' :
                                    earning.payment_status === 'approved' ? 'bg-purple-600' :
                                    earning.payment_status === 'paid' ? 'bg-green-600' :
                                    earning.payment_status === 'on_hold' ? 'bg-orange-600' :
                                    'bg-gray-600'
                                  }>
                                    {earning.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-xs font-mono text-gray-600">
                                  {earning.tracking_number || 'N/A'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">
                                  ${earning.amount_earned.toFixed(2)}
                                </p>
                                {earning.total_bonuses > 0 && (
                                  <p className="text-xs text-blue-700">
                                    +${earning.total_bonuses.toFixed(2)} bonus
                                  </p>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-gray-600">
                              {format(new Date(earning.earned_date), "MMM d, yyyy 'at' h:mm a")}
                            </p>

                            {earning.payment_date && (
                              <p className="text-xs text-green-700 mt-1">
                                Paid: {format(new Date(earning.payment_date), "MMM d, yyyy")}
                                {earning.payment_reference && ` (Ref: ${earning.payment_reference})`}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}