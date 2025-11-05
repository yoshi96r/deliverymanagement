import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Map, Truck, MapPin, Navigation, Clock, Package,
  User, RefreshCcw, Layers
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function FleetMap() {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showDriverDetail, setShowDriverDetail] = useState(false);
  const [mapView, setMapView] = useState("all");

  const { data: drivers } = useQuery({
    queryKey: ['activeDrivers'],
    queryFn: () => base44.entities.Driver.filter({ status: 'active' }),
    initialData: [],
    refetchInterval: 10000,
  });

  const { data: deliveries } = useQuery({
    queryKey: ['activeDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.filter({ status: 'out_for_delivery' }),
    initialData: [],
    refetchInterval: 10000,
  });

  const { data: shifts } = useQuery({
    queryKey: ['activeShifts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return await base44.entities.DriverShift.filter({ 
        shift_date: today,
        status: 'in_progress'
      });
    },
    initialData: [],
    refetchInterval: 10000,
  });

  const driversOnRoute = shifts.length;
  const totalActiveDeliveries = deliveries.length;
  const completedToday = deliveries.filter(d => {
    if (!d.delivery_timestamp) return false;
    return new Date(d.delivery_timestamp).toDateString() === new Date().toDateString();
  }).length;

  const getDriverDeliveries = (driverEmail) => {
    return deliveries.filter(d => d.carrier_email === driverEmail);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Map className="w-10 h-10 text-blue-600" />
            Live Fleet Map
          </h1>
          <p className="text-gray-600">Real-time driver locations and status</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Truck className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{driversOnRoute}</p>
              <p className="text-sm text-gray-600">Drivers on Route</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{totalActiveDeliveries}</p>
              <p className="text-sm text-gray-600">Out for Delivery</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{completedToday}</p>
              <p className="text-sm text-gray-600">Delivered Today</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">
                {format(new Date(), 'h:mm a')}
              </p>
              <p className="text-sm text-gray-600">Current Time</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Placeholder */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-blue-600" />
                    Live Map View
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <RefreshCcw className="w-4 h-4 mr-1" />
                      Refresh
                    </Button>
                    <Button size="sm" variant="outline">
                      <Layers className="w-4 h-4 mr-1" />
                      Layers
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[600px] bg-gray-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Map className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-600 mb-2">Interactive map with driver locations</p>
                      <p className="text-sm text-gray-500">Click on a driver to see their details</p>
                    </div>
                  </div>

                  {/* Simulated driver markers */}
                  {shifts.slice(0, 5).map((shift, idx) => (
                    <div
                      key={shift.id}
                      className="absolute w-10 h-10 bg-blue-600 rounded-full border-4 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
                      style={{
                        left: `${20 + idx * 15}%`,
                        top: `${30 + idx * 10}%`
                      }}
                      onClick={() => {
                        const driver = drivers.find(d => d.driver_id === shift.driver_id);
                        if (driver) {
                          setSelectedDriver({
                            ...driver,
                            shift: shift,
                            deliveries: getDriverDeliveries(driver.email)
                          });
                          setShowDriverDetail(true);
                        }
                      }}
                    >
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Driver List */}
          <div>
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Active Drivers</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {shifts.map((shift) => {
                    const driver = drivers.find(d => d.driver_id === shift.driver_id);
                    const driverDeliveries = driver ? getDriverDeliveries(driver.email) : [];
                    const completed = driverDeliveries.filter(d => d.status === 'delivered').length;

                    return (
                      <Card 
                        key={shift.id}
                        className="border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-all"
                        onClick={() => {
                          if (driver) {
                            setSelectedDriver({
                              ...driver,
                              shift: shift,
                              deliveries: driverDeliveries
                            });
                            setShowDriverDetail(true);
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-gray-900">{shift.driver_name}</p>
                              <p className="text-xs text-gray-600">
                                {shift.vehicle_id || 'No vehicle assigned'}
                              </p>
                            </div>
                            <Badge className="bg-green-600">Active</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-600">Deliveries</p>
                              <p className="font-bold">{completed}/{driverDeliveries.length}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Time</p>
                              <p className="font-bold">{shift.hours_worked || 0}h</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Driver Detail Dialog */}
        <Dialog open={showDriverDetail} onOpenChange={setShowDriverDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Driver Details</DialogTitle>
            </DialogHeader>
            {selectedDriver && (
              <div className="space-y-4">
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">{selectedDriver.full_name}</h3>
                        <p className="text-gray-600">{selectedDriver.email}</p>
                        <p className="text-gray-600">{selectedDriver.phone}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge className="bg-green-600">On Route</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vehicle</p>
                        <p className="font-semibold">{selectedDriver.shift.vehicle_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Shift</p>
                        <p className="font-semibold">{selectedDriver.shift.shift_type}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200">
                  <CardHeader className="bg-green-50">
                    <CardTitle className="text-base">Today's Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold text-green-900">
                          {selectedDriver.deliveries.filter(d => d.status === 'delivered').length}
                        </p>
                        <p className="text-sm text-gray-600">Completed</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-blue-900">
                          {selectedDriver.deliveries.filter(d => d.status === 'out_for_delivery').length}
                        </p>
                        <p className="text-sm text-gray-600">Remaining</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-orange-900">
                          {selectedDriver.shift.total_miles || 0}
                        </p>
                        <p className="text-sm text-gray-600">Miles</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200">
                  <CardHeader className="bg-gray-50">
                    <CardTitle className="text-base">Current Deliveries</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDriver.deliveries.map((delivery) => (
                        <div key={delivery.id} className="p-2 bg-white border rounded flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{delivery.customer_name}</p>
                            <p className="text-xs text-gray-600">{delivery.delivery_address}</p>
                          </div>
                          <Badge className={
                            delivery.status === 'delivered' ? 'bg-green-600' :
                            delivery.status === 'out_for_delivery' ? 'bg-blue-600' :
                            'bg-gray-600'
                          }>
                            {delivery.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
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