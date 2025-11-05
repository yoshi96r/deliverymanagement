
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"; // Added Input component
import {
  Package, CheckCircle2, Navigation, QrCode, 
  Clock, TrendingUp, MessageSquare, PlayCircle,
  MapPin, XCircle, Home, BarChart3, Phone // Added Phone icon
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import MobileScanner from "../components/mobile/MobileScanner";
import DeliveryProofMobile from "../components/mobile/DeliveryProofMobile";
import ExceptionReport from "../components/mobile/ExceptionReport";

export default function DriverMobile() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("manifest");
  const [routeStarted, setRouteStarted] = useState(false);
  const [routeStartTime, setRouteStartTime] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showBreakTimer, setShowBreakTimer] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [todayMileage, setTodayMileage] = useState(0); // This state is added but not updated in the provided outline
  const [showEarningsDetail, setShowEarningsDetail] = useState(false);
  const [sortBy, setSortBy] = useState("sequence"); // sequence, distance, time_window

  const queryClient = useQueryClient();

  const { data: initialDeliveries } = useQuery({
    queryKey: ['initialDriverCheck'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date', 1),
    initialData: [],
  });

  const driverEmail = initialDeliveries[0]?.carrier_email || 'driver@fedex.com';
  const driverName = initialDeliveries[0]?.carrier_name || 'Driver';

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Location error:", error);
        }
      );

      const watchId = navigator.geolocation.watchPosition((position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const { data: myDeliveries, refetch: refetchDeliveries } = useQuery({
    queryKey: ['myDeliveries', driverEmail],
    queryFn: async () => {
      const deliveries = await base44.entities.DeliveryRequest.filter({
        carrier_email: driverEmail
      });
      return deliveries.sort((a, b) => {
        if (a.route_sequence && b.route_sequence) {
          return a.route_sequence - b.route_sequence;
        }
        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
      });
    },
    initialData: [],
    enabled: !!driverEmail,
    refetchInterval: 30000,
  });

  const startRouteMutation = useMutation({
    mutationFn: async () => {
      const startTime = new Date();
      setRouteStartTime(startTime);
      setRouteStarted(true);
      
      const packagesToStart = myDeliveries.filter(
        d => d.status === 'signed' || d.status === 'at_facility'
      );

      for (const delivery of packagesToStart) {
        await base44.entities.DeliveryRequest.update(delivery.id, {
          status: 'out_for_delivery',
          current_location: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : undefined,
        });
      }

      // Start mileage tracking
      if (currentLocation) {
        // Assuming LocationTracking entity exists and has these fields
        await base44.entities.LocationTracking.create({
          tracking_number: 'ROUTE_START',
          delivery_request_id: 'route', // Use a placeholder ID or null if not directly related to a delivery
          timestamp: startTime.toISOString(),
          location_type: 'vehicle',
          action: 'route_started',
          scanned_by: driverName,
          notes: `Start location: ${currentLocation.lat},${currentLocation.lng}`
        });
      }

      return startTime;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
      toast.success("Route started! Drive safe.");
    },
  });

  const completeDeliveryMutation = useMutation({
    mutationFn: async ({ delivery, proofData }) => {
      await base44.entities.DeliveryRequest.update(delivery.id, {
        status: 'delivered',
        delivery_timestamp: new Date().toISOString(),
        delivery_proof_photo_url: proofData.photoUrl,
        signature_data: proofData.signatureUrl,
        current_location: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : undefined,
      });

      return delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
      setShowProofDialog(false);
      setSelectedStop(null);
      toast.success("Package delivered!");
    },
  });

  const handleStartRoute = () => {
    startRouteMutation.mutate();
  };

  const handleStopClick = (delivery) => {
    setSelectedStop(delivery);
    // Only show proof dialog if status is out_for_delivery or an equivalent "ready to deliver" state
    if (delivery.status === 'out_for_delivery' || delivery.status === 'signed' || delivery.status === 'at_facility') {
      setShowProofDialog(true);
    }
  };

  const handleNavigateToStop = (delivery) => {
    const address = encodeURIComponent(delivery.delivery_address);
    if (currentLocation) {
      window.open(`https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${address}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/${address}`, '_blank');
    }
  };

  const handleException = (delivery) => {
    setSelectedStop(delivery);
    setShowExceptionDialog(true);
  };

  const handleProofComplete = async (proofData) => {
    if (!selectedStop) return;
    await completeDeliveryMutation.mutateAsync({
      delivery: selectedStop,
      proofData: proofData,
    });
  };

  const handleExceptionComplete = async () => {
    queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
    setShowExceptionDialog(false);
    setSelectedStop(null);
    toast.success("Exception reported");
  };

  const handleCallCustomer = (delivery) => {
    if (delivery.customer_phone) {
      window.location.href = `tel:${delivery.customer_phone}`;
    } else {
      toast.error("No phone number available");
    }
  };

  const handleTextCustomer = (delivery) => {
    if (delivery.customer_phone) {
      window.location.href = `sms:${delivery.customer_phone}`;
    } else {
      toast.error("No phone number available");
    }
  };

  const handleStartBreak = () => {
    setBreakStartTime(new Date());
    setShowBreakTimer(true);
    toast.success("Break started");
  };

  const handleEndBreak = () => {
    if (breakStartTime) {
      const breakDuration = Math.floor((new Date() - breakStartTime) / 60000);
      toast.success(`Break ended (${breakDuration} minutes)`);
    }
    setBreakStartTime(null);
    setShowBreakTimer(false);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const todayDeliveries = myDeliveries.filter(d => {
    if (!d.created_date) return false;
    const today = new Date().toDateString();
    return new Date(d.created_date).toDateString() === today;
  });

  const completedToday = todayDeliveries.filter(d => d.status === 'delivered').length;
  const remainingStops = todayDeliveries.filter(d => 
    d.status !== 'delivered' && d.status !== 'exception'
  ).length;
  const exceptionsToday = todayDeliveries.filter(d => d.status === 'exception').length;

  const stopsPerHour = routeStartTime && completedToday > 0
    ? (completedToday / ((new Date() - new Date(routeStartTime)) / (1000 * 60 * 60))).toFixed(1)
    : '0.0';

  const nextStop = todayDeliveries.find(d => d.status === 'out_for_delivery' && d.id !== selectedStop?.id); // Exclude currently selected stop from nextStop calculation

  // Sort deliveries based on sort preference
  const sortedDeliveries = React.useMemo(() => {
    let sorted = [...todayDeliveries];
    
    if (searchQuery) {
      sorted = sorted.filter(d => 
        d.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.delivery_address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortBy === "sequence") {
      sorted.sort((a, b) => (a.route_sequence || 999) - (b.route_sequence || 999));
    } else if (sortBy === "distance" && currentLocation) {
      // Sort by distance from current location (rough estimate for demo)
      sorted.sort((a, b) => {
        // This is a simplified distance calculation based on address string length,
        // for a real application, you would geocode addresses and use `calculateDistance`.
        const distA = a.delivery_address.length; 
        const distB = b.delivery_address.length;
        // More accurate approach would be:
        // const [latA, lonA] = getLatLonFromAddress(a.delivery_address); // Requires geocoding service
        // const [latB, lonB] = getLatLonFromAddress(b.delivery_address); // Requires geocoding service
        // if (latA && lonA && latB && lonB) {
        //   return calculateDistance(currentLocation.lat, currentLocation.lng, latA, lonA) -
        //          calculateDistance(currentLocation.lat, currentLocation.lng, latB, lonB);
        // }
        return distA - distB; // Placeholder sorting
      });
    }

    return sorted;
  }, [todayDeliveries, searchQuery, sortBy, currentLocation]);

  const totalEarnings = todayDeliveries
    .filter(d => d.status === 'delivered')
    .reduce((sum, d) => sum + (d.total_carrier_payment || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-purple-600 text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">FedEx Ground</h1>
            <p className="text-xs text-orange-100">
              {routeStarted ? '🚚 On Route' : '📍 Ready to Start'} • {currentLocation ? 'GPS Active' : 'No GPS'}
            </p>
          </div>
          <Button
            onClick={() => setShowScanDialog(true)}
            className="bg-white text-orange-600 hover:bg-orange-50 rounded-full w-14 h-14 p-0 shadow-lg"
          >
            <QrCode className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-4 gap-3">
        <Card className="border-green-200 bg-white">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-900">{completedToday}</p>
            <p className="text-xs text-gray-600">Delivered</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-white">
          <CardContent className="p-3 text-center">
            <Package className="w-6 h-6 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-900">{remainingStops}</p>
            <p className="text-xs text-gray-600">Remaining</p>
          </CardContent>
        </Card>

        <Card 
          className="border-orange-200 bg-white cursor-pointer hover:bg-orange-50"
          onClick={() => setShowEarningsDetail(true)}
        >
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-orange-600 mb-1" />
            <p className="text-2xl font-bold text-orange-900">${totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-gray-600">Earned Today</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-white">
          <CardContent className="p-3 text-center">
            <XCircle className="w-6 h-6 mx-auto text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-900">{exceptionsToday}</p>
            <p className="text-xs text-gray-600">Exceptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Break Timer */}
      {showBreakTimer && breakStartTime && (
        <div className="px-4 mb-4">
          <Card className="border-2 border-yellow-300 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-yellow-700" />
                  <div>
                    <p className="font-bold text-yellow-900">On Break</p>
                    <p className="text-sm text-yellow-700">
                      {Math.floor((new Date() - breakStartTime) / 60000)} minutes
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleEndBreak}
                  className="bg-green-600 hover:bg-green-700"
                >
                  End Break
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Start Route Button */}
      {!routeStarted && todayDeliveries.length > 0 && (
        <div className="px-4 mb-4">
          <Button
            onClick={handleStartRoute}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg shadow-lg"
          >
            <PlayCircle className="w-6 h-6 mr-2" />
            Start Route ({todayDeliveries.length} stops)
          </Button>
        </div>
      )}

      {/* Quick Actions Bar */}
      {routeStarted && (
        <div className="px-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {!showBreakTimer && (
              <Button
                onClick={handleStartBreak}
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 whitespace-nowrap"
              >
                <Clock className="w-4 h-4 mr-1" />
                Take Break
              </Button>
            )}
            <Button
              onClick={() => setShowEarningsDetail(true)}
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 whitespace-nowrap"
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              Earnings: ${totalEarnings.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {/* Next Stop Card */}
      {nextStop && routeStarted && (
        <div className="px-4 mb-4">
          <Card className="border-2 border-green-300 bg-gradient-to-r from-green-50 to-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  {nextStop.route_sequence || '•'}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-green-700 font-semibold mb-1">NEXT STOP</p>
                  <p className="font-bold text-gray-900 mb-1">{nextStop.customer_name}</p>
                  <p className="text-sm text-gray-700 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    {nextStop.delivery_address}
                  </p>
                  <p className="font-mono text-xs text-gray-600 mt-1">{nextStop.tracking_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => handleNavigateToStop(nextStop)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Navigation className="w-4 h-4 mr-1" />
                  Navigate
                </Button>
                <Button
                  onClick={() => handleStopClick(nextStop)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Deliver
                </Button>
                <Button
                  onClick={() => handleException(nextStop)}
                  variant="outline"
                  className="border-red-300 text-red-700"
                >
                  Exception
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
        <TabsList className="grid w-full grid-cols-3 bg-white shadow-md">
          <TabsTrigger value="manifest">
            <Package className="w-4 h-4 mr-1" />
            Manifest
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="w-4 h-4 mr-1" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="w-4 h-4 mr-1" />
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manifest" className="mt-4">
          {/* Search and Sort */}
          <div className="space-y-3 mb-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, address, or tracking..."
              className="bg-white"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => setSortBy("sequence")}
                size="sm"
                variant={sortBy === "sequence" ? "default" : "outline"}
                className={sortBy === "sequence" ? "bg-blue-600 text-white" : "border-blue-300 text-blue-700"}
              >
                Route Order
              </Button>
              <Button
                onClick={() => setSortBy("distance")}
                size="sm"
                variant={sortBy === "distance" ? "default" : "outline"}
                className={sortBy === "distance" ? "bg-blue-600 text-white" : "border-blue-300 text-blue-700"}
              >
                Nearest First
              </Button>
              {/* <Button
                onClick={() => setSortBy("time_window")}
                size="sm"
                variant={sortBy === "time_window" ? "default" : "outline"}
                className={sortBy === "time_window" ? "bg-blue-600 text-white" : "border-blue-300 text-blue-700"}
              >
                Time Window
              </Button> */}
            </div>
          </div>

          <div className="space-y-3">
            {sortedDeliveries.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">
                    {searchQuery ? "No packages match your search" : "No packages in manifest"}
                  </p>
                  {searchQuery && (
                    <Button
                      onClick={() => setSearchQuery("")}
                      size="sm"
                      variant="outline"
                      className="mt-3"
                    >
                      Clear Search
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              sortedDeliveries.map((delivery, index) => {
                const isCompleted = delivery.status === 'delivered';
                const isException = delivery.status === 'exception';
                const isCurrent = nextStop && delivery.id === nextStop.id; // Check against nextStop, not selectedStop

                return (
                  <Card 
                    key={delivery.id}
                    className={`border-2 ${
                      isCurrent ? 'border-green-300 bg-green-50' :
                      isCompleted ? 'border-gray-200 bg-gray-50 opacity-60' :
                      isException ? 'border-red-300 bg-red-50' :
                      'border-blue-200'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          isCompleted ? 'bg-green-600 text-white' :
                          isException ? 'bg-red-600 text-white' :
                          isCurrent ? 'bg-green-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> :
                           isException ? <XCircle className="w-5 h-5" /> :
                           delivery.route_sequence || index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-bold text-gray-900">{delivery.customer_name}</p>
                            {isCurrent && (
                              <Badge className="bg-green-600 text-white text-xs">CURRENT</Badge>
                            )}
                            {isCompleted && (
                              <Badge className="bg-green-600 text-white text-xs">DELIVERED</Badge>
                            )}
                            {isException && (
                              <Badge className="bg-red-600 text-white text-xs">EXCEPTION</Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-1">{delivery.delivery_address}</p>
                          
                          {/* Package Details */}
                          <div className="flex gap-2 flex-wrap text-xs text-gray-600 mb-2">
                            {delivery.package_weight && (
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {delivery.package_weight} lbs
                              </span>
                            )}
                            {delivery.customer_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                Contact Available
                              </span>
                            )}
                            {delivery.scheduled_delivery_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(delivery.scheduled_delivery_date), "h:mm a")}
                              </span>
                            )}
                          </div>

                          {/* Special Instructions */}
                          {delivery.carrier_notes && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200 text-xs mb-2">
                              <p className="font-semibold text-blue-900 mb-1">📝 Instructions:</p>
                              <p className="text-blue-800">{delivery.carrier_notes}</p>
                            </div>
                          )}

                          <p className="font-mono text-xs text-gray-600">{delivery.tracking_number}</p>
                        </div>
                      </div>
                      
                      {!isCompleted && !isException && (
                        <>
                          {/* Contact Buttons */}
                          {delivery.customer_phone && (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCallCustomer(delivery);
                                }}
                                size="sm"
                                variant="outline"
                                className="border-green-300 text-green-700"
                              >
                                <Phone className="w-3 h-3 mr-1" />
                                Call
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTextCustomer(delivery);
                                }}
                                size="sm"
                                variant="outline"
                                className="border-green-300 text-green-700"
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Text
                              </Button>
                            </div>
                          )}

                          {/* Main Action Buttons */}
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToStop(delivery);
                              }}
                              size="sm"
                              variant="outline"
                              className="border-blue-300 text-blue-700"
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              Nav
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStopClick(delivery);
                              }}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Deliver
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleException(delivery);
                              }}
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-700"
                            >
                              Exception
                            </Button>
                          </div>
                        </>
                      )}

                      {isCompleted && delivery.delivery_timestamp && (
                        <p className="text-xs text-green-700 mt-2">
                          ✓ Delivered at {format(new Date(delivery.delivery_timestamp), "h:mm a")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Today's Performance
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Stops Completed</span>
                  <span className="text-2xl font-bold text-green-900">{completedToday}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-gray-700">Remaining Stops</span>
                  <span className="text-2xl font-bold text-blue-900">{remainingStops}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="text-gray-700">Stops Per Hour</span>
                  <span className="text-2xl font-bold text-orange-900">{stopsPerHour}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="text-gray-700">Exceptions</span>
                  <span className="text-2xl font-bold text-red-900">{exceptionsToday}</span>
                </div>
                {routeStartTime && (
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="text-gray-700">Time on Route</span>
                    <span className="text-2xl font-bold text-purple-900">
                      {Math.floor((new Date() - new Date(routeStartTime)) / (1000 * 60))}m
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {routeStarted && (
            <Card className="border-2 border-green-200 bg-green-50 mt-4">
              <CardContent className="p-4">
                <p className="text-sm text-green-900 text-center">
                  <strong>Keep up the great work!</strong>
                  <br />
                  {remainingStops > 0 
                    ? `${remainingStops} stops remaining to complete your route.`
                    : 'All deliveries complete! Return to station.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No new messages</p>
              <p className="text-sm text-gray-500 mt-2">Dispatch communications will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Package</DialogTitle>
          </DialogHeader>
          <MobileScanner
            onScanComplete={(scanData) => {
              setShowScanDialog(false);
              if (scanData.type === 'package') {
                toast.success(`Package ${scanData.item.tracking_number} scanned`);
              }
            }}
            currentLocation={currentLocation}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Delivery</DialogTitle>
          </DialogHeader>
          {selectedStop && (
            <DeliveryProofMobile
              delivery={selectedStop}
              location={currentLocation}
              onComplete={handleProofComplete}
              onCancel={() => setShowProofDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Exception</DialogTitle>
          </DialogHeader>
          {selectedStop && (
            <ExceptionReport
              delivery={selectedStop}
              location={currentLocation}
              onComplete={handleExceptionComplete}
              onCancel={() => setShowExceptionDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Earnings Detail Dialog */}
      <Dialog open={showEarningsDetail} onOpenChange={setShowEarningsDetail}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Today's Earnings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="p-4 text-center">
                <p className="text-4xl font-bold text-green-900">${totalEarnings.toFixed(2)}</p>
                <p className="text-sm text-green-700 mt-1">Total Earned Today</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="font-semibold text-gray-900">Breakdown:</p>
              {todayDeliveries
                .filter(d => d.status === 'delivered' && d.total_carrier_payment)
                .map((delivery) => (
                  <div 
                    key={delivery.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{delivery.customer_name}</p>
                      <p className="text-xs text-gray-600 truncate">{delivery.delivery_address}</p>
                    </div>
                    <p className="font-bold text-green-700 ml-2">
                      ${delivery.total_carrier_payment.toFixed(2)}
                    </p>
                  </div>
                ))}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Deliveries</p>
                  <p className="font-bold text-gray-900">{completedToday}</p>
                </div>
                <div>
                  <p className="text-gray-600">Avg per Stop</p>
                  <p className="font-bold text-gray-900">
                    ${completedToday > 0 ? (totalEarnings / completedToday).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* End of Day */}
      {routeStarted && remainingStops === 0 && exceptionsToday === 0 && (
        <div className="fixed bottom-4 left-4 right-4">
          <Card className="border-2 border-green-300 bg-green-100">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-2" />
              <p className="font-bold text-green-900 text-lg mb-1">Route Complete!</p>
              <p className="text-sm text-green-800 mb-3">
                All {completedToday} deliveries completed successfully
              </p>
              <Button className="bg-green-600 hover:bg-green-700 w-full">
                <Home className="w-4 h-4 mr-2" />
                Return to Station
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
