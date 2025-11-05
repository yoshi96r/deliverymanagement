import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, Package, DollarSign, MapPin, Calendar
} from "lucide-react";
import { format } from "date-fns";

export default function LoadManagement() {
  const { data: loads } = useQuery({
    queryKey: ['loads'],
    queryFn: () => base44.entities.LoadManagement.list('-created_date', 100),
    initialData: [],
  });

  const availableLoads = loads.filter(l => l.load_status === 'available').length;
  const inTransit = loads.filter(l => l.load_status === 'in_transit').length;
  const delivered = loads.filter(l => l.load_status === 'delivered').length;
  const totalRevenue = loads.reduce((sum, l) => sum + (l.total_revenue || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Truck className="w-10 h-10 text-green-600" />
            Load & Freight Management
          </h1>
          <p className="text-gray-600">Manage loads, shipments, and freight operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{availableLoads}</p>
              <p className="text-sm text-gray-600">Available Loads</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <Truck className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{inTransit}</p>
              <p className="text-sm text-gray-600">In Transit</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">{delivered}</p>
              <p className="text-sm text-gray-600">Delivered</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <DollarSign className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">${totalRevenue.toFixed(0)}</p>
              <p className="text-sm text-gray-600">Total Revenue</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>All Loads</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {loads.map((load) => (
                <Card key={load.id} className="border-2 border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{load.load_number}</h3>
                        <p className="text-sm text-gray-600">{load.freight_type?.replace(/_/g, ' ')}</p>
                      </div>
                      <Badge className={
                        load.load_status === 'delivered' ? 'bg-green-600' :
                        load.load_status === 'in_transit' ? 'bg-blue-600' :
                        load.load_status === 'dispatched' ? 'bg-purple-600' :
                        'bg-gray-600'
                      }>
                        {load.load_status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Shipper
                        </p>
                        <p className="font-semibold">{load.shipper_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Consignee
                        </p>
                        <p className="font-semibold">{load.consignee_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Pickup
                        </p>
                        <p className="font-semibold">
                          {format(new Date(load.pickup_date), "MMM d")}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Revenue
                        </p>
                        <p className="font-semibold">${load.total_revenue}</p>
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