import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, Package, Zap, CheckCircle2, AlertCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function BatchRouteAssigner({ onComplete }) {
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  // Get available deliveries and drivers
  const availableDeliveries = deliveries.filter(d =>
    ['signed', 'at_facility'].includes(d.status)
  );

  const driversWithDeliveries = React.useMemo(() => {
    const driversMap = {};
    
    deliveries.forEach(delivery => {
      if (!delivery.carrier_email) return;
      
      if (!driversMap[delivery.carrier_email]) {
        driversMap[delivery.carrier_email] = {
          driverEmail: delivery.carrier_email,
          driverName: delivery.carrier_name || 'Unknown',
          readyDeliveries: [],
          activeDeliveries: 0
        };
      }

      if (['signed', 'at_facility'].includes(delivery.status)) {
        driversMap[delivery.carrier_email].readyDeliveries.push(delivery);
      } else if (delivery.status === 'out_for_delivery') {
        driversMap[delivery.carrier_email].activeDeliveries++;
      }
    });

    return Object.values(driversMap)
      .filter(d => d.readyDeliveries.length > 0)
      .sort((a, b) => b.readyDeliveries.length - a.readyDeliveries.length);
  }, [deliveries]);

  const toggleDriver = (driverEmail) => {
    setSelectedDrivers(prev =>
      prev.includes(driverEmail)
        ? prev.filter(e => e !== driverEmail)
        : [...prev, driverEmail]
    );
  };

  const selectAll = () => {
    setSelectedDrivers(driversWithDeliveries.map(d => d.driverEmail));
  };

  const clearAll = () => {
    setSelectedDrivers([]);
  };

  const handleBatchAssign = async () => {
    if (selectedDrivers.length === 0) {
      toast.error("Please select at least one driver");
      return;
    }

    setProcessing(true);
    try {
      const results = [];

      // Create routes for each selected driver
      for (const driverEmail of selectedDrivers) {
        const driver = driversWithDeliveries.find(d => d.driverEmail === driverEmail);
        if (!driver || driver.readyDeliveries.length === 0) continue;

        // Use AI to optimize each route
        const prompt = `Create optimized delivery route for driver.

DRIVER: ${driver.driverName}
DELIVERIES: ${driver.readyDeliveries.length}

STOPS:
${driver.readyDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name} - ${d.delivery_address}
   ${d.has_premium_insurance ? 'PREMIUM PACKAGE' : ''}
   ${d.scheduled_delivery_date ? `Due: ${format(new Date(d.scheduled_delivery_date), 'MMM d')}` : ''}
`).join('\n')}

Provide optimized sequence, distance, time estimates, and ETAs.`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              optimized_sequence: {
                type: "array",
                items: { type: "string" }
              },
              total_distance_miles: { type: "number" },
              total_estimated_time_minutes: { type: "number" },
              stop_etas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    delivery_id: { type: "string" },
                    estimated_arrival: { type: "string" }
                  }
                }
              }
            }
          }
        });

        // Create route
        const route = await base44.entities.OptimizedRoute.create({
          route_name: `Batch Route ${format(new Date(), "MMM d, h:mm a")} - ${driver.driverName}`,
          driver_email: driver.driverEmail,
          driver_name: driver.driverName,
          start_location: 'Distribution Center',
          delivery_ids: aiResponse.optimized_sequence,
          optimized_sequence: aiResponse.optimized_sequence.map((id, idx) => ({
            delivery_id: id,
            sequence_number: idx + 1,
            estimated_arrival: aiResponse.stop_etas[idx]?.estimated_arrival || 'TBD'
          })),
          total_distance_miles: aiResponse.total_distance_miles,
          total_estimated_time_minutes: aiResponse.total_estimated_time_minutes,
          created_at: new Date().toISOString(),
          created_by: 'Batch Assignment',
          status: 'active'
        });

        // Update deliveries
        for (let i = 0; i < aiResponse.optimized_sequence.length; i++) {
          await base44.entities.DeliveryRequest.update(aiResponse.optimized_sequence[i], {
            status: 'out_for_delivery',
            route_sequence: i + 1
          });
        }

        // Send notification
        await base44.integrations.Core.SendEmail({
          to: driver.driverEmail,
          subject: `📦 Route Assigned: ${driver.readyDeliveries.length} Stops`,
          body: `Hello ${driver.driverName},

A new optimized route has been assigned to you!

ROUTE DETAILS:
• Total Stops: ${driver.readyDeliveries.length}
• Distance: ${aiResponse.total_distance_miles?.toFixed(1)} miles
• Estimated Time: ${Math.round(aiResponse.total_estimated_time_minutes)} minutes

Open your Driver Mobile app to view the complete route sequence.

- Dispatch Team`,
          from_name: 'Batch Route Assignment'
        });

        results.push({
          driver: driver.driverName,
          stops: driver.readyDeliveries.length,
          routeId: route.id
        });
      }

      queryClient.invalidateQueries({ queryKey: ['optimizedRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['allDeliveries'] });

      toast.success(`Successfully created ${results.length} routes!`);
      
      if (onComplete) onComplete(results);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create batch routes");
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6" />
            Batch Route Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-900">
              <strong>🚀 Bulk Operation:</strong> Select multiple drivers to create and assign optimized routes simultaneously.
              AI will optimize each route individually based on the driver's assigned deliveries.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <Users className="w-6 h-6 mx-auto text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-blue-900">{driversWithDeliveries.length}</p>
              <p className="text-xs text-gray-600">Drivers Ready</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <Package className="w-6 h-6 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-900">{availableDeliveries.length}</p>
              <p className="text-xs text-gray-600">Packages Ready</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto text-purple-600 mb-1" />
              <p className="text-2xl font-bold text-purple-900">{selectedDrivers.length}</p>
              <p className="text-xs text-gray-600">Selected</p>
            </div>
          </div>

          {/* Driver Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-bold">
                Select Drivers ({selectedDrivers.length} selected)
              </Label>
              <div className="flex gap-2">
                <Button onClick={selectAll} variant="outline" size="sm">
                  Select All
                </Button>
                <Button onClick={clearAll} variant="outline" size="sm">
                  Clear
                </Button>
              </div>
            </div>

            {driversWithDeliveries.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No drivers with ready deliveries</p>
                <p className="text-sm text-gray-500 mt-1">
                  Deliveries must be signed or at facility to create routes
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-lg p-3">
                {driversWithDeliveries.map((driver) => (
                  <div
                    key={driver.driverEmail}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDrivers.includes(driver.driverEmail)
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleDriver(driver.driverEmail)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedDrivers.includes(driver.driverEmail)}
                        onCheckedChange={() => toggleDriver(driver.driverEmail)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-gray-900">{driver.driverName}</p>
                          <Badge className="bg-blue-600">
                            {driver.readyDeliveries.length} stops
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">{driver.driverEmail}</p>
                        {driver.activeDeliveries > 0 && (
                          <p className="text-xs text-orange-700 mt-1">
                            ⚠️ {driver.activeDeliveries} deliveries already active
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign Button */}
          <Button
            onClick={handleBatchAssign}
            disabled={processing || selectedDrivers.length === 0}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 text-lg"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating {selectedDrivers.length} routes...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Create & Assign {selectedDrivers.length} Route{selectedDrivers.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}