import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, AlertTriangle, Package, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DriverMapView({ deliveries, exceptions, onDriverClick }) {
  const [driverLocations, setDriverLocations] = useState([]);

  useEffect(() => {
    // Group deliveries by driver and get their current locations
    const driversMap = {};
    
    deliveries.forEach(delivery => {
      if (!delivery.carrier_email) return;
      
      if (!driversMap[delivery.carrier_email]) {
        driversMap[delivery.carrier_email] = {
          driverEmail: delivery.carrier_email,
          driverName: delivery.carrier_name || 'Unknown Driver',
          locations: [],
          deliveries: [],
          activeExceptions: 0,
          escalatedExceptions: 0,
          status: 'idle'
        };
      }

      driversMap[delivery.carrier_email].deliveries.push(delivery);
      
      // Parse location
      if (delivery.current_location) {
        const [lat, lng] = delivery.current_location.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          driversMap[delivery.carrier_email].locations.push({ lat, lng, delivery });
        }
      }

      // Count exceptions
      const driverExceptions = exceptions.filter(e => e.reported_by_email === delivery.carrier_email);
      driversMap[delivery.carrier_email].activeExceptions = driverExceptions.filter(e => e.resolution_status !== 'resolved').length;
      driversMap[delivery.carrier_email].escalatedExceptions = driverExceptions.filter(e => e.escalated && e.resolution_status === 'escalated').length;

      // Determine status
      if (driversMap[delivery.carrier_email].escalatedExceptions > 0) {
        driversMap[delivery.carrier_email].status = 'escalated';
      } else if (driversMap[delivery.carrier_email].activeExceptions > 0) {
        driversMap[delivery.carrier_email].status = 'exception';
      } else if (delivery.status === 'out_for_delivery') {
        driversMap[delivery.carrier_email].status = 'on_route';
      } else if (delivery.status === 'delivered') {
        driversMap[delivery.carrier_email].status = 'completed';
      }
    });

    setDriverLocations(Object.values(driversMap));
  }, [deliveries, exceptions]);

  const statusConfig = {
    on_route: { color: 'bg-blue-500', label: 'On Route', icon: Navigation },
    exception: { color: 'bg-orange-500', label: 'Exception', icon: AlertTriangle },
    escalated: { color: 'bg-red-500 animate-pulse', label: 'Escalated', icon: AlertTriangle },
    completed: { color: 'bg-green-500', label: 'Completed', icon: CheckCircle2 },
    idle: { color: 'bg-gray-400', label: 'Idle', icon: Package }
  };

  return (
    <div className="space-y-4">
      {/* Map Legend */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="pb-3 bg-blue-50">
          <CardTitle className="text-base">Driver Status Legend</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusConfig).map(([status, config]) => {
              const Icon = config.icon;
              return (
                <div key={status} className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", config.color)} />
                  <Icon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{config.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Driver List/Map View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {driverLocations.map((driver) => {
          const config = statusConfig[driver.status] || statusConfig.idle;
          const Icon = config.icon;
          const latestLocation = driver.locations[driver.locations.length - 1];

          return (
            <Card
              key={driver.driverEmail}
              className={cn(
                "border-2 cursor-pointer hover:shadow-lg transition-all",
                driver.status === 'escalated' ? 'border-red-300 bg-red-50 ring-2 ring-red-400' :
                driver.status === 'exception' ? 'border-orange-300 bg-orange-50' :
                driver.status === 'on_route' ? 'border-blue-300 bg-blue-50' :
                'border-gray-200'
              )}
              onClick={() => onDriverClick && onDriverClick(driver)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.color)}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{driver.driverName}</p>
                      <p className="text-xs text-gray-600">{driver.driverEmail}</p>
                    </div>
                  </div>
                  <Badge className={config.color}>{config.label}</Badge>
                </div>

                {latestLocation && (
                  <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span className="font-mono">
                        {latestLocation.lat.toFixed(4)}, {latestLocation.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{driver.deliveries.length}</p>
                    <p className="text-xs text-gray-600">Packages</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{driver.activeExceptions}</p>
                    <p className="text-xs text-gray-600">Exceptions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{driver.escalatedExceptions}</p>
                    <p className="text-xs text-gray-600">Escalated</p>
                  </div>
                </div>

                {driver.escalatedExceptions > 0 && (
                  <div className="mt-3 p-2 bg-red-100 rounded-lg border border-red-300">
                    <p className="text-xs font-bold text-red-900 text-center">
                      🚨 NEEDS IMMEDIATE SUPPORT
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {driverLocations.length === 0 && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-12 text-center">
            <Navigation className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 text-lg">No active drivers</p>
            <p className="text-sm text-gray-500 mt-2">Drivers will appear here when they start their routes</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}