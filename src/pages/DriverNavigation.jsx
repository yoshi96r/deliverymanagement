import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Navigation, MapPin, AlertTriangle, Info, Clock,
  Route, Home, Phone, Dog, Lock, Camera, Map
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DriverNavigation() {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showPreferenceDialog, setShowPreferenceDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, []);

  const { data: myDeliveries } = useQuery({
    queryKey: ['myDeliveriesNav'],
    queryFn: () => base44.entities.DeliveryRequest.filter({
      carrier_email: 'driver@company.com' // Replace with actual driver email
    }),
    initialData: [],
  });

  const { data: preferences } = useQuery({
    queryKey: ['deliveryPreferences'],
    queryFn: () => base44.entities.DeliveryPreference.list(),
    initialData: [],
  });

  const { data: mailboxes } = useQuery({
    queryKey: ['mailboxConfigs'],
    queryFn: () => base44.entities.MailboxConfiguration.list(),
    initialData: [],
  });

  const getPreferenceForAddress = (address) => {
    return preferences.find(p => 
      p.customer_address.toLowerCase().includes(address.toLowerCase()) ||
      address.toLowerCase().includes(p.customer_address.toLowerCase())
    );
  };

  const getMailboxForAddress = (address) => {
    return mailboxes.find(m => 
      m.serves_addresses?.includes(address) ||
      m.address === address
    );
  };

  const handleNavigate = (delivery) => {
    const preference = getPreferenceForAddress(delivery.delivery_address);
    const gps = preference?.gps_coordinates || null;
    
    if (gps && currentLocation) {
      window.open(`https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${gps}`, '_blank');
    } else {
      const address = encodeURIComponent(delivery.delivery_address);
      if (currentLocation) {
        window.open(`https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${address}`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/search/${address}`, '_blank');
      }
    }
  };

  const handleViewPreference = (delivery) => {
    setSelectedAddress({
      delivery,
      preference: getPreferenceForAddress(delivery.delivery_address),
      mailbox: getMailboxForAddress(delivery.delivery_address)
    });
    setShowPreferenceDialog(true);
  };

  const filteredDeliveries = myDeliveries.filter(d => 
    !searchQuery ||
    d.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.delivery_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.tracking_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayDeliveries = filteredDeliveries.filter(d => {
    if (!d.created_date) return false;
    const today = new Date().toDateString();
    return new Date(d.created_date).toDateString() === today;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Navigation className="w-10 h-10 text-blue-600" />
            Smart Driver Navigation
          </h1>
          <p className="text-gray-600">Route navigation with customer delivery preferences</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Route className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{todayDeliveries.length}</p>
              <p className="text-sm text-gray-600">Today's Stops</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <MapPin className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{preferences.length}</p>
              <p className="text-sm text-gray-600">Saved Preferences</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Home className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">{mailboxes.length}</p>
              <p className="text-sm text-gray-600">Mailboxes Mapped</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">
                {todayDeliveries.filter(d => d.status !== 'delivered').length}
              </p>
              <p className="text-sm text-gray-600">Remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search addresses, customers, or tracking numbers..."
            className="h-12 text-lg"
          />
        </div>

        {/* Deliveries List */}
        <div className="space-y-3">
          {todayDeliveries.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Navigation className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No deliveries for today</p>
              </CardContent>
            </Card>
          ) : (
            todayDeliveries.map((delivery, index) => {
              const preference = getPreferenceForAddress(delivery.delivery_address);
              const mailbox = getMailboxForAddress(delivery.delivery_address);
              const hasInfo = preference || mailbox;

              return (
                <Card 
                  key={delivery.id}
                  className={`border-2 ${hasInfo ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                        {delivery.route_sequence || index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-gray-900">{delivery.customer_name}</h3>
                          {hasInfo && (
                            <Badge className="bg-green-600">
                              <Info className="w-3 h-3 mr-1" />
                              Driver Notes
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-gray-700 mb-2 flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          {delivery.delivery_address}
                        </p>

                        {/* Quick Info */}
                        {preference && (
                          <div className="mb-3 p-2 bg-white rounded border border-green-200">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {preference.preferred_location && (
                                <div className="flex items-center gap-1">
                                  <Home className="w-3 h-3 text-green-600" />
                                  <span className="font-semibold">Location:</span>
                                  <span>{preference.preferred_location.replace(/_/g, ' ')}</span>
                                </div>
                              )}
                              {preference.gate_code && (
                                <div className="flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-orange-600" />
                                  <span className="font-semibold">Code:</span>
                                  <span>{preference.gate_code}</span>
                                </div>
                              )}
                              {preference.dog_warning && (
                                <div className="flex items-center gap-1 text-red-700">
                                  <Dog className="w-3 h-3" />
                                  <span className="font-semibold">Dog Warning!</span>
                                </div>
                              )}
                              {preference.customer_usually_home && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-blue-600" />
                                  <span>{preference.customer_usually_home}</span>
                                </div>
                              )}
                            </div>
                            {preference.specific_instructions && (
                              <p className="text-xs text-gray-700 mt-2 italic">
                                💡 {preference.specific_instructions}
                              </p>
                            )}
                          </div>
                        )}

                        {mailbox && (
                          <div className="mb-3 p-2 bg-white rounded border border-blue-200">
                            <p className="text-xs font-semibold text-blue-900 mb-1">
                              📬 Mailbox: {mailbox.mailbox_type.replace(/_/g, ' ')}
                            </p>
                            {mailbox.box_number && (
                              <p className="text-xs text-gray-700">Box #{mailbox.box_number}</p>
                            )}
                            {mailbox.access_code && (
                              <p className="text-xs text-orange-700">Code: {mailbox.access_code}</p>
                            )}
                          </div>
                        )}

                        <p className="font-mono text-xs text-gray-600">{delivery.tracking_number}</p>
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleNavigate(delivery)}
                          className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                        >
                          <Navigation className="w-4 h-4 mr-1" />
                          Navigate
                        </Button>
                        {hasInfo && (
                          <Button
                            onClick={() => handleViewPreference(delivery)}
                            variant="outline"
                            className="border-green-300 text-green-700 whitespace-nowrap"
                          >
                            <Info className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Preference Detail Dialog */}
        <Dialog open={showPreferenceDialog} onOpenChange={setShowPreferenceDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Delivery Information</DialogTitle>
            </DialogHeader>
            {selectedAddress && (
              <div className="space-y-4">
                <Card className="border-2 border-blue-200">
                  <CardHeader className="bg-blue-50">
                    <CardTitle className="text-blue-900">
                      {selectedAddress.delivery.customer_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-gray-700 mb-4">{selectedAddress.delivery.delivery_address}</p>
                    <p className="font-mono text-sm text-gray-600">
                      {selectedAddress.delivery.tracking_number}
                    </p>
                  </CardContent>
                </Card>

                {selectedAddress.preference && (
                  <Card className="border-2 border-green-200">
                    <CardHeader className="bg-green-50">
                      <CardTitle className="text-green-900 flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        Delivery Preferences
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Preferred Location</p>
                          <p className="font-semibold capitalize">
                            {selectedAddress.preference.preferred_location?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Usually Home</p>
                          <p className="font-semibold capitalize">
                            {selectedAddress.preference.customer_usually_home?.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>

                      {selectedAddress.preference.specific_instructions && (
                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                          <p className="text-sm font-semibold text-blue-900 mb-1">
                            📝 Instructions:
                          </p>
                          <p className="text-sm text-blue-800">
                            {selectedAddress.preference.specific_instructions}
                          </p>
                        </div>
                      )}

                      {selectedAddress.preference.gate_code && (
                        <div className="p-3 bg-orange-50 rounded border border-orange-200">
                          <p className="text-sm font-semibold text-orange-900 mb-1">
                            <Lock className="w-4 h-4 inline mr-1" />
                            Gate/Access Code:
                          </p>
                          <p className="text-lg font-bold text-orange-900">
                            {selectedAddress.preference.gate_code}
                          </p>
                        </div>
                      )}

                      {selectedAddress.preference.parking_notes && (
                        <div className="p-3 bg-purple-50 rounded border border-purple-200">
                          <p className="text-sm font-semibold text-purple-900 mb-1">
                            🚗 Parking:
                          </p>
                          <p className="text-sm text-purple-800">
                            {selectedAddress.preference.parking_notes}
                          </p>
                        </div>
                      )}

                      {selectedAddress.preference.dog_warning && (
                        <div className="p-3 bg-red-50 rounded border border-red-200">
                          <p className="text-sm font-bold text-red-900">
                            <Dog className="w-4 h-4 inline mr-1" />
                            ⚠️ DOG WARNING - Exercise Caution
                          </p>
                        </div>
                      )}

                      {selectedAddress.preference.photo_url && (
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-2">
                            <Camera className="w-4 h-4 inline mr-1" />
                            Delivery Location Photo:
                          </p>
                          <img
                            src={selectedAddress.preference.photo_url}
                            alt="Delivery location"
                            className="w-full rounded-lg border-2 border-gray-200"
                          />
                        </div>
                      )}

                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <p>Added by: {selectedAddress.preference.added_by_driver}</p>
                        {selectedAddress.preference.verified_by_drivers?.length > 0 && (
                          <Badge variant="outline">
                            Verified by {selectedAddress.preference.verified_by_drivers.length} drivers
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedAddress.mailbox && (
                  <Card className="border-2 border-purple-200">
                    <CardHeader className="bg-purple-50">
                      <CardTitle className="text-purple-900 flex items-center gap-2">
                        <Home className="w-5 h-5" />
                        Mailbox Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Type</p>
                          <p className="font-semibold capitalize">
                            {selectedAddress.mailbox.mailbox_type?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        {selectedAddress.mailbox.box_number && (
                          <div>
                            <p className="text-sm text-gray-600">Box Number</p>
                            <p className="font-semibold">{selectedAddress.mailbox.box_number}</p>
                          </div>
                        )}
                      </div>

                      {selectedAddress.mailbox.access_code && (
                        <div className="p-3 bg-orange-50 rounded border border-orange-200">
                          <p className="text-sm font-semibold text-orange-900 mb-1">
                            Access Code:
                          </p>
                          <p className="text-lg font-bold text-orange-900">
                            {selectedAddress.mailbox.access_code}
                          </p>
                        </div>
                      )}

                      {selectedAddress.mailbox.approach_notes && (
                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                          <p className="text-sm font-semibold text-blue-900 mb-1">
                            Approach Notes:
                          </p>
                          <p className="text-sm text-blue-800">
                            {selectedAddress.mailbox.approach_notes}
                          </p>
                        </div>
                      )}

                      {selectedAddress.mailbox.photo_front && (
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Mailbox Photo:</p>
                          <img
                            src={selectedAddress.mailbox.photo_front}
                            alt="Mailbox"
                            className="w-full rounded-lg border-2 border-gray-200"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleNavigate(selectedAddress.delivery)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Navigate to Location
                  </Button>
                  {selectedAddress.delivery.customer_phone && (
                    <Button
                      onClick={() => window.location.href = `tel:${selectedAddress.delivery.customer_phone}`}
                      variant="outline"
                      className="border-green-300"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}