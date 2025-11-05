import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Package, Search, Filter, Download, Eye, MapPin, 
  Clock, CheckCircle2, AlertTriangle, Truck, XCircle 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PackageManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['allPackages'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date', 500),
    initialData: [],
  });

  const filteredPackages = useMemo(() => {
    return deliveries.filter(pkg => {
      const matchesSearch = !searchQuery || 
        pkg.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.delivery_address.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || pkg.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [deliveries, searchQuery, statusFilter]);

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: Clock },
      'signed': { label: 'Signed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
      'at_facility': { label: 'At Facility', color: 'bg-purple-100 text-purple-800', icon: Package },
      'on_truck': { label: 'On Truck', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
      'out_for_delivery': { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-800', icon: Truck },
      'delivered': { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      'exception': { label: 'Exception', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      'held_at_post_office': { label: 'Held', color: 'bg-yellow-100 text-yellow-800', icon: Package },
    };
    return statusMap[status] || statusMap['pending'];
  };

  const handleExportCSV = () => {
    const csvData = filteredPackages.map(pkg => ({
      tracking_number: pkg.tracking_number,
      customer_name: pkg.customer_name,
      delivery_address: pkg.delivery_address,
      status: pkg.status,
      carrier_name: pkg.carrier_name || 'Unassigned',
      created_date: format(new Date(pkg.created_date), 'yyyy-MM-dd HH:mm:ss'),
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packages-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  const statusCounts = useMemo(() => {
    const counts = {};
    deliveries.forEach(d => {
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [deliveries]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Package className="w-10 h-10 text-purple-600" />
            Package Management
          </h1>
          <p className="text-gray-600">Search, track, and manage all packages</p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'border-2 border-blue-500 bg-blue-50' : 'border-2 border-gray-200 hover:border-blue-300'}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{deliveries.length}</p>
              <p className="text-xs text-gray-600 mt-1">All</p>
            </CardContent>
          </Card>
          {Object.entries(statusCounts).map(([status, count]) => {
            const statusInfo = getStatusInfo(status);
            const Icon = statusInfo.icon;
            return (
              <Card 
                key={status}
                className={`cursor-pointer transition-all ${statusFilter === status ? 'border-2 border-blue-500 bg-blue-50' : 'border-2 border-gray-200 hover:border-blue-300'}`}
                onClick={() => setStatusFilter(status)}
              >
                <CardContent className="p-4 text-center">
                  <Icon className="w-6 h-6 mx-auto mb-1 text-gray-600" />
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-600 mt-1 capitalize">{status.replace(/_/g, ' ')}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search and Filters */}
        <Card className="border-2 border-purple-200 mb-6">
          <CardContent className="p-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by tracking number, customer name, or address..."
                    className="pl-10 h-12 text-base"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 h-12">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="at_facility">At Facility</SelectItem>
                  <SelectItem value="on_truck">On Truck</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="exception">Exception</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                className="h-12 border-2 border-green-300 text-green-700"
              >
                <Download className="w-5 h-5 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Package List */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50 border-b-2 border-gray-200">
            <CardTitle>
              Packages ({filteredPackages.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading packages...</p>
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 text-lg">No packages found</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredPackages.map((pkg) => {
                  const statusInfo = getStatusInfo(pkg.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={pkg.id}
                      className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setShowDetailDialog(true);
                      }}
                    >
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusInfo.color}`}>
                          <StatusIcon className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono font-bold text-gray-900">{pkg.tracking_number}</p>
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="font-semibold text-gray-800">{pkg.customer_name}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {pkg.delivery_address}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{pkg.carrier_name || 'Unassigned'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(pkg.created_date), 'MMM dd, yyyy')}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPackage(pkg);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Package Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Package Details</DialogTitle>
            </DialogHeader>
            {selectedPackage && (
              <div className="space-y-4">
                <Card className="border-2 border-purple-200">
                  <CardHeader className="bg-purple-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-purple-900">
                        {selectedPackage.tracking_number}
                      </CardTitle>
                      <Badge className={getStatusInfo(selectedPackage.status).color}>
                        {getStatusInfo(selectedPackage.status).label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Customer</p>
                        <p className="font-semibold text-gray-900">{selectedPackage.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Carrier</p>
                        <p className="font-semibold text-gray-900">{selectedPackage.carrier_name || 'Not assigned'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Delivery Address</p>
                      <p className="font-semibold text-gray-900">{selectedPackage.delivery_address}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Created</p>
                        <p className="font-semibold text-gray-900">
                          {format(new Date(selectedPackage.created_date), "MMM dd, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      {selectedPackage.scheduled_delivery_date && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Scheduled</p>
                          <p className="font-semibold text-gray-900">
                            {format(new Date(selectedPackage.scheduled_delivery_date), "MMM dd, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedPackage.delivery_timestamp && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-semibold text-green-900 mb-1">Delivered</p>
                        <p className="text-green-800">
                          {format(new Date(selectedPackage.delivery_timestamp), "MMM dd, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    )}

                    {selectedPackage.carrier_notes && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Notes</p>
                        <p className="text-blue-800">{selectedPackage.carrier_notes}</p>
                      </div>
                    )}

                    {selectedPackage.package_photo_url && (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-2">Package Photo</p>
                        <img 
                          src={selectedPackage.package_photo_url} 
                          alt="Package" 
                          className="w-full rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}

                    {selectedPackage.delivery_proof_photo_url && (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-2">Delivery Proof</p>
                        <img 
                          src={selectedPackage.delivery_proof_photo_url} 
                          alt="Delivery proof" 
                          className="w-full rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}