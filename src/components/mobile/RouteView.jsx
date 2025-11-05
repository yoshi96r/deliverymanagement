
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Package, CheckCircle2, Clock, Shield, AlertTriangle, MessageSquare } from "lucide-react";
import DriverRouteFeedbackPanel from "./DriverRouteFeedbackPanel";
import MultiPointFeedbackPanel from "./MultiPointFeedbackPanel"; // NEW import
import RealTimeReroutingDisplay from "./RealTimeReroutingDisplay"; // NEW import
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from 'date-fns'; // Added for ETA formatting

export default function RouteView({ deliveries, currentLocation, onCompleteDelivery, onReportException }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMultiPointFeedback, setShowMultiPointFeedback] = useState(false); // NEW state

  // Get current user's email - in production, this would come from auth
  // Assuming all deliveries in a batch belong to the same carrier/driver
  const driverEmail = deliveries[0]?.carrier_email;
  const driverName = deliveries[0]?.carrier_name; // NEW: Added driverName
  
  const { data: activeRoutes } = useQuery({
    queryKey: ['driverActiveRoute', driverEmail],
    queryFn: async () => {
      if (!driverEmail) return [];
      const routes = await base44.entities.OptimizedRoute.filter({
        driver_email: driverEmail,
        status: ['active', 'in_progress']
      });
      return routes;
    },
    enabled: !!driverEmail,
    initialData: [],
  });

  const activeRoute = activeRoutes.length > 0 ? activeRoutes[0] : null;

  // Sort deliveries based on optimized route or default sorting
  const sortedDeliveries = React.useMemo(() => {
    if (activeRoute && activeRoute.delivery_ids) {
      // Sort by optimized sequence
      const sequenceMap = {};
      activeRoute.delivery_ids.forEach((id, index) => {
        sequenceMap[id] = index;
      });

      return [...deliveries]
        .filter(d => sequenceMap[d.id] !== undefined) // Only include deliveries part of the active route
        .sort((a, b) => sequenceMap[a.id] - sequenceMap[b.id]);
    } else {
      // Default sorting
      return [...deliveries].sort((a, b) => {
        if (a.status === 'out_for_delivery' && b.status !== 'out_for_delivery') return -1;
        if (b.status === 'out_for_delivery' && a.status !== 'out_for_delivery') return 1;
        return 0;
      });
    }
  }, [deliveries, activeRoute]);

  const openMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    if (currentLocation) {
      window.open(`https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${encodedAddress}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/${encodedAddress}`, '_blank');
    }
  };

  // Track when delivery action starts (for timing analysis)
  const handleCompleteDelivery = (delivery) => {
    // Add start time for behavior monitoring
    // We create a shallow copy to avoid directly mutating the prop if it's not expected
    const deliveryWithStartTime = { ...delivery, _deliveryStartTime: new Date() };
    onCompleteDelivery(deliveryWithStartTime);
  };

  return (
    <div className="space-y-4">
      {/* Real-Time Rerouting Display - NEW */}
      {activeRoute && (
        <RealTimeReroutingDisplay
          driverEmail={driverEmail}
          routeId={activeRoute.id}
        />
      )}

      {/* Optimized Route Banner */}
      {activeRoute && (
        <Card className="border-2 border-green-300 bg-gradient-to-r from-green-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900 mb-1">🤖 AI-Optimized Route Active</p>
                <p className="text-sm text-green-800 mb-2">
                  Follow this sequence for maximum efficiency
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded p-2 text-center">
                    <p className="font-bold text-blue-900">{activeRoute.total_distance_miles?.toFixed(1) || 'N/A'}</p>
                    <p className="text-gray-600">Miles</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <p className="font-bold text-purple-900">{Math.round(activeRoute.total_estimated_time_minutes) || 'N/A'}</p>
                    <p className="text-gray-600">Minutes</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <p className="font-bold text-green-900">
                      {activeRoute.estimated_completion_time ? 
                        format(new Date(activeRoute.estimated_completion_time), "h:mm a") : 'N/A'}
                    </p>
                    <p className="text-gray-600">ETA</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Feedback Buttons - NEW */}
      {activeRoute && deliveries.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setShowMultiPointFeedback(!showMultiPointFeedback)}
            variant="outline"
            className="border-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Issues
          </Button>
          <Button
            onClick={() => setShowFeedback(!showFeedback)}
            variant="outline"
            className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Quick Feedback
          </Button>
        </div>
      )}

      {/* Multi-Point Feedback Panel - NEW */}
      {showMultiPointFeedback && activeRoute && (
        <MultiPointFeedbackPanel
          route={activeRoute}
          driverEmail={driverEmail}
          driverName={driverName}
          currentLocation={currentLocation}
        />
      )}

      {/* Route Feedback Panel - Keep existing simple feedback */}
      {showFeedback && activeRoute && !showMultiPointFeedback && (
        <DriverRouteFeedbackPanel
          route={activeRoute}
          driverEmail={driverEmail}
          driverName={driverName}
        />
      )}

      {sortedDeliveries.map((delivery, index) => {
        const sequenceInfo = activeRoute?.optimized_sequence?.find(
          s => s.delivery_id === delivery.id
        );

        return (
          <Card 
            key={delivery.id} 
            className={`border-2 ${
              activeRoute ? 'border-green-300 bg-green-50' :
              delivery.has_premium_insurance ? 'border-yellow-300 bg-yellow-50' : 'border-blue-200'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  activeRoute ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{delivery.customer_name}</p>
                      <p className="font-mono text-xs text-gray-600">{delivery.tracking_number}</p>
                    </div>
                    {delivery.has_premium_insurance && (
                      <Badge className="bg-yellow-500 text-white text-xs flex-shrink-0">
                        <Shield className="w-3 h-3 mr-1" />
                        {delivery.insurance_tier?.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-start gap-2 text-sm text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="flex-1">{delivery.delivery_address}</p>
                  </div>

                  {/* AI Route Info */}
                  {activeRoute && sequenceInfo && (
                    <div className="p-2 bg-white rounded-lg border border-green-300 mb-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-green-600" />
                          <span className="text-gray-600">ETA:</span>
                          <span className="font-bold text-green-900">{sequenceInfo.estimated_arrival}</span>
                        </div>
                        {sequenceInfo.distance_from_previous > 0 && (
                          <div className="flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-green-600" />
                            <span className="text-gray-600">Distance:</span>
                            <span className="font-bold text-green-900">
                              {sequenceInfo.distance_from_previous.toFixed(1)} mi
                            </span>
                          </div>
                        )}
                      </div>
                      {sequenceInfo.notes && (
                        <p className="text-xs text-green-800 mt-1 italic">💡 {sequenceInfo.notes}</p>
                      )}
                    </div>
                  )}

                  {delivery.carrier_notes && (
                    <div className="p-2 bg-blue-50 rounded text-xs text-blue-900 mb-2">
                      📝 {delivery.carrier_notes}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={
                        delivery.status === 'out_for_delivery' ? 'border-blue-500 text-blue-700' : 'border-gray-300'
                      }
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {delivery.status === 'out_for_delivery' ? 'On Route' : 'Ready'}
                    </Badge>
                    
                    {delivery.package_weight && (
                      <Badge variant="outline" className="text-xs">
                        {delivery.package_weight} lbs
                      </Badge>
                    )}

                    {delivery.package_value && (
                      <Badge variant="outline" className="text-xs text-green-700">
                        ${delivery.package_value}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openMaps(delivery.delivery_address)}
                  variant="outline"
                  className="border-blue-300 text-blue-700"
                >
                  <Navigation className="w-4 h-4 mr-1" />
                  Navigate
                </Button>
                <Button
                  onClick={() => handleCompleteDelivery(delivery)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Complete
                </Button>
                <Button
                  onClick={() => onReportException(delivery)}
                  variant="outline"
                  className="border-red-300 text-red-700"
                >
                  <AlertTriangle className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {sortedDeliveries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No packages in route</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
