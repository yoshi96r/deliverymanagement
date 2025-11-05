import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, MapPin, CheckCircle2, Clock, Truck, 
  Search, Calendar, User, Phone, Mail
} from "lucide-react";
import { format } from "date-fns";

export default function PublicTracking() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: delivery, isLoading, error } = useQuery({
    queryKey: ['trackPackage', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return null;
      const deliveries = await base44.entities.DeliveryRequest.filter({ 
        tracking_number: searchQuery 
      });
      return deliveries[0] || null;
    },
    enabled: !!searchQuery,
    initialData: null
  });

  const { data: checkpoints } = useQuery({
    queryKey: ['deliveryCheckpoints', delivery?.id],
    queryFn: () => base44.entities.DeliveryCheckpoint.filter({ 
      delivery_request_id: delivery.id 
    }),
    enabled: !!delivery?.id,
    initialData: []
  });

  const handleSearch = () => {
    if (trackingNumber.trim()) {
      setSearchQuery(trackingNumber.trim());
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-gray-600",
      signed: "bg-blue-600",
      at_facility: "bg-yellow-600",
      out_for_delivery: "bg-orange-600",
      delivered: "bg-green-600",
      exception: "bg-red-600"
    };
    return colors[status] || "bg-gray-600";
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: Clock,
      signed: Package,
      at_facility: MapPin,
      out_for_delivery: Truck,
      delivered: CheckCircle2,
      exception: Clock
    };
    return icons[status] || Clock;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Track Your Package
          </h1>
          <p className="text-center text-blue-100 text-lg">
            Enter your tracking number to see real-time delivery status
          </p>
        </div>
      </div>

      {/* Search Box */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="border-2 border-blue-300 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter tracking number (e.g., 9400123456789)"
                className="flex-1 h-14 text-lg"
              />
              <Button
                onClick={handleSearch}
                disabled={!trackingNumber.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 h-14 px-8"
              >
                {isLoading ? (
                  "Searching..."
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Track
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {searchQuery && !delivery && !isLoading && (
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <Package className="w-16 h-16 mx-auto text-red-400 mb-4" />
              <h3 className="text-xl font-bold text-red-900 mb-2">
                Tracking Number Not Found
              </h3>
              <p className="text-red-700">
                We couldn't find a package with tracking number: <strong>{searchQuery}</strong>
              </p>
              <p className="text-sm text-red-600 mt-2">
                Please check the number and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {delivery && (
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-2 border-blue-300">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl mb-2">Package Status</CardTitle>
                    <p className="font-mono text-lg text-gray-700">{delivery.tracking_number}</p>
                  </div>
                  <Badge className={`${getStatusColor(delivery.status)} text-white text-lg px-4 py-2`}>
                    {delivery.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <User className="w-5 h-5" />
                      <span className="font-semibold">Recipient</span>
                    </div>
                    <p className="text-gray-900 font-medium">{delivery.customer_name}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <MapPin className="w-5 h-5" />
                      <span className="font-semibold">Delivery Address</span>
                    </div>
                    <p className="text-gray-900">{delivery.delivery_address}</p>
                  </div>

                  {delivery.scheduled_delivery_date && (
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Calendar className="w-5 h-5" />
                        <span className="font-semibold">Expected Delivery</span>
                      </div>
                      <p className="text-gray-900 font-medium">
                        {format(new Date(delivery.scheduled_delivery_date), "EEEE, MMMM d, yyyy")}
                      </p>
                    </div>
                  )}

                  {delivery.carrier_name && (
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Truck className="w-5 h-5" />
                        <span className="font-semibold">Carrier</span>
                      </div>
                      <p className="text-gray-900">{delivery.carrier_name}</p>
                    </div>
                  )}
                </div>

                {delivery.status === 'delivered' && delivery.delivery_timestamp && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg border-2 border-green-300">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="font-bold text-green-900 text-lg">Delivered!</p>
                        <p className="text-green-700">
                          {format(new Date(delivery.delivery_timestamp), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {delivery.status === 'out_for_delivery' && (
                  <div className="mt-6 p-4 bg-orange-50 rounded-lg border-2 border-orange-300">
                    <div className="flex items-center gap-3">
                      <Truck className="w-8 h-8 text-orange-600" />
                      <div>
                        <p className="font-bold text-orange-900 text-lg">Out for Delivery</p>
                        <p className="text-orange-700">
                          Your package is on the truck and will be delivered today!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {delivery.has_active_exception && (
                  <div className="mt-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                    <div className="flex items-center gap-3">
                      <Clock className="w-8 h-8 text-yellow-600" />
                      <div>
                        <p className="font-bold text-yellow-900 text-lg">Delivery Exception</p>
                        <p className="text-yellow-700">
                          There's an issue with your delivery. Our team is working to resolve it.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Timeline */}
            {checkpoints.length > 0 && (
              <Card className="border-2 border-gray-200">
                <CardHeader className="bg-gray-50">
                  <CardTitle>Delivery Timeline</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {checkpoints
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .map((checkpoint, index) => {
                        const Icon = getStatusIcon(checkpoint.checkpoint_type);
                        return (
                          <div key={checkpoint.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-10 h-10 rounded-full ${
                                index === 0 ? 'bg-blue-600' : 'bg-gray-300'
                              } flex items-center justify-center`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              {index < checkpoints.length - 1 && (
                                <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                              )}
                            </div>
                            <div className="flex-1 pb-6">
                              <p className="font-bold text-gray-900">{checkpoint.checkpoint_name}</p>
                              <p className="text-sm text-gray-600">
                                {format(new Date(checkpoint.timestamp), "MMMM d, yyyy 'at' h:mm a")}
                              </p>
                              {checkpoint.location && (
                                <p className="text-sm text-gray-600 mt-1">
                                  <MapPin className="w-3 h-3 inline mr-1" />
                                  {checkpoint.location}
                                </p>
                              )}
                              {checkpoint.notes && (
                                <p className="text-sm text-gray-700 mt-2">{checkpoint.notes}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Phone className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-900">Call Us</p>
                      <p className="text-blue-700">1-800-ASK-USPS</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <Mail className="w-6 h-6 text-purple-600" />
                    <div>
                      <p className="font-semibold text-purple-900">Email Support</p>
                      <p className="text-purple-700">support@usps.com</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}