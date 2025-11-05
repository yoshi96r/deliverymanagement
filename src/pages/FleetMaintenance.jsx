import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wrench, AlertTriangle, Calendar, DollarSign
} from "lucide-react";
import { format } from "date-fns";

export default function FleetMaintenance() {
  const { data: maintenance } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => base44.entities.MaintenanceRecord.list('-service_date', 100),
    initialData: [],
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.DriverVehicle.list(),
    initialData: [],
  });

  const totalCost = maintenance.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const vehiclesInService = vehicles.filter(v => v.status === 'maintenance').length;
  const preventiveMaintenance = maintenance.filter(m => m.maintenance_type === 'preventive').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Wrench className="w-10 h-10 text-orange-600" />
            Fleet Maintenance Management
          </h1>
          <p className="text-gray-600">Track vehicle maintenance and repairs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Wrench className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{maintenance.length}</p>
              <p className="text-sm text-gray-600">Total Services</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{vehiclesInService}</p>
              <p className="text-sm text-gray-600">In Service</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <Calendar className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{preventiveMaintenance}</p>
              <p className="text-sm text-gray-600">Preventive</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <DollarSign className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">${totalCost.toFixed(0)}</p>
              <p className="text-sm text-gray-600">Total Cost</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Recent Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {maintenance.map((record) => (
                <Card key={record.id} className="border-2 border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{record.vehicle_number}</h3>
                        <p className="text-sm text-gray-600">
                          {format(new Date(record.service_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge className={
                        record.maintenance_type === 'preventive' ? 'bg-green-600' :
                        record.maintenance_type === 'emergency' ? 'bg-red-600' :
                        'bg-blue-600'
                      }>
                        {record.maintenance_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-800 mb-2">{record.service_description}</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Odometer</p>
                        <p className="font-semibold">{record.odometer_reading?.toLocaleString()} mi</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Labor Hours</p>
                        <p className="font-semibold">{record.labor_hours}h</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total Cost</p>
                        <p className="font-semibold">${record.total_cost}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}