import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Navigation, TrendingUp, Clock, CheckCircle2, 
  Circle, AlertTriangle, Maximize2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function AdvancedRouteMap({ onDriverSelect, onRouteSelect }) {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [mapView, setMapView] = useState("routes"); // "routes" or "drivers"

  const { data: activeRoutes } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => base44.entities.OptimizedRoute.filter({
      status: ['active', 'in_progress']
    }),
    initialData: [],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  // Group deliveries by driver for real-time tracking
  const driverLocations = React.useMemo(() => {
    const driversMap = {};
    
    deliveries.forEach(delivery => {
      if (!delivery.carrier_email || !delivery.current_location) return;
      
      if (!driversMap[delivery.carrier_email]) {
        driversMap[delivery.carrier_email] = {
          driverEmail: delivery.carrier_email,
          driverName: delivery.carrier_name || 'Unknown',
          location: null,
          activeRoute: null,
          completedStops: 0,
          remainingStops: 0,
          currentStop: null
        };
      }

      // Parse latest location
      const [lat, lng] = delivery.current_location.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        driversMap[delivery.carrier_email].location = { lat, lng };
      }
    });

    // Add route info
    activeRoutes.forEach(route => {
      if (driversMap[route.driver_email]) {
        driversMap[route.driver_email].activeRoute = route;
        
        const routeDeliveries = deliveries.filter(d => 
          route.delivery_ids.includes(d.id)
        );
        
        driversMap[route.driver_email].completedStops = routeDeliveries.filter(
          d => d.status === 'delivered'
        ).length;
        
        driversMap[route.driver_email].remainingStops = routeDeliveries.length - 
          driversMap[route.driver_email].completedStops;

        // Find current/next stop
        const nextDelivery = routeDeliveries.find(d => d.status === 'out_for_delivery');
        if (nextDelivery) {
          driversMap[route.driver_email].currentStop = nextDelivery;
        }
      }
    });

    return Object.values(driversMap).filter(d => d.location);
  }, [deliveries, activeRoutes]);

  // Calculate route progress
  const getRouteProgress = (route) => {
    const routeDeliveries = deliveries.filter(d => 
      route.delivery_ids.includes(d.id)
    );
    const completed = routeDeliveries.filter(d => d.status === 'delivered').length;
    const total = routeDeliveries.length;
    return { completed, total, percentage: (completed / total) * 100 };
  };

  const handleRouteClick = (route) => {
    setSelectedRoute(route);
    if (onRouteSelect) onRouteSelect(route);
  };

  const handleDriverClick = (driver) => {
    setSelectedDriver(driver);
    if (onDriverSelect) onDriverSelect(driver);
  };

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <Card className="border-2 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={mapView === "routes" ? "default" : "outline"}
                onClick={() => setMapView("routes")}
                size="sm"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Routes View
              </Button>
              <Button
                variant={mapView === "drivers" ? "default" : "outline"}
                onClick={() => setMapView("drivers")}
                size="sm"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Drivers View
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">In Progress</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-gray-600">Delayed</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routes View */}
      {mapView === "routes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900">Active Routes ({activeRoutes.length})</h3>
          </div>

          {activeRoutes.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-8 text-center">
                <Navigation className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No active routes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeRoutes.map((route) => {
                const progress = getRouteProgress(route);
                const isDelayed = false; // Calculate if route is delayed

                return (
                  <Card 
                    key={route.id}
                    className={`border-2 cursor-pointer transition-all ${
                      selectedRoute?.id === route.id 
                        ? 'border-blue-400 bg-blue-50 shadow-lg' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleRouteClick(route)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{route.route_name}</CardTitle>
                          <p className="text-sm text-gray-600">{route.driver_name}</p>
                        </div>
                        <Badge className={
                          isDelayed ? 'bg-orange-600' : 
                          route.status === 'in_progress' ? 'bg-blue-600' : 
                          'bg-green-600'
                        }>
                          {route.status === 'in_progress' ? 'In Progress' : 'Active'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-bold text-blue-900">
                            {progress.completed} / {progress.total} stops
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-green-600 h-3 rounded-full transition-all"
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Route Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-gray-50 rounded">
                          <Navigation className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                          <p className="text-xs font-bold">{route.total_distance_miles?.toFixed(1)}</p>
                          <p className="text-xs text-gray-600">Miles</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded">
                          <Clock className="w-4 h-4 mx-auto text-purple-600 mb-1" />
                          <p className="text-xs font-bold">{Math.round(route.total_estimated_time_minutes)}</p>
                          <p className="text-xs text-gray-600">Min</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded">
                          <TrendingUp className="w-4 h-4 mx-auto text-green-600 mb-1" />
                          <p className="text-xs font-bold">
                            {route.estimated_completion_time && 
                              format(new Date(route.estimated_completion_time), "h:mm a")}
                          </p>
                          <p className="text-xs text-gray-600">ETA</p>
                        </div>
                      </div>

                      {/* Next Stop */}
                      {driverLocations.find(d => d.driverEmail === route.driver_email)?.currentStop && (
                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-1">Current Stop:</p>
                          <p className="text-sm font-bold text-blue-900">
                            {driverLocations.find(d => d.driverEmail === route.driver_email).currentStop.customer_name}
                          </p>
                          <p className="text-xs text-blue-700">
                            {driverLocations.find(d => d.driverEmail === route.driver_email).currentStop.delivery_address}
                          </p>
                        </div>
                      )}

                      {/* Route visualization placeholder */}
                      <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="w-3 h-3" />
                          <span>Route: {route.start_location || 'Distribution Center'}</span>
                          <Navigation className="w-3 h-3" />
                          <span>{progress.completed} stops</span>
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Drivers View */}
      {mapView === "drivers" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900">
              Active Drivers ({driverLocations.length})
            </h3>
          </div>

          {driverLocations.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-8 text-center">
                <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No active drivers with location data</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {driverLocations.map((driver) => (
                <Card 
                  key={driver.driverEmail}
                  className={`border-2 cursor-pointer transition-all ${
                    selectedDriver?.driverEmail === driver.driverEmail
                      ? 'border-blue-400 bg-blue-50 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleDriverClick(driver)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{driver.driverName}</p>
                        <p className="text-xs text-gray-600">{driver.driverEmail}</p>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>

                    {driver.activeRoute && (
                      <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-semibold text-blue-900">
                          {driver.activeRoute.route_name}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 bg-green-50 rounded">
                        <p className="font-bold text-green-900">{driver.completedStops}</p>
                        <p className="text-gray-600">Completed</p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">
                        <p className="font-bold text-blue-900">{driver.remainingStops}</p>
                        <p className="text-gray-600">Remaining</p>
                      </div>
                    </div>

                    {driver.location && (
                      <div className="mt-3 p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="w-3 h-3" />
                          <span className="font-mono">
                            {driver.location.lat.toFixed(4)}, {driver.location.lng.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    )}

                    {driver.currentStop && (
                      <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <p className="text-xs font-semibold text-orange-900">Current Stop:</p>
                        <p className="text-xs text-orange-800">{driver.currentStop.customer_name}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Route Details */}
      {selectedRoute && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-900">
              Selected Route: {selectedRoute.route_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm"><strong>Driver:</strong> {selectedRoute.driver_name}</p>
              <p className="text-sm"><strong>Stops:</strong> {selectedRoute.delivery_ids.length}</p>
              <p className="text-sm"><strong>Status:</strong> {selectedRoute.status}</p>
              {selectedRoute.ai_insights && (
                <div className="p-2 bg-white rounded border border-blue-200">
                  <p className="text-xs font-semibold text-blue-900 mb-1">AI Insights:</p>
                  <p className="text-xs text-gray-700">{selectedRoute.ai_insights}</p>
                </div>
              )}
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedRoute(null)}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}