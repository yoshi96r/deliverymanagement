import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Search, Plus, UserCheck, UserX, Truck,
  Calendar, DollarSign, Award, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DriverManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  const [newDriver, setNewDriver] = useState({
    full_name: "",
    email: "",
    phone: "",
    license_number: "",
    license_state: "",
    employment_type: "full_time",
    pay_rate: 0,
    pay_type: "per_delivery"
  });

  const queryClient = useQueryClient();

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list('-hire_date'),
    initialData: [],
  });

  const { data: vehicles } = useQuery({
    queryKey: ['driverVehicles'],
    queryFn: () => base44.entities.DriverVehicle.list(),
    initialData: [],
  });

  const { data: shifts } = useQuery({
    queryKey: ['driverShifts'],
    queryFn: () => base44.entities.DriverShift.list('-shift_date', 50),
    initialData: [],
  });

  const addDriverMutation = useMutation({
    mutationFn: async (driverData) => {
      return await base44.entities.Driver.create({
        ...driverData,
        driver_id: `DRV-${Date.now()}`,
        status: "active",
        hire_date: new Date().toISOString().split('T')[0],
        total_deliveries: 0,
        total_miles_driven: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setShowAddDriver(false);
      setNewDriver({
        full_name: "",
        email: "",
        phone: "",
        license_number: "",
        license_state: "",
        employment_type: "full_time",
        pay_rate: 0,
        pay_type: "per_delivery"
      });
      toast.success("Driver added successfully!");
    },
  });

  const updateDriverStatusMutation = useMutation({
    mutationFn: async ({ driverId, status }) => {
      await base44.entities.Driver.update(driverId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success("Driver status updated");
    },
  });

  const filteredDrivers = useMemo(() => {
    return drivers.filter(driver => {
      const matchesSearch = !searchQuery || 
        driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.driver_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || driver.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

  const activeDrivers = drivers.filter(d => d.status === "active").length;
  const availableVehicles = vehicles.filter(v => v.status === "active" && !v.current_driver_id).length;
  const todayShifts = shifts.filter(s => {
    const today = new Date().toISOString().split('T')[0];
    return s.shift_date === today;
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Users className="w-10 h-10 text-blue-600" />
            Driver Management
          </h1>
          <p className="text-gray-600">Manage your delivery team</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Drivers</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{drivers.length}</p>
                </div>
                <Users className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Drivers</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{activeDrivers}</p>
                </div>
                <UserCheck className="w-12 h-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Vehicles Available</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{availableVehicles}</p>
                </div>
                <Truck className="w-12 h-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Today's Shifts</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{todayShifts}</p>
                </div>
                <Calendar className="w-12 h-12 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="drivers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-md">
            <TabsTrigger value="drivers">
              <Users className="w-4 h-4 mr-2" />
              Drivers
            </TabsTrigger>
            <TabsTrigger value="vehicles">
              <Truck className="w-4 h-4 mr-2" />
              Vehicles
            </TabsTrigger>
            <TabsTrigger value="shifts">
              <Calendar className="w-4 h-4 mr-2" />
              Shifts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="space-y-6">
            {/* Search and Filters */}
            <Card className="border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[300px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, email, or ID..."
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48 h-12">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => setShowAddDriver(true)}
                    className="bg-blue-600 hover:bg-blue-700 h-12"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Driver
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Drivers List */}
            <div className="space-y-3">
              {filteredDrivers.map((driver) => (
                <Card key={driver.id} className="border-2 border-gray-200 hover:border-blue-300 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-gray-900 text-lg">{driver.full_name}</h4>
                          <Badge variant="outline">{driver.driver_id}</Badge>
                          <Badge className={
                            driver.status === "active" ? "bg-green-600" :
                            driver.status === "inactive" ? "bg-gray-600" :
                            driver.status === "suspended" ? "bg-red-600" :
                            "bg-orange-600"
                          }>
                            {driver.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                          <div>
                            <p className="text-gray-600">Email</p>
                            <p className="font-semibold">{driver.email}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Phone</p>
                            <p className="font-semibold">{driver.phone}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">License</p>
                            <p className="font-semibold">{driver.license_number}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Deliveries</p>
                            <p className="font-semibold">{driver.total_deliveries || 0}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                          <div>
                            <p className="text-gray-600">Employment</p>
                            <p className="font-semibold capitalize">{driver.employment_type?.replace(/_/g, ' ')}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Pay Rate</p>
                            <p className="font-semibold">${driver.pay_rate} / {driver.pay_type}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Hired</p>
                            <p className="font-semibold">{driver.hire_date ? format(new Date(driver.hire_date), "MMM d, yyyy") : "N/A"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {driver.status === "active" && (
                          <Button
                            onClick={() => updateDriverStatusMutation.mutate({ driverId: driver.id, status: "inactive" })}
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700"
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Deactivate
                          </Button>
                        )}
                        {driver.status === "inactive" && (
                          <Button
                            onClick={() => updateDriverStatusMutation.mutate({ driverId: driver.id, status: "active" })}
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-700"
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Activate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="vehicles">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Fleet Vehicles ({vehicles.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {vehicles.length === 0 ? (
                  <div className="text-center py-12">
                    <Truck className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No vehicles registered</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vehicles.map((vehicle) => (
                      <Card key={vehicle.id} className="border-2 border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">{vehicle.vehicle_number}</Badge>
                                <Badge variant="outline">{vehicle.license_plate}</Badge>
                                <Badge className={vehicle.status === "active" ? "bg-green-600" : "bg-gray-600"}>
                                  {vehicle.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-2">Type: {vehicle.vehicle_type?.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shifts">
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Recent Shifts</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {shifts.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No shifts scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shifts.map((shift) => (
                      <Card key={shift.id} className="border-2 border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900">{shift.driver_name}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {format(new Date(shift.shift_date), "MMMM d, yyyy")} - {shift.shift_type}
                              </p>
                              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                                <div>
                                  <p className="text-gray-600">Deliveries</p>
                                  <p className="font-semibold">{shift.total_deliveries || 0}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Miles</p>
                                  <p className="font-semibold">{shift.total_miles || 0}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Hours</p>
                                  <p className="font-semibold">{shift.hours_worked || 0}</p>
                                </div>
                              </div>
                            </div>
                            <Badge className={
                              shift.status === "completed" ? "bg-green-600" :
                              shift.status === "in_progress" ? "bg-blue-600" :
                              "bg-gray-600"
                            }>
                              {shift.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Driver Dialog */}
        <Dialog open={showAddDriver} onOpenChange={setShowAddDriver}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Driver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={newDriver.full_name}
                    onChange={(e) => setNewDriver({...newDriver, full_name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newDriver.email}
                    onChange={(e) => setNewDriver({...newDriver, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone *</Label>
                  <Input
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label>License Number *</Label>
                  <Input
                    value={newDriver.license_number}
                    onChange={(e) => setNewDriver({...newDriver, license_number: e.target.value})}
                    placeholder="D1234567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>License State</Label>
                  <Input
                    value={newDriver.license_state}
                    onChange={(e) => setNewDriver({...newDriver, license_state: e.target.value})}
                    placeholder="CA"
                  />
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select
                    value={newDriver.employment_type}
                    onValueChange={(v) => setNewDriver({...newDriver, employment_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pay Type</Label>
                  <Select
                    value={newDriver.pay_type}
                    onValueChange={(v) => setNewDriver({...newDriver, pay_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="per_delivery">Per Delivery</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pay Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newDriver.pay_rate}
                    onChange={(e) => setNewDriver({...newDriver, pay_rate: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <Button
                onClick={() => addDriverMutation.mutate(newDriver)}
                disabled={!newDriver.full_name || !newDriver.email || !newDriver.phone || !newDriver.license_number || addDriverMutation.isPending}
                className="w-full bg-blue-600"
              >
                {addDriverMutation.isPending ? "Adding..." : "Add Driver"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}