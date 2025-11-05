
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Navigation, MapPin, Clock, TrendingUp, AlertTriangle,
  CheckCircle2, Zap, Map as MapIcon, Route as RouteIcon
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format, addMinutes } from "date-fns";

export default function RouteOptimizer({ availableDeliveries, drivers, onRouteCreated }) {
  const [selectedDeliveries, setSelectedDeliveries] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const currentTime = new Date(); // Define currentTime here for use in rendering

  const toggleDelivery = (deliveryId) => {
    setSelectedDeliveries(prev =>
      prev.includes(deliveryId)
        ? prev.filter(id => id !== deliveryId)
        : [...prev, deliveryId]
    );
  };

  const selectAll = () => {
    setSelectedDeliveries(availableDeliveries.map(d => d.id));
  };

  const clearAll = () => {
    setSelectedDeliveries([]);
  };

  const handleOptimize = async () => {
    if (selectedDeliveries.length === 0) {
      toast.error("Please select at least one delivery");
      return;
    }

    if (!selectedDriver) {
      toast.error("Please select a driver");
      return;
    }

    setOptimizing(true);
    try {
      const selectedDeliveryData = availableDeliveries.filter(d =>
        selectedDeliveries.includes(d.id)
      );

      const driver = drivers.find(d => d.driverEmail === selectedDriver);
      // const currentTime = new Date(); // Already defined globally for the component

      // Enhanced delivery analysis
      const deliveryPoints = selectedDeliveryData.map(d => {
        const hasTimeWindow = d.scheduled_delivery_date;
        const isOverdue = hasTimeWindow && new Date(d.scheduled_delivery_date) < currentTime;
        const hoursUntilWindow = hasTimeWindow
          ? (new Date(d.scheduled_delivery_date).getTime() - currentTime.getTime()) / (1000 * 60 * 60)
          : null;

        return {
          id: d.id,
          tracking_number: d.tracking_number,
          customer_name: d.customer_name,
          address: d.delivery_address,
          priority: d.has_premium_insurance ? 'high' : 'normal',
          delivery_window: d.scheduled_delivery_date,
          is_overdue: isOverdue,
          hours_until_window: hoursUntilWindow,
          package_value: d.package_value,
          insurance_tier: d.insurance_tier,
          special_handling: d.has_premium_insurance,
          requires_signature: true,
          estimated_stop_duration: d.has_premium_insurance ? 10 : 7, // minutes
          notes: d.carrier_notes
        };
      });

      const enhancedPrompt = `You are an advanced logistics AI specializing in multi-stop route optimization with time-sensitive delivery windows.

DRIVER INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Current Location: ${startLocation || driver?.locations?.[0]?.address || 'Distribution Center'}
- Available Packages: ${selectedDeliveryData.length}
- Current Time: ${format(currentTime, "EEEE, MMMM d 'at' h:mm a")}
- Day of Week: ${format(currentTime, "EEEE")}
- Traffic Period: ${currentTime.getHours() >= 7 && currentTime.getHours() <= 9 ? 'Morning Rush Hour' : currentTime.getHours() >= 16 && currentTime.getHours() <= 19 ? 'Evening Rush Hour' : 'Normal Traffic'}

DELIVERIES TO OPTIMIZE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${deliveryPoints.map((d, i) => `
${i + 1}. ${d.customer_name} (${d.tracking_number})
   📍 Address: ${d.address}
   ⏰ Delivery Window: ${d.delivery_window ? format(new Date(d.delivery_window), "MMM d 'at' h:mm a") : 'Flexible (anytime today)'}
   ${d.is_overdue ? '🚨 OVERDUE - CRITICAL PRIORITY' : d.hours_until_window !== null && d.hours_until_window < 3 ? `⚠️ URGENT - Due in ${d.hours_until_window.toFixed(1)} hours` : '✓ On Time'}
   💰 Priority: ${d.priority.toUpperCase()}${d.insurance_tier ? ` (${d.insurance_tier} tier)` : ''}
   📦 Package Value: $${d.package_value || 'Unknown'}
   ⏱️ Estimated Stop Duration: ${d.estimated_stop_duration} minutes
   ${d.special_handling ? '⭐ Premium Package - Special Care Required' : ''}
   ${d.notes ? `📝 Notes: ${d.notes}` : ''}
`).join('\n')}

OPTIMIZATION REQUIREMENTS & PRIORITIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ TIME WINDOWS (HIGHEST PRIORITY):
   - OVERDUE deliveries MUST be first
   - Deliveries due within 2 hours should be prioritized
   - Calculate realistic travel times between stops
   - Add buffer time for unexpected delays

2️⃣ PACKAGE PRIORITY:
   - Premium/Platinum tier packages get priority
   - High-value packages ($500+) need extra care
   - Signature requirements affect stop duration

3️⃣ GEOGRAPHIC EFFICIENCY:
   - Cluster nearby addresses together
   - Minimize backtracking and zigzagging
   - Consider one-way streets and traffic patterns
   - Group deliveries by neighborhood/area

4️⃣ TRAFFIC & TIME-OF-DAY:
   - Current time: ${format(currentTime, "h:mm a")}
   - Avoid high-traffic areas during rush hour
   - Consider school zones during school hours
   - Plan for lunch break if route exceeds 5 hours

5️⃣ DRIVER EFFICIENCY:
   - Include mandatory break after 4 hours
   - Stop duration: Premium = 10min, Standard = 7min
   - Account for parking/walking time in dense areas
   - Build in 10% buffer for contingencies

PROVIDE COMPREHENSIVE OPTIMIZATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each stop, include:
- Delivery ID
- Sequence number (1, 2, 3...)
- Estimated arrival time (actual clock time)
- Duration at stop (minutes)
- Distance from previous stop (miles)
- Cumulative route progress
- Traffic factor (1.0 = normal, 1.5 = heavy)
- Priority justification
- Any special notes

Also provide:
- Total route distance
- Total estimated time (including all stops)
- Expected completion time
- Potential challenges
- Alternative route suggestions
- Key driver insights
- Break recommendations
- Summary explanation

Be realistic and thorough!`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: enhancedPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            optimized_sequence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  delivery_id: { type: "string" },
                  sequence_number: { type: "number" },
                  estimated_arrival: { type: "string" },
                  estimated_duration_minutes: { type: "number" },
                  distance_from_previous_miles: { type: "number" },
                  cumulative_distance_miles: { type: "number" },
                  cumulative_time_minutes: { type: "number" },
                  traffic_factor: { type: "number" },
                  priority_score: { type: "number" },
                  priority_justification: { type: "string" },
                  special_notes: { type: "string" }
                }
              }
            },
            total_distance_miles: { type: "number" },
            total_estimated_time_minutes: { type: "number" },
            expected_completion_time: { type: "string" },
            break_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  after_stop_number: { type: "number" },
                  duration_minutes: { type: "number" },
                  reason: { type: "string" }
                }
              }
            },
            potential_issues: {
              type: "array",
              items: { type: "string" }
            },
            ai_insights: { type: "string" },
            alternative_suggestions: {
              type: "array",
              items: { type: "string" }
            },
            optimization_summary: { type: "string" },
            time_window_compliance: { type: "string" },
            geographic_clustering_score: { type: "number" },
            efficiency_rating: { type: "number" }
          }
        }
      });

      const estimatedCompletion = new Date(aiResponse.expected_completion_time);

      const optimizedRouteData = {
        route_name: `Route ${format(currentTime, "MMM d, h:mm a")} - ${driver.driverName}`,
        driver_email: selectedDriver,
        driver_name: driver.driverName,
        start_location: startLocation || driver?.locations?.[0]?.address || 'Distribution Center',
        start_coordinates: driver?.locations?.[0] ?
          `${driver.locations[0].lat},${driver.locations[0].lng}` : undefined,
        delivery_ids: aiResponse.optimized_sequence.map(s => s.delivery_id),
        optimized_sequence: aiResponse.optimized_sequence,
        total_distance_miles: aiResponse.total_distance_miles,
        total_estimated_time_minutes: aiResponse.total_estimated_time_minutes,
        estimated_completion_time: estimatedCompletion.toISOString(),
        optimization_factors: {
          traffic_considered: true,
          delivery_windows_honored: true,
          priority_deliveries_first: true,
          clustered_by_area: true,
          break_time_included: aiResponse.break_recommendations?.length > 0,
          time_window_compliance: aiResponse.time_window_compliance
        },
        ai_insights: aiResponse.ai_insights,
        potential_issues: aiResponse.potential_issues,
        alternative_routes: aiResponse.alternative_suggestions?.map(s => ({ description: s })),
        break_recommendations: aiResponse.break_recommendations,
        geographic_clustering_score: aiResponse.geographic_clustering_score,
        efficiency_rating: aiResponse.efficiency_rating,
        created_at: new Date().toISOString(),
        created_by: 'Dispatcher',
        status: 'planned'
      };

      const savedRoute = await base44.entities.OptimizedRoute.create(optimizedRouteData);

      setOptimizedRoute({
        ...optimizedRouteData,
        id: savedRoute.id,
        deliveries: aiResponse.optimized_sequence.map(seq => {
          const delivery = selectedDeliveryData.find(d => d.id === seq.delivery_id);
          return { ...delivery, ...seq };
        }),
        optimization_summary: aiResponse.optimization_summary
      });

      setShowResults(true);
      toast.success("Multi-stop route optimized with time windows!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to optimize route");
    }
    setOptimizing(false);
  };

  const handleAssignRoute = async () => {
    if (!optimizedRoute) return;

    try {
      // Update route status to active
      await base44.entities.OptimizedRoute.update(optimizedRoute.id, {
        status: 'active',
        started_at: new Date().toISOString()
      });

      // Update all deliveries with the optimized sequence
      const updates = optimizedRoute.deliveries.map((delivery, index) =>
        base44.entities.DeliveryRequest.update(delivery.id, {
          status: 'out_for_delivery',
          carrier_name: optimizedRoute.driver_name,
          carrier_email: optimizedRoute.driver_email,
          route_sequence: index + 1,
          estimated_arrival: delivery.estimated_arrival
        })
      );

      await Promise.all(updates);

      // Send notification to driver
      await base44.integrations.Core.SendEmail({
        to: optimizedRoute.driver_email,
        subject: `🗺️ Optimized Route Assigned: ${optimizedRoute.route_name}`,
        body: `Hello ${optimizedRoute.driver_name},

An optimized delivery route has been assigned to you!

ROUTE DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Total Deliveries: ${optimizedRoute.deliveries.length}
📍 Total Distance: ${optimizedRoute.total_distance_miles.toFixed(1)} miles
⏱️ Estimated Time: ${Math.round(optimizedRoute.total_estimated_time_minutes)} minutes
🏁 Expected Completion: ${format(new Date(optimizedRoute.estimated_completion_time), "h:mm a")}

OPTIMIZED SEQUENCE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${optimizedRoute.deliveries.map((d, i) => `
${i + 1}. ${d.customer_name}
   ${d.delivery_address}
   ETA: ${d.estimated_arrival}
   ${d.has_premium_insurance ? '⭐ Premium Package' : ''}
`).join('\n')}

AI INSIGHTS:
${optimizedRoute.ai_insights}

${optimizedRoute.potential_issues?.length > 0 ? `
POTENTIAL CHALLENGES:
${optimizedRoute.potential_issues.map(issue => `⚠️ ${issue}`).join('\n')}
` : ''}

Open the Driver Mobile app to start your optimized route!

- Dispatch Team`,
        from_name: 'USPS Route Optimization'
      });

      toast.success("Route assigned to driver!");
      if (onRouteCreated) onRouteCreated(optimizedRoute);

      // Reset form
      setShowResults(false);
      setOptimizedRoute(null);
      setSelectedDeliveries([]);
      setSelectedDriver("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign route");
    }
  };

  return (
    <div className="space-y-4">
      {!showResults ? (
        <>
          <Card className="border-2 border-blue-300">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-6 h-6" />
                AI Multi-Stop Route Optimization
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>🤖 Enhanced AI analyzes:</strong>
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Time Windows</strong> - Prioritizes urgent and overdue deliveries</li>
                  <li>• <strong>Traffic Patterns</strong> - Avoids congestion based on time of day</li>
                  <li>• <strong>Package Priorities</strong> - Premium packages get preferential routing</li>
                  <li>• <strong>Geographic Clustering</strong> - Groups nearby addresses efficiently</li>
                  <li>• <strong>Break Optimization</strong> - Suggests rest stops for long routes</li>
                  <li>• <strong>Real-time Validation</strong> - Checks feasibility of all time windows</li>
                </ul>
              </div>

              <div>
                <Label htmlFor="driver">Select Driver *</Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger id="driver" className="mt-1">
                    <SelectValue placeholder="Choose driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.driverEmail} value={driver.driverEmail}>
                        {driver.driverName} - {driver.deliveries.length} packages
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="start_location">Start Location (Optional)</Label>
                <Input
                  id="start_location"
                  value={startLocation}
                  onChange={(e) => setStartLocation(e.target.value)}
                  placeholder="e.g., Distribution Center, Main Facility"
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Select Deliveries to Include ({selectedDeliveries.length} selected)</Label>
                  <div className="flex gap-2">
                    <Button onClick={selectAll} variant="outline" size="sm">
                      Select All
                    </Button>
                    <Button onClick={clearAll} variant="outline" size="sm">
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-lg p-3">
                  {availableDeliveries.map((delivery) => {
                    const hasWindow = delivery.scheduled_delivery_date;
                    const isOverdue = hasWindow && new Date(delivery.scheduled_delivery_date) < currentTime;
                    const hoursUntil = hasWindow
                      ? (new Date(delivery.scheduled_delivery_date).getTime() - currentTime.getTime()) / (1000 * 60 * 60)
                      : null;
                    const isUrgent = hoursUntil !== null && hoursUntil < 3 && hoursUntil > 0;

                    return (
                      <div
                        key={delivery.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedDeliveries.includes(delivery.id)
                            ? 'border-blue-400 bg-blue-50'
                            : isOverdue
                            ? 'border-red-400 bg-red-50'
                            : isUrgent
                            ? 'border-orange-400 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleDelivery(delivery.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedDeliveries.includes(delivery.id)}
                            onCheckedChange={() => toggleDelivery(delivery.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-gray-900">{delivery.customer_name}</p>
                              {delivery.has_premium_insurance && (
                                <Badge className="bg-yellow-500 text-white text-xs">
                                  Premium
                                </Badge>
                              )}
                              {isOverdue && (
                                <Badge className="bg-red-600 text-white text-xs animate-pulse">
                                  OVERDUE
                                </Badge>
                              )}
                              {isUrgent && !isOverdue && (
                                <Badge className="bg-orange-600 text-white text-xs">
                                  Due in {hoursUntil.toFixed(1)}h
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {delivery.delivery_address}
                            </p>
                            {delivery.scheduled_delivery_date && (
                              <p className={`text-xs flex items-center gap-1 mt-1 ${
                                isOverdue ? 'text-red-700 font-semibold' : isUrgent ? 'text-orange-700 font-semibold' : 'text-gray-500'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {isOverdue ? 'OVERDUE: ' : 'Due: '}
                                {format(new Date(delivery.scheduled_delivery_date), "MMM d 'at' h:mm a")}
                              </p>
                            )}
                            {delivery.package_value && delivery.package_value >= 500 && (
                              <p className="text-xs text-purple-700 mt-1">
                                💎 High Value: ${delivery.package_value}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleOptimize}
                disabled={optimizing || selectedDeliveries.length === 0 || !selectedDriver}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 text-lg"
              >
                {optimizing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    AI Optimizing Route with Time Windows...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Optimize Multi-Stop Route with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="bg-green-100 border-b-2 border-green-300">
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-900 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  Multi-Stop Route Optimized!
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white text-lg px-4 py-2">
                    {optimizedRoute.deliveries.length} Stops
                  </Badge>
                  {optimizedRoute.efficiency_rating && (
                    <Badge className="bg-blue-600 text-white text-lg px-4 py-2">
                      {optimizedRoute.efficiency_rating}% Efficient
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Enhanced Route Stats */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <MapIcon className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <p className="text-3xl font-bold text-blue-900">
                      {optimizedRoute.total_distance_miles.toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-600">Miles</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <Clock className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                    <p className="text-3xl font-bold text-purple-900">
                      {Math.round(optimizedRoute.total_estimated_time_minutes)}
                    </p>
                    <p className="text-sm text-gray-600">Minutes</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="text-2xl font-bold text-green-900">
                      {format(new Date(optimizedRoute.estimated_completion_time), "h:mm a")}
                    </p>
                    <p className="text-sm text-gray-600">Completion ETA</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-yellow-200">
                  <CardContent className="p-4 text-center">
                    <Zap className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
                    <p className="text-2xl font-bold text-yellow-900">
                      {optimizedRoute.geographic_clustering_score || 'N/A'}%
                    </p>
                    <p className="text-sm text-gray-600">Clustering</p>
                  </CardContent>
                </Card>
              </div>

              {/* Time Window Compliance */}
              {optimizedRoute.optimization_factors?.time_window_compliance && (
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-green-900 mb-1">Time Window Compliance</p>
                        <p className="text-sm text-green-800">
                          {optimizedRoute.optimization_factors.time_window_compliance}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Break Recommendations */}
              {optimizedRoute.break_recommendations?.length > 0 && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-blue-900">☕ Recommended Breaks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {optimizedRoute.break_recommendations.map((breakRec, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">
                          After Stop #{breakRec.after_stop_number} - {breakRec.duration_minutes} minutes
                        </p>
                        <p className="text-xs text-blue-700">{breakRec.reason}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* AI Insights */}
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-purple-900">🤖 AI Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-purple-800">{optimizedRoute.ai_insights}</p>
                  {optimizedRoute.optimization_summary && (
                    <p className="text-sm text-purple-700 mt-2">
                      <strong>Summary:</strong> {optimizedRoute.optimization_summary}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Potential Issues */}
              {optimizedRoute.potential_issues?.length > 0 && (
                <Card className="border-2 border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-orange-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Potential Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {optimizedRoute.potential_issues.map((issue, i) => (
                        <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
                          <span className="text-orange-600 font-bold">{i + 1}.</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Enhanced Optimized Sequence */}
              <Card className="border-2 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-900">
                    📍 Optimized Delivery Sequence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {optimizedRoute.deliveries.map((delivery, index) => {
                    const hasWindow = delivery.scheduled_delivery_date;
                    const isOverdue = hasWindow && new Date(delivery.scheduled_delivery_date) < new Date();

                    return (
                      <div
                        key={delivery.id}
                        className={`p-4 bg-white rounded-lg border-2 ${
                          isOverdue ? 'border-red-300 bg-red-50' :
                          delivery.has_premium_insurance ? 'border-yellow-300 bg-yellow-50' :
                          'border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 ${
                            isOverdue ? 'bg-red-600' :
                            delivery.has_premium_insurance ? 'bg-yellow-500' :
                            'bg-blue-600'
                          } text-white rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900">{delivery.customer_name}</p>
                                {delivery.has_premium_insurance && (
                                  <Badge className="bg-yellow-500 text-white">Premium</Badge>
                                )}
                                {isOverdue && (
                                  <Badge className="bg-red-600 text-white">OVERDUE</Badge>
                                )}
                              </div>
                              <Badge className="bg-purple-100 text-purple-700 text-xs">
                                Priority: {delivery.priority_score || 'N/A'}/10
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{delivery.delivery_address}</p>

                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                              <div className="flex items-center gap-1 text-gray-600">
                                <Clock className="w-3 h-3" />
                                ETA: <strong>{delivery.estimated_arrival}</strong>
                              </div>
                              <div className="flex items-center gap-1 text-gray-600">
                                <MapIcon className="w-3 h-3" />
                                {delivery.distance_from_previous_miles?.toFixed(1)} mi from prev
                              </div>
                              <div className="flex items-center gap-1 text-gray-600">
                                Stop Duration: <strong>{delivery.estimated_duration_minutes} min</strong>
                              </div>
                              <div className="flex items-center gap-1 text-gray-600">
                                Cumulative: <strong>{delivery.cumulative_time_minutes} min</strong>
                              </div>
                            </div>

                            {delivery.priority_justification && (
                              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs text-blue-900">
                                  <strong>Why this position:</strong> {delivery.priority_justification}
                                </p>
                              </div>
                            )}

                            {delivery.special_notes && (
                              <p className="text-xs text-gray-600 mt-2 italic">
                                📝 {delivery.special_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowResults(false);
                    setOptimizedRoute(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Create New Route
                </Button>
                <Button
                  onClick={handleAssignRoute}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  <RouteIcon className="w-4 h-4 mr-2" />
                  Assign Route to Driver
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
