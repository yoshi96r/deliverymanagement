
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Route, Calendar, Plus, Truck, MapPin, Clock,
  Zap, CheckCircle2, AlertTriangle, Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RoutePlanning() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRoute, setNewRoute] = useState({
    route_name: "",
    route_type: "city",
    assigned_driver_email: "",
    assigned_vehicle_id: "",
    scheduled_start_time: "08:00"
  });

  const queryClient = useQueryClient();

  const { data: routes } = useQuery({
    queryKey: ['routeSchedules'],
    queryFn: () => base44.entities.RouteSchedule.list('-scheduled_date', 100),
    initialData: [],
  });

  const { data: drivers } = useQuery({
    queryKey: ['availableDrivers'],
    queryFn: () => base44.entities.Driver.filter({ status: 'active' }),
    initialData: [],
  });

  const { data: vehicles } = useQuery({
    queryKey: ['availableVehicles'],
    queryFn: () => base44.entities.DriverVehicle.filter({ status: 'active' }),
    initialData: [],
  });

  const { data: unassignedDeliveries } = useQuery({
    queryKey: ['unassignedDeliveries'],
    queryFn: async () => {
      const allDeliveries = await base44.entities.DeliveryRequest.filter({ 
        status: 'at_facility'
      });
      return allDeliveries;
    },
    initialData: [],
  });

  const createRouteMutation = useMutation({
    mutationFn: async (routeData) => {
      const route = await base44.entities.RouteSchedule.create({
        ...routeData,
        scheduled_date: selectedDate,
        start_location: "Main Facility",
        total_stops: 0,
        estimated_miles: 0,
        estimated_duration_minutes: 0,
        status: "planned"
      });

      // Optimize route using AI
      if (unassignedDeliveries.length > 0) {
        const optimization = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a route optimization expert. Given these deliveries, create an optimized route sequence.

Deliveries:
${unassignedDeliveries.slice(0, 20).map((d, idx) => `${idx + 1}. ${d.customer_name} - ${d.delivery_address}`).join('\n')}

Optimize for:
- Minimal total distance
- Logical geographical clustering
- Traffic patterns for morning delivery
- Time windows if any

Return a suggested sequence.`,
          response_json_schema: {
            type: "object",
            properties: {
              suggested_sequence: { type: "array", items: { type: "number" } },
              estimated_miles: { type: "number" },
              estimated_duration_minutes: { type: "number" },
              reasoning: { type: "string" }
            }
          }
        });

        toast.success(`Route optimized: ${optimization.estimated_miles} miles, ${optimization.estimated_duration_minutes} min`);
      }

      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routeSchedules'] });
      setShowCreateDialog(false);
      setNewRoute({
        route_name: "",
        route_type: "city",
        assigned_driver_email: "",
        assigned_vehicle_id: "",
        scheduled_start_time: "08:00"
      });
      toast.success("Route created!");
    },
  });

  const todayRoutes = routes.filter(r => r.scheduled_date === selectedDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Route className="w-10 h-10 text-green-600" />
            Route Planning & Scheduling
          </h1>
          <p className="text-gray-600">Plan and optimize delivery routes</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <Route className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{todayRoutes.length}</p>
              <p className="text-sm text-gray-600">Routes Today</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Truck className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{drivers.length}</p>
              <p className="text-sm text-gray-600">Available Drivers</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{unassignedDeliveries.length}</p>
              <p className="text-sm text-gray-600">Unassigned</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Zap className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">
                {routes.filter(r => r.optimization_score >= 90).length}
              </p>
              <p className="text-sm text-gray-600">Optimized</p>
            </CardContent>
          </Card>
        </div>

        {/* Date Selector and Create Button */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Route
          </Button>
        </div>

        {/* Routes List */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Routes for {format(new Date(selectedDate), "MMMM d, yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {todayRoutes.length === 0 ? (
              <div className="text-center py-12">
                <Route className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No routes scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayRoutes.map((route) => (
                  <Card key={route.id} className="border-2 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-lg text-gray-900">{route.route_name}</h4>
                          <p className="text-sm text-gray-600">{route.assigned_driver_name}</p>
                        </div>
                        <Badge className={
                          route.status === 'completed' ? 'bg-green-600' :
                          route.status === 'in_progress' ? 'bg-blue-600' :
                          route.status === 'started' ? 'bg-orange-600' :
                          'bg-gray-600'
                        }>
                          {route.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Stops</p>
                          <p className="font-bold text-gray-900">{route.total_stops || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Miles</p>
                          <p className="font-bold text-gray-900">{route.estimated_miles || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Duration</p>
                          <p className="font-bold text-gray-900">{route.estimated_duration_minutes || 0}m</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Start Time</p>
                          <p className="font-bold text-gray-900">{route.scheduled_start_time}</p>
                        </div>
                      </div>

                      {route.optimization_score && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                route.optimization_score >= 90 ? 'bg-green-500' :
                                route.optimization_score >= 70 ? 'bg-blue-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${route.optimization_score}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-gray-700">
                            {route.optimization_score}% optimized
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Route Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Route</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Route Name *</Label>
                <Input
                  value={newRoute.route_name}
                  onChange={(e) => setNewRoute({...newRoute, route_name: e.target.value})}
                  placeholder="Route 101"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Route Type</Label>
                  <Select
                    value={newRoute.route_type}
                    onValueChange={(v) => setNewRoute({...newRoute, route_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rural">Rural</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                      <SelectItem value="suburban">Suburban</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newRoute.scheduled_start_time}
                    onChange={(e) => setNewRoute({...newRoute, scheduled_start_time: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Assign Driver</Label>
                  <Select
                    value={newRoute.assigned_driver_email}
                    onValueChange={(v) => {
                      const driver = drivers.find(d => d.email === v);
                      setNewRoute({
                        ...newRoute, 
                        assigned_driver_email: v,
                        assigned_driver_name: driver?.full_name || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.email}>
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Assign Vehicle</Label>
                  <Select
                    value={newRoute.assigned_vehicle_id}
                    onValueChange={(v) => setNewRoute({...newRoute, assigned_vehicle_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.vehicle_id}>
                          {vehicle.vehicle_number} - {vehicle.make} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  📦 {unassignedDeliveries.length} packages available to assign
                </p>
                <p className="text-xs text-blue-700">
                  AI will optimize the route based on location, traffic, and delivery windows
                </p>
              </div>

              <Button
                onClick={() => createRouteMutation.mutate(newRoute)}
                disabled={!newRoute.route_name || !newRoute.assigned_driver_email || createRouteMutation.isPending}
                className="w-full bg-green-600"
              >
                {createRouteMutation.isPending ? "Creating & Optimizing..." : "Create Route"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
