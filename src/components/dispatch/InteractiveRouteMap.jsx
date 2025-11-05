import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, Navigation, User, Package, AlertTriangle, 
  CheckCircle2, Clock, TrendingUp, Maximize2, Minimize2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom driver marker icons
const createDriverIcon = (status, hasException) => {
  const color = 
    hasException ? '#ef4444' : // red for exceptions
    status === 'on_route' ? '#3b82f6' : // blue for active
    status === 'completed' ? '#22c55e' : // green for completed
    '#9ca3af'; // gray for idle

  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: 32px;
          height: 32px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          ${hasException ? 'animation: pulse 2s infinite;' : ''}
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        ${hasException ? '<div style="position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; background: #dc2626; border: 2px solid white; border-radius: 50%;"></div>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
};

const createStopIcon = (completed, isNext) => {
  const color = completed ? '#22c55e' : isNext ? '#f59e0b' : '#3b82f6';
  
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        ${isNext ? 'animation: pulse 2s infinite;' : ''}
      ">
        ${completed ? '✓' : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });
};

// Component to auto-fit map bounds
function MapBounds({ bounds }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  
  return null;
}

export default function InteractiveRouteMap({ onDriverSelect, onRouteSelect, fullScreen = false }) {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [mapView, setMapView] = useState("all"); // "all", "routes", "drivers"
  const [isFullScreen, setIsFullScreen] = useState(fullScreen);

  const { data: activeRoutes } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => base44.entities.OptimizedRoute.filter({
      status: ['active', 'in_progress']
    }),
    initialData: [],
    refetchInterval: 10000,
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const { data: exceptions } = useQuery({
    queryKey: ['allExceptions'],
    queryFn: () => base44.entities.DeliveryException.list(),
    initialData: [],
  });

  // Process driver locations
  const driverLocations = React.useMemo(() => {
    const driversMap = {};
    
    deliveries.forEach(delivery => {
      if (!delivery.carrier_email || !delivery.current_location) return;
      
      const [lat, lng] = delivery.current_location.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) return;
      
      if (!driversMap[delivery.carrier_email]) {
        driversMap[delivery.carrier_email] = {
          driverEmail: delivery.carrier_email,
          driverName: delivery.carrier_name || 'Unknown',
          location: { lat, lng },
          activeRoute: null,
          completedStops: 0,
          remainingStops: 0,
          currentStop: null,
          hasExceptions: false,
          status: 'idle'
        };
      }
      
      // Update location to most recent
      driversMap[delivery.carrier_email].location = { lat, lng };
      
      // Check for exceptions
      const driverExceptions = exceptions.filter(e => 
        e.reported_by_email === delivery.carrier_email && 
        e.resolution_status !== 'resolved'
      );
      driversMap[delivery.carrier_email].hasExceptions = driverExceptions.length > 0;
      
      // Update status
      if (delivery.status === 'out_for_delivery') {
        driversMap[delivery.carrier_email].status = 'on_route';
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

        const nextDelivery = routeDeliveries.find(d => d.status === 'out_for_delivery');
        if (nextDelivery) {
          driversMap[route.driver_email].currentStop = nextDelivery;
        }
      }
    });

    return Object.values(driversMap);
  }, [deliveries, activeRoutes, exceptions]);

  // Process route paths
  const routePaths = React.useMemo(() => {
    return activeRoutes.map(route => {
      const stops = route.delivery_ids
        .map(id => deliveries.find(d => d.id === id))
        .filter(d => d && d.current_location)
        .map(d => {
          const [lat, lng] = d.current_location.split(',').map(Number);
          return {
            position: [lat, lng],
            delivery: d,
            completed: d.status === 'delivered'
          };
        });

      // Add driver location as start if available
      const driver = driverLocations.find(d => d.driverEmail === route.driver_email);
      if (driver) {
        stops.unshift({
          position: [driver.location.lat, driver.location.lng],
          isDriverLocation: true
        });
      }

      return {
        route,
        stops,
        pathCoordinates: stops.map(s => s.position),
        progress: {
          completed: stops.filter(s => s.completed).length,
          total: route.delivery_ids.length
        }
      };
    });
  }, [activeRoutes, deliveries, driverLocations]);

  // Calculate map bounds
  const mapBounds = React.useMemo(() => {
    const bounds = [];
    
    driverLocations.forEach(driver => {
      bounds.push([driver.location.lat, driver.location.lng]);
    });
    
    routePaths.forEach(route => {
      route.stops.forEach(stop => {
        bounds.push(stop.position);
      });
    });
    
    return bounds.length > 0 ? bounds : [[40.7128, -74.0060]]; // Default to NYC
  }, [driverLocations, routePaths]);

  const handleDriverClick = (driver) => {
    setSelectedDriver(driver);
    setSelectedRoute(null);
    if (onDriverSelect) onDriverSelect(driver);
  };

  const handleRouteClick = (routeData) => {
    setSelectedRoute(routeData);
    setSelectedDriver(null);
    if (onRouteSelect) onRouteSelect(routeData.route);
  };

  const center = mapBounds.length > 0 ? mapBounds[0] : [40.7128, -74.0060];

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <Card className="border-2 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              <Button
                variant={mapView === "all" ? "default" : "outline"}
                onClick={() => setMapView("all")}
                size="sm"
              >
                <MapPin className="w-4 h-4 mr-2" />
                All ({driverLocations.length} drivers, {routePaths.length} routes)
              </Button>
              <Button
                variant={mapView === "routes" ? "default" : "outline"}
                onClick={() => setMapView("routes")}
                size="sm"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Routes Only
              </Button>
              <Button
                variant={mapView === "drivers" ? "default" : "outline"}
                onClick={() => setMapView("drivers")}
                size="sm"
              >
                <User className="w-4 h-4 mr-2" />
                Drivers Only
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Exception</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullScreen(!isFullScreen)}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Container */}
      <Card className="border-2 border-blue-300 overflow-hidden">
        <div style={{ height: isFullScreen ? '800px' : '500px', width: '100%' }}>
          <MapContainer
            center={center}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapBounds bounds={mapBounds} />

            {/* Driver Markers */}
            {(mapView === "all" || mapView === "drivers") && driverLocations.map((driver) => (
              <Marker
                key={driver.driverEmail}
                position={[driver.location.lat, driver.location.lng]}
                icon={createDriverIcon(driver.status, driver.hasExceptions)}
                eventHandlers={{
                  click: () => handleDriverClick(driver)
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <p className="font-bold text-gray-900">{driver.driverName}</p>
                    </div>
                    
                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge className={
                          driver.hasExceptions ? 'bg-red-600' :
                          driver.status === 'on_route' ? 'bg-blue-600' :
                          driver.status === 'completed' ? 'bg-green-600' :
                          'bg-gray-600'
                        }>
                          {driver.hasExceptions ? 'Exception' : driver.status}
                        </Badge>
                      </div>
                      
                      {driver.activeRoute && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Route:</span>
                            <span className="font-semibold">{driver.activeRoute.route_name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Progress:</span>
                            <span className="font-semibold">
                              {driver.completedStops}/{driver.completedStops + driver.remainingStops}
                            </span>
                          </div>
                        </>
                      )}
                      
                      {driver.currentStop && (
                        <div className="p-2 bg-orange-50 rounded border border-orange-200 mt-2">
                          <p className="text-xs font-semibold text-orange-900">Next Stop:</p>
                          <p className="text-xs text-orange-800">{driver.currentStop.customer_name}</p>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleDriverClick(driver)}
                    >
                      View Details
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route Paths and Stop Markers */}
            {(mapView === "all" || mapView === "routes") && routePaths.map((routeData, idx) => {
              const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
              const routeColor = colors[idx % colors.length];
              
              return (
                <React.Fragment key={routeData.route.id}>
                  {/* Route Path Line */}
                  {routeData.pathCoordinates.length > 1 && (
                    <Polyline
                      positions={routeData.pathCoordinates}
                      color={routeColor}
                      weight={4}
                      opacity={0.7}
                      eventHandlers={{
                        click: () => handleRouteClick(routeData)
                      }}
                    />
                  )}
                  
                  {/* Stop Markers */}
                  {routeData.stops.map((stop, stopIdx) => {
                    if (stop.isDriverLocation) return null; // Skip driver location marker
                    
                    const isCompleted = stop.completed;
                    const isNext = stopIdx === routeData.stops.findIndex(s => !s.completed && !s.isDriverLocation);
                    
                    return (
                      <Marker
                        key={`${routeData.route.id}-stop-${stopIdx}`}
                        position={stop.position}
                        icon={createStopIcon(isCompleted, isNext)}
                      >
                        <Popup>
                          <div className="p-2 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              <p className="font-bold text-sm">Stop #{stopIdx}</p>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <p className="font-semibold">{stop.delivery?.customer_name}</p>
                              <p className="text-xs text-gray-600">{stop.delivery?.delivery_address}</p>
                              <p className="text-xs text-gray-600">
                                Tracking: {stop.delivery?.tracking_number}
                              </p>
                              
                              <Badge className={isCompleted ? 'bg-green-600' : isNext ? 'bg-orange-600' : 'bg-blue-600'}>
                                {isCompleted ? 'Completed' : isNext ? 'Next Stop' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>
      </Card>

      {/* Selected Driver Details */}
      {selectedDriver && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardHeader className="pb-3 bg-blue-100 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {selectedDriver.driverName}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDriver(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-white rounded">
                <p className="text-gray-600">Email:</p>
                <p className="font-semibold text-xs">{selectedDriver.driverEmail}</p>
              </div>
              <div className="p-2 bg-white rounded">
                <p className="text-gray-600">Status:</p>
                <Badge className={
                  selectedDriver.hasExceptions ? 'bg-red-600' :
                  selectedDriver.status === 'on_route' ? 'bg-blue-600' :
                  'bg-green-600'
                }>
                  {selectedDriver.hasExceptions ? 'Has Exception' : selectedDriver.status}
                </Badge>
              </div>
            </div>

            {selectedDriver.activeRoute && (
              <>
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-2">{selectedDriver.activeRoute.route_name}</p>
                  <Progress 
                    value={(selectedDriver.completedStops / (selectedDriver.completedStops + selectedDriver.remainingStops)) * 100}
                    className="mb-2"
                  />
                  <p className="text-sm text-gray-700">
                    {selectedDriver.completedStops} of {selectedDriver.completedStops + selectedDriver.remainingStops} stops completed
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-white rounded text-center">
                    <Navigation className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                    <p className="text-xs font-bold">{selectedDriver.activeRoute.total_distance_miles?.toFixed(1)}</p>
                    <p className="text-xs text-gray-600">Miles</p>
                  </div>
                  <div className="p-2 bg-white rounded text-center">
                    <Clock className="w-4 h-4 mx-auto text-purple-600 mb-1" />
                    <p className="text-xs font-bold">{Math.round(selectedDriver.activeRoute.total_estimated_time_minutes)}</p>
                    <p className="text-xs text-gray-600">Min</p>
                  </div>
                  <div className="p-2 bg-white rounded text-center">
                    <TrendingUp className="w-4 h-4 mx-auto text-green-600 mb-1" />
                    <p className="text-xs font-bold">
                      {selectedDriver.activeRoute.estimated_completion_time &&
                        format(new Date(selectedDriver.activeRoute.estimated_completion_time), "h:mm a")}
                    </p>
                    <p className="text-xs text-gray-600">ETA</p>
                  </div>
                </div>
              </>
            )}

            {selectedDriver.currentStop && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs font-semibold text-orange-900 mb-1">Current Stop:</p>
                <p className="text-sm font-bold text-orange-900">{selectedDriver.currentStop.customer_name}</p>
                <p className="text-xs text-orange-700">{selectedDriver.currentStop.delivery_address}</p>
              </div>
            )}

            {selectedDriver.location && (
              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <MapPin className="w-3 h-3" />
                  <span className="font-mono">
                    {selectedDriver.location.lat.toFixed(6)}, {selectedDriver.location.lng.toFixed(6)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Route Details */}
      {selectedRoute && (
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader className="pb-3 bg-purple-100 border-b border-purple-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-purple-900 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                {selectedRoute.route.route_name}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRoute(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="p-3 bg-white rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-purple-900">Driver: {selectedRoute.route.driver_name}</p>
                <Badge className="bg-purple-600">
                  {selectedRoute.route.delivery_ids.length} stops
                </Badge>
              </div>
              
              <Progress 
                value={(selectedRoute.progress.completed / selectedRoute.progress.total) * 100}
                className="mb-2"
              />
              
              <p className="text-sm text-gray-700">
                {selectedRoute.progress.completed} of {selectedRoute.progress.total} stops completed
                ({Math.round((selectedRoute.progress.completed / selectedRoute.progress.total) * 100)}%)
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-white rounded text-center">
                <p className="text-lg font-bold text-blue-900">
                  {selectedRoute.route.total_distance_miles?.toFixed(1)}
                </p>
                <p className="text-xs text-gray-600">Miles</p>
              </div>
              <div className="p-2 bg-white rounded text-center">
                <p className="text-lg font-bold text-purple-900">
                  {Math.round(selectedRoute.route.total_estimated_time_minutes)}
                </p>
                <p className="text-xs text-gray-600">Minutes</p>
              </div>
              <div className="p-2 bg-white rounded text-center">
                <p className="text-lg font-bold text-green-900">
                  {selectedRoute.route.estimated_completion_time &&
                    format(new Date(selectedRoute.route.estimated_completion_time), "h:mm a")}
                </p>
                <p className="text-xs text-gray-600">ETA</p>
              </div>
            </div>

            {/* Stop List */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              <p className="text-sm font-semibold text-gray-900">Route Stops:</p>
              {selectedRoute.stops.filter(s => !s.isDriverLocation).map((stop, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded border ${
                    stop.completed ? 'bg-green-50 border-green-200' :
                    idx === selectedRoute.stops.findIndex(s => !s.completed && !s.isDriverLocation) ? 'bg-orange-50 border-orange-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {stop.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : idx === selectedRoute.stops.findIndex(s => !s.completed && !s.isDriverLocation) ? (
                      <Clock className="w-4 h-4 text-orange-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{stop.delivery?.customer_name}</p>
                      <p className="text-xs text-gray-600">{stop.delivery?.delivery_address}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedRoute.route.ai_insights && (
              <div className="p-2 bg-white rounded border border-purple-200">
                <p className="text-xs font-semibold text-purple-900 mb-1">AI Insights:</p>
                <p className="text-xs text-gray-700">{selectedRoute.route.ai_insights}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Map Legend */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-gray-700">Active Driver</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-gray-700">Driver w/ Exception</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-gray-700">Completed Stop</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-gray-700">Next Stop</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="border-2 border-blue-200">
          <CardContent className="p-4 text-center">
            <User className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-blue-900">{driverLocations.length}</p>
            <p className="text-xs text-gray-600">Active Drivers</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-purple-200">
          <CardContent className="p-4 text-center">
            <Navigation className="w-6 h-6 mx-auto text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-purple-900">{routePaths.length}</p>
            <p className="text-xs text-gray-600">Active Routes</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-900">
              {routePaths.reduce((sum, r) => sum + r.progress.completed, 0)}
            </p>
            <p className="text-xs text-gray-600">Stops Completed</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-red-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-600 mb-2" />
            <p className="text-2xl font-bold text-red-900">
              {driverLocations.filter(d => d.hasExceptions).length}
            </p>
            <p className="text-xs text-gray-600">Drivers w/ Exceptions</p>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}