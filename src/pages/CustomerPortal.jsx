import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Search, MapPin, Clock, CheckCircle2, Truck, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function CustomerPortal() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [searchedTracking, setSearchedTracking] = useState("");

  const { data: delivery, isLoading, refetch } = useQuery({
    queryKey: ['customerDelivery', searchedTracking],
    queryFn: async () => {
      if (!searchedTracking) return null;
      const deliveries = await base44.entities.DeliveryRequest.filter({
        tracking_number: searchedTracking
      });
      return deliveries[0] || null;
    },
    enabled: !!searchedTracking,
  });

  const handleSearch = () => {
    setSearchedTracking(trackingNumber);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { label: 'Processing', color: 'bg-gray-100 text-gray-800', icon: Clock },
      'at_facility': { label: 'At Facility', color: 'bg-blue-100 text-blue-800', icon: Package },
      'out_for_delivery': { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-800', icon: Truck },
      'delivered': { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      'exception': { label: 'Delivery Exception', color: 'bg-red-100 text-red-800', icon: AlertCircle },
    };
    return statusMap[status] || statusMap['pending'];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Track Your Package
          </h1>
          <p className="text-gray-600">Enter your tracking number to see delivery status</p>
        </div>

        {/* Search */}
        <Card className="border-2 border-orange-200 mb-8">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <Input
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 h-12 text-lg"
              />
              <Button
                onClick={handleSearch}
                disabled={!trackingNumber}
                className="bg-orange-600 hover:bg-orange-700 h-12 px-8"
              >
                <Search className="w-5 h-5 mr-2" />
                Track
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Searching...</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && searchedTracking && !delivery && (
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-red-600 mb-4" />
              <p className="text-lg font-semibold text-red-900 mb-2">Package Not Found</p>
              <p className="text-red-700">No delivery found with tracking number: {searchedTracking}</p>
            </CardContent>
          </Card>
        )}

        {delivery && (
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-orange-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-orange-900">Delivery Status</CardTitle>
                  <Badge className={getStatusInfo(delivery.status).color}>
                    {React.createElement(getStatusInfo(delivery.status).icon, { className: "w-4 h-4 mr-1" })}
                    {getStatusInfo(delivery.status).label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                  <p className="font-mono text-lg font-bold">{delivery.tracking_number}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Recipient</p>
                    <p className="font-semibold">{delivery.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Carrier</p>
                    <p className="font-semibold">{delivery.carrier_name || 'Assigned'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Delivery Address
                  </p>
                  <p className="font-semibold">{delivery.delivery_address}</p>
                </div>

                {delivery.scheduled_delivery_date && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Scheduled Delivery
                    </p>
                    <p className="font-semibold">
                      {format(new Date(delivery.scheduled_delivery_date), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}

                {delivery.delivery_timestamp && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Delivered Successfully
                    </p>
                    <p className="text-green-800">
                      {format(new Date(delivery.delivery_timestamp), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}

                {delivery.carrier_notes && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Delivery Notes</p>
                    <p className="text-blue-800">{delivery.carrier_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Proof of Delivery */}
            {delivery.delivery_proof_photo_url && (
              <Card className="border-2 border-green-200">
                <CardHeader className="bg-green-50">
                  <CardTitle className="text-green-900">Proof of Delivery</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <img
                    src={delivery.delivery_proof_photo_url}
                    alt="Delivery proof"
                    className="w-full max-w-2xl mx-auto rounded-lg border-2 border-gray-200"
                  />
                </CardContent>
              </Card>
            )}

            {/* Package Photo */}
            {delivery.package_photo_url && (
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-blue-900">Package Photo</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <img
                    src={delivery.package_photo_url}
                    alt="Package"
                    className="w-full max-w-2xl mx-auto rounded-lg border-2 border-gray-200"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}