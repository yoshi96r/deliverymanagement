
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FlaskConical, Play, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Clock, Navigation, MapPin, Zap,
  ArrowRight, BarChart3, ThumbsUp, ThumbsDown, Lightbulb,
  Save, RotateCcw, Eye, Brain
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, addMinutes } from "date-fns";

export default function RouteSimulationLab() {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [simulationType, setSimulationType] = useState("");
  const [selectedDeliveryToAdd, setSelectedDeliveryToAdd] = useState("");
  const [deliveryToRemove, setDeliveryToRemove] = useState("");
  const [trafficDelayMinutes, setTrafficDelayMinutes] = useState(15);
  const [customScenario, setCustomScenario] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const queryClient = useQueryClient();

  const { data: activeRoutes } = useQuery({
    queryKey: ['activeRoutes'],
    queryFn: () => base44.entities.OptimizedRoute.filter({
      status: ['active', 'in_progress', 'planned']
    }),
    initialData: [],
  });

  const { data: allDeliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const { data: pastSimulations } = useQuery({
    queryKey: ['routeSimulations'],
    queryFn: () => base44.entities.RouteSimulation.list('-created_at', 20),
    initialData: [],
  });

  const { data: optimizationInsights } = useQuery({
    queryKey: ['routeOptimizationInsights'],
    queryFn: async () => {
      const insights = await base44.entities.RouteOptimizationInsight.list('-insight_date', 1);
      return insights;
    },
    initialData: [],
  });

  const latestInsight = optimizationInsights && optimizationInsights.length > 0 ? optimizationInsights[0] : null;

  const availableDeliveries = allDeliveries.filter(d => 
    ['signed', 'at_facility'].includes(d.status) && 
    (!selectedRoute || !selectedRoute.delivery_ids || !selectedRoute.delivery_ids.includes(d.id))
  );

  const runSimulationMutation = useMutation({
    mutationFn: async (simulationParams) => {
      const route = activeRoutes.find(r => r.id === selectedRoute.id);
      if (!route) throw new Error("Route not found");

      const routeDeliveries = allDeliveries.filter(d => 
        route.delivery_ids && route.delivery_ids.includes(d.id)
      );

      // Build simulation prompt
      let simulationPrompt = `You are a route optimization expert running a "what-if" simulation.

ORIGINAL ROUTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Route: ${route.route_name}
Driver: ${route.driver_name}
Total Stops: ${route.delivery_ids?.length || 0}
Distance: ${route.total_distance_miles} miles
Time: ${route.total_estimated_time_minutes} minutes
Completion ETA: ${route.estimated_completion_time ? format(new Date(route.estimated_completion_time), "h:mm a") : 'N/A'}
Current Time: ${format(new Date(), "h:mm a")}

CURRENT SEQUENCE:
${routeDeliveries.map((d, i) => `${i + 1}. ${d.customer_name} - ${d.delivery_address}${d.has_premium_insurance ? ' (PREMIUM)' : ''}${d.scheduled_delivery_date ? ` Due: ${format(new Date(d.scheduled_delivery_date), "h:mm a")}` : ''}`).join('\n')}

SIMULATION REQUEST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type: ${simulationType}
`;

      // Add simulation-specific details
      if (simulationType === 'add_priority_delivery') {
        const newDelivery = allDeliveries.find(d => d.id === selectedDeliveryToAdd);
        if (newDelivery) {
          simulationPrompt += `
NEW PRIORITY DELIVERY TO INSERT:
- Customer: ${newDelivery.customer_name}
- Address: ${newDelivery.delivery_address}
- Premium: ${newDelivery.has_premium_insurance ? 'YES' : 'NO'}
- Due Time: ${newDelivery.scheduled_delivery_date ? format(new Date(newDelivery.scheduled_delivery_date), "h:mm a") : 'Flexible'}
- Package Value: $${newDelivery.package_value || 'Unknown'}

TASK: Insert this delivery optimally into the route. Where should it go? How does it affect the entire route?`;
        }
      } else if (simulationType === 'traffic_reroute') {
        simulationPrompt += `
TRAFFIC SCENARIO:
- Delay Expected: ${trafficDelayMinutes} minutes on current route
- Assume traffic affects stops 3-7 (middle section)
- Need to reroute around congestion

TASK: Optimize route to avoid/minimize traffic impact. Can we resequence to bypass affected area?`;
      } else if (simulationType === 'remove_delivery') {
        const removeDelivery = routeDeliveries.find(d => d.id === deliveryToRemove);
        if (removeDelivery) {
          simulationPrompt += `
DELIVERY TO REMOVE:
- Customer: ${removeDelivery.customer_name}
- Position: Stop #${route.delivery_ids.indexOf(deliveryToRemove) + 1}
- Reason: ${customScenario || 'Customer rescheduled'}

TASK: Remove this stop and reoptimize the remaining sequence.`;
        }
      } else if (simulationType === 'what_if_scenario') {
        simulationPrompt += `
CUSTOM SCENARIO:
${customScenario}

TASK: Analyze and optimize route based on this scenario.`;
      }

      simulationPrompt += `

SIMULATION REQUIREMENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MODIFIED ROUTE SEQUENCE:
   Provide complete optimized sequence with:
   - Delivery ID for each stop
   - New sequence number
   - Estimated arrival time (actual clock time)
   - Duration at stop
   - Distance from previous stop
   - Cumulative time and distance

2. IMPACT ANALYSIS:
   Calculate exact impacts on:
   - Total route time (difference in minutes)
   - Total route distance (difference in miles)
   - Route efficiency score change (percentage)
   - Final completion time shift
   - Each customer's ETA change

3. CUSTOMER ETA IMPACTS:
   For EVERY delivery in the route, provide:
   - Customer name
   - Original ETA
   - New ETA
   - Time shift (positive = later, negative = earlier)
   - Whether this affects their delivery window

4. PROS & CONS:
   List 3-5 advantages and disadvantages of this modification

5. RISK ASSESSMENT:
   Identify potential risks or issues

6. AI RECOMMENDATION:
   Should dispatcher apply this change?
   - strongly_recommend
   - recommend  
   - neutral
   - not_recommend
   - strongly_not_recommend

7. DETAILED ANALYSIS:
   Comprehensive explanation of impacts and reasoning

Be thorough and realistic!`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: simulationPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            simulated_sequence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  delivery_id: { type: "string" },
                  sequence_number: { type: "number" },
                  estimated_arrival: { type: "string" },
                  duration_minutes: { type: "number" },
                  distance_from_previous_miles: { type: "number" },
                  cumulative_distance_miles: { type: "number" },
                  cumulative_time_minutes: { type: "number" }
                }
              }
            },
            impact_metrics: {
              type: "object",
              properties: {
                time_difference_minutes: { type: "number" },
                distance_difference_miles: { type: "number" },
                efficiency_change_percentage: { type: "number" },
                completion_time_shift_minutes: { type: "number" },
                total_deliveries_affected: { type: "number" }
              }
            },
            customer_eta_impacts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  delivery_id: { type: "string" },
                  customer_name: { type: "string" },
                  original_eta: { type: "string" },
                  new_eta: { type: "string" },
                  eta_shift_minutes: { type: "number" },
                  affects_delivery_window: { type: "boolean" },
                  window_status: { type: "string" }
                }
              }
            },
            pros: {
              type: "array",
              items: { type: "string" }
            },
            cons: {
              type: "array",
              items: { type: "string" }
            },
            risk_factors: {
              type: "array",
              items: { type: "string" }
            },
            ai_recommendation: {
              type: "string",
              enum: ["strongly_recommend", "recommend", "neutral", "not_recommend", "strongly_not_recommend"]
            },
            confidence_score: { type: "number" },
            detailed_analysis: { type: "string" },
            alternative_options: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      // Calculate simulated route metrics with null safety
      const simulatedTotalTime = aiResponse.simulated_sequence && aiResponse.simulated_sequence.length > 0
        ? (aiResponse.simulated_sequence[aiResponse.simulated_sequence.length - 1]?.cumulative_time_minutes || 0)
        : 0;
      const simulatedTotalDistance = aiResponse.simulated_sequence && aiResponse.simulated_sequence.length > 0
        ? (aiResponse.simulated_sequence[aiResponse.simulated_sequence.length - 1]?.cumulative_distance_miles || 0)
        : 0;

      // Save simulation
      const simulation = await base44.entities.RouteSimulation.create({
        simulation_name: `${simulationType.replace(/_/g, ' ')} - ${format(new Date(), "MMM d, h:mm a")}`,
        original_route_id: route.id,
        simulation_type: simulationType,
        modifications_applied: simulationParams.modifications,
        original_route_data: {
          delivery_ids: route.delivery_ids || [],
          total_distance_miles: route.total_distance_miles || 0,
          total_time_minutes: route.total_estimated_time_minutes || 0,
          completion_time: route.estimated_completion_time,
          efficiency_score: route.efficiency_score || 85
        },
        simulated_route_data: {
          delivery_ids: (aiResponse.simulated_sequence || []).map(s => s.delivery_id),
          total_distance_miles: simulatedTotalDistance,
          total_time_minutes: simulatedTotalTime,
          completion_time: addMinutes(new Date(), simulatedTotalTime).toISOString(),
          efficiency_score: (route.efficiency_score || 85) + (aiResponse.impact_metrics?.efficiency_change_percentage || 0)
        },
        impact_analysis: {
          time_difference_minutes: aiResponse.impact_metrics?.time_difference_minutes || 0,
          distance_difference_miles: aiResponse.impact_metrics?.distance_difference_miles || 0,
          efficiency_change_percentage: aiResponse.impact_metrics?.efficiency_change_percentage || 0,
          completion_time_shift_minutes: aiResponse.impact_metrics?.completion_time_shift_minutes || 0,
          deliveries_affected_count: aiResponse.impact_metrics?.total_deliveries_affected || 0,
          customer_eta_impacts: aiResponse.customer_eta_impacts || []
        },
        ai_recommendation: aiResponse.ai_recommendation,
        ai_confidence: aiResponse.confidence_score,
        ai_analysis: aiResponse.detailed_analysis,
        pros: aiResponse.pros || [],
        cons: aiResponse.cons || [],
        risk_factors: aiResponse.risk_factors || [],
        created_by: 'Dispatcher',
        created_at: new Date().toISOString()
      });

      return {
        simulation,
        aiResponse,
        routeDeliveries
      };
    },
    onSuccess: ({ simulation, aiResponse, routeDeliveries }) => {
      setSimulationResults({
        simulation,
        aiResponse,
        routeDeliveries
      });
      queryClient.invalidateQueries({ queryKey: ['routeSimulations'] });
      toast.success("Simulation complete!");
      setSimulating(false);
    },
    onError: (error) => {
      toast.error(`Simulation failed: ${error.message}`);
      setSimulating(false);
    }
  });

  const applySimulationMutation = useMutation({
    mutationFn: async (simulation) => {
      if (!simulationResults || !simulationResults.aiResponse) {
        throw new Error("No simulation results available");
      }

      const deliveryIds = simulation.simulated_route_data?.delivery_ids || [];
      const simulatedSequence = simulationResults.aiResponse?.simulated_sequence || [];

      // Apply simulation to actual route
      await base44.entities.OptimizedRoute.update(simulation.original_route_id, {
        delivery_ids: deliveryIds,
        optimized_sequence: simulatedSequence,
        total_distance_miles: simulation.simulated_route_data?.total_distance_miles || 0,
        total_estimated_time_minutes: simulation.simulated_route_data?.total_time_minutes || 0,
        estimated_completion_time: simulation.simulated_route_data?.completion_time,
        efficiency_score: simulation.simulated_route_data?.efficiency_score || 0
      });

      // Update deliveries with new sequence
      for (let i = 0; i < deliveryIds.length; i++) {
        const deliveryId = deliveryIds[i];
        const seqData = simulatedSequence[i];
        
        if (seqData) {
          await base44.entities.DeliveryRequest.update(deliveryId, {
            route_sequence: i + 1,
            estimated_arrival: seqData.estimated_arrival
          });
        }
      }

      // Mark simulation as applied
      await base44.entities.RouteSimulation.update(simulation.id, {
        applied_to_actual_route: true,
        applied_at: new Date().toISOString(),
        actual_results: {
          started_tracking_at: new Date().toISOString(),
          original_route_id: simulation.original_route_id
        }
      });

      // Notify driver
      const route = activeRoutes.find(r => r.id === simulation.original_route_id);
      if (route && route.driver_email) {
        await base44.integrations.Core.SendEmail({
          to: route.driver_email,
          subject: '🔄 Route Modified Based on Simulation',
          body: `Hello ${route.driver_name},

Your route has been updated based on dispatcher simulation analysis.

CHANGES APPLIED:
${simulation.simulation_type.replace(/_/g, ' ').toUpperCase()}

IMPACT:
- Time Change: ${simulation.impact_analysis.time_difference_minutes > 0 ? '+' : ''}${simulation.impact_analysis.time_difference_minutes} minutes
- Distance Change: ${simulation.impact_analysis.distance_difference_miles > 0 ? '+' : ''}${simulation.impact_analysis.distance_difference_miles.toFixed(1)} miles
- New Completion Time: ${format(new Date(simulation.simulated_route_data.completion_time), "h:mm a")}

REASON:
${simulation.ai_analysis}

Check your Driver Mobile app for the updated sequence.

- Dispatch Team`,
          from_name: 'Route Optimization'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optimizedRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['allDeliveries'] });
      toast.success("Simulation applied to route! Driver has been notified.");
      resetSimulation();
    },
    onError: (error) => {
      toast.error(`Failed to apply simulation: ${error.message}`);
    }
  });

  const runSimulation = async () => {
    if (!selectedRoute) {
      toast.error("Please select a route to simulate");
      return;
    }

    if (!simulationType) {
      toast.error("Please select a simulation type");
      return;
    }

    // Validation based on simulation type
    if (simulationType === 'add_priority_delivery' && !selectedDeliveryToAdd) {
      toast.error("Please select a delivery to add");
      return;
    }

    if (simulationType === 'remove_delivery' && !deliveryToRemove) {
      toast.error("Please select a delivery to remove");
      return;
    }

    if (simulationType === 'what_if_scenario' && !customScenario) {
      toast.error("Please describe your scenario");
      return;
    }

    setSimulating(true);

    const modifications = [];
    
    if (simulationType === 'add_priority_delivery') {
      const delivery = allDeliveries.find(d => d.id === selectedDeliveryToAdd);
      if (delivery) {
        modifications.push({
          modification_type: 'add_delivery',
          description: `Add priority delivery: ${delivery.customer_name} (${delivery.tracking_number})`,
          affected_deliveries: [selectedDeliveryToAdd]
        });
      }
    } else if (simulationType === 'remove_delivery') {
      const delivery = allDeliveries.find(d => d.id === deliveryToRemove);
      if (delivery) {
        modifications.push({
          modification_type: 'remove_delivery',
          description: `Remove delivery: ${delivery.customer_name}`,
          affected_deliveries: [deliveryToRemove]
        });
      }
    } else if (simulationType === 'traffic_reroute') {
      modifications.push({
        modification_type: 'traffic_reroute',
        description: `Simulate ${trafficDelayMinutes}-minute traffic delay`,
        affected_deliveries: selectedRoute.delivery_ids
      });
    } else if (simulationType === 'what_if_scenario') {
      modifications.push({
        modification_type: 'custom_scenario',
        description: customScenario,
        affected_deliveries: selectedRoute.delivery_ids
      });
    }

    runSimulationMutation.mutate({ modifications });
  };

  const resetSimulation = () => {
    setSimulationResults(null);
    setSelectedRoute(null);
    setSimulationType("");
    setSelectedDeliveryToAdd("");
    setDeliveryToRemove("");
    setCustomScenario("");
    setSimulating(false);
  };

  const getRecommendationColor = (rec) => {
    switch (rec) {
      case 'strongly_recommend': return 'bg-green-600';
      case 'recommend': return 'bg-blue-600';
      case 'neutral': return 'bg-gray-600';
      case 'not_recommend': return 'bg-orange-600';
      case 'strongly_not_recommend': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getRecommendationIcon = (rec) => {
    if (rec && rec.includes('recommend') && !rec.includes('not')) return ThumbsUp;
    if (rec && rec.includes('not_recommend')) return ThumbsDown;
    return Lightbulb;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <FlaskConical className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-purple-900">AI Route Simulation Lab</CardTitle>
              <p className="text-sm text-purple-700">Test route modifications before applying them</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AI Learning Insights */}
      {latestInsight && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900 mb-1">
                  🧠 AI Learning Status
                </p>
                <p className="text-xs text-blue-800 mb-2">
                  Prediction accuracy: <strong>{latestInsight.prediction_accuracy_rate?.toFixed(1) || 'N/A'}%</strong> based on {latestInsight.applied_simulations || 0} applied simulations
                </p>
                <div className="flex gap-2 flex-wrap">
                  {latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.correction_factor && latestInsight.time_estimation_bias.correction_factor !== 1 && (
                    <Badge className="bg-blue-600 text-white text-xs">
                      Time correction: ×{latestInsight.time_estimation_bias.correction_factor.toFixed(2)}
                    </Badge>
                  )}
                  {latestInsight.recommendation_effectiveness && latestInsight.recommendation_effectiveness.calibration_needed && (
                    <Badge className="bg-orange-600 text-white text-xs">
                      Recommendations being recalibrated
                    </Badge>
                  )}
                  {latestInsight.prediction_accuracy_rate && latestInsight.prediction_accuracy_rate >= 85 && (
                    <Badge className="bg-green-600 text-white text-xs">
                      ✅ High accuracy mode
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!simulationResults ? (
        <>
          {/* Configuration Panel */}
          <Card className="border-2 border-blue-300">
            <CardHeader className="bg-blue-50 border-b border-blue-200">
              <CardTitle className="text-blue-900">Configure Simulation</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Select Route */}
              <div>
                <Label htmlFor="route">Select Route to Simulate *</Label>
                <Select 
                  value={selectedRoute?.id || ""} 
                  onValueChange={(val) => {
                    const route = activeRoutes.find(r => r.id === val);
                    setSelectedRoute(route);
                  }}
                >
                  <SelectTrigger id="route" className="mt-1">
                    <SelectValue placeholder="Choose route..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.route_name} - {route.driver_name} ({route.delivery_ids?.length || 0} stops)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Simulation Type */}
              {selectedRoute && (
                <div>
                  <Label htmlFor="sim_type">Simulation Type *</Label>
                  <Select value={simulationType} onValueChange={setSimulationType}>
                    <SelectTrigger id="sim_type" className="mt-1">
                      <SelectValue placeholder="What do you want to test?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add_priority_delivery">
                        ➕ Add Priority Delivery
                      </SelectItem>
                      <SelectItem value="remove_delivery">
                        ➖ Remove Delivery
                      </SelectItem>
                      <SelectItem value="traffic_reroute">
                        🚦 Traffic Delay Reroute
                      </SelectItem>
                      <SelectItem value="resequence_stops">
                        🔄 Resequence Stops
                      </SelectItem>
                      <SelectItem value="what_if_scenario">
                        💡 Custom "What-If" Scenario
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Type-Specific Inputs */}
              {simulationType === 'add_priority_delivery' && (
                <div>
                  <Label htmlFor="add_delivery">Select Priority Delivery to Add *</Label>
                  <Select value={selectedDeliveryToAdd} onValueChange={setSelectedDeliveryToAdd}>
                    <SelectTrigger id="add_delivery" className="mt-1">
                      <SelectValue placeholder="Choose delivery..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDeliveries.map((delivery) => (
                        <SelectItem key={delivery.id} value={delivery.id}>
                          {delivery.tracking_number} - {delivery.customer_name}
                          {delivery.has_premium_insurance && ' ⭐ Premium'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {simulationType === 'remove_delivery' && selectedRoute && (
                <div>
                  <Label htmlFor="remove_delivery">Select Delivery to Remove *</Label>
                  <Select value={deliveryToRemove} onValueChange={setDeliveryToRemove}>
                    <SelectTrigger id="remove_delivery" className="mt-1">
                      <SelectValue placeholder="Choose delivery to remove..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allDeliveries
                        .filter(d => selectedRoute.delivery_ids && selectedRoute.delivery_ids.includes(d.id))
                        .map((delivery, idx) => (
                          <SelectItem key={delivery.id} value={delivery.id}>
                            Stop #{idx + 1} - {delivery.customer_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {simulationType === 'traffic_reroute' && (
                <div>
                  <Label htmlFor="traffic_delay">Expected Traffic Delay (minutes)</Label>
                  <input
                    id="traffic_delay"
                    type="number"
                    value={trafficDelayMinutes}
                    onChange={(e) => setTrafficDelayMinutes(parseInt(e.target.value) || 15)}
                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-lg"
                    min="5"
                    max="120"
                  />
                </div>
              )}

              {simulationType === 'what_if_scenario' && (
                <div>
                  <Label htmlFor="scenario">Describe Your Scenario *</Label>
                  <Textarea
                    id="scenario"
                    value={customScenario}
                    onChange={(e) => setCustomScenario(e.target.value)}
                    placeholder="E.g., 'What if we add a 30-minute lunch break after stop 5?' or 'What if road construction forces us to skip the downtown area?'"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              )}

              {/* Run Simulation Button */}
              <Button
                onClick={runSimulation}
                disabled={simulating || !selectedRoute || !simulationType}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 text-lg"
              >
                {simulating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Running AI Simulation...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Past Simulations */}
          {pastSimulations.length > 0 && (
            <Card className="border-2 border-gray-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Recent Simulations ({pastSimulations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pastSimulations.slice(0, 5).map((sim) => (
                  <div 
                    key={sim.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{sim.simulation_name}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {format(new Date(sim.created_at), "MMM d 'at' h:mm a")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sim.ai_recommendation && (
                          <Badge className={getRecommendationColor(sim.ai_recommendation)}>
                            {sim.ai_recommendation.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {sim.applied_to_actual_route && (
                          <Badge className="bg-green-600">
                            Applied
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Simulation Results */}
          <Card className="border-2 border-green-300 bg-green-50">
            <CardHeader className="bg-green-100 border-b-2 border-green-300">
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-900 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  Simulation Complete
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white">
                    {simulationResults.simulation.ai_confidence}% Confidence
                  </Badge>
                  <Badge className={`${getRecommendationColor(simulationResults.simulation.ai_recommendation)} text-white`}>
                    {simulationResults.simulation.ai_recommendation.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Visual Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Original Route */}
            <Card className="border-2 border-gray-300">
              <CardHeader className="bg-gray-100 pb-3">
                <CardTitle className="text-sm text-gray-900">📍 Original Route</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded text-center">
                    <Navigation className="w-4 h-4 mx-auto text-gray-600 mb-1" />
                    <p className="text-lg font-bold text-gray-900">
                      {simulationResults.simulation.original_route_data.total_distance_miles?.toFixed(1) || 0}
                    </p>
                    <p className="text-xs text-gray-600">Miles</p>
                  </div>
                  <div className="p-2 bg-white rounded text-center">
                    <Clock className="w-4 h-4 mx-auto text-gray-600 mb-1" />
                    <p className="text-lg font-bold text-gray-900">
                      {Math.round(simulationResults.simulation.original_route_data.total_time_minutes || 0)}
                    </p>
                    <p className="text-xs text-gray-600">Minutes</p>
                  </div>
                </div>
                <div className="p-2 bg-gray-100 rounded">
                  <p className="text-xs text-gray-600">Completion:</p>
                  <p className="font-bold text-gray-900">
                    {simulationResults.simulation.original_route_data.completion_time 
                      ? format(new Date(simulationResults.simulation.original_route_data.completion_time), "h:mm a")
                      : 'N/A'}
                  </p>
                </div>
                <div className="p-2 bg-gray-100 rounded">
                  <p className="text-xs text-gray-600">Efficiency:</p>
                  <p className="font-bold text-gray-900">
                    {simulationResults.simulation.original_route_data.efficiency_score || 0}%
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Simulated Route */}
            <Card className="border-2 border-blue-300 bg-blue-50">
              <CardHeader className="bg-blue-100 pb-3">
                <CardTitle className="text-sm text-blue-900">🔮 Simulated Route</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded text-center">
                    <Navigation className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                    <p className="text-lg font-bold text-blue-900">
                      {simulationResults.simulation.simulated_route_data.total_distance_miles?.toFixed(1) || 0}
                    </p>
                    <p className="text-xs text-gray-600">Miles</p>
                  </div>
                  <div className="p-2 bg-white rounded text-center">
                    <Clock className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                    <p className="text-lg font-bold text-blue-900">
                      {Math.round(simulationResults.simulation.simulated_route_data.total_time_minutes || 0)}
                    </p>
                    <p className="text-xs text-gray-600">Minutes</p>
                  </div>
                </div>
                <div className="p-2 bg-white rounded">
                  <p className="text-xs text-gray-600">Completion:</p>
                  <p className="font-bold text-blue-900">
                    {simulationResults.simulation.simulated_route_data.completion_time
                      ? format(new Date(simulationResults.simulation.simulated_route_data.completion_time), "h:mm a")
                      : 'N/A'}
                  </p>
                </div>
                <div className="p-2 bg-white rounded">
                  <p className="text-xs text-gray-600">Efficiency:</p>
                  <p className="font-bold text-blue-900">
                    {simulationResults.simulation.simulated_route_data.efficiency_score?.toFixed(1) || 0}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Impact Summary */}
          <Card className="border-2 border-yellow-300 bg-yellow-50">
            <CardHeader className="bg-yellow-100 border-b border-yellow-200">
              <CardTitle className="text-yellow-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Impact Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3 rounded-lg text-center ${
                  (simulationResults.simulation.impact_analysis?.time_difference_minutes || 0) < 0 
                    ? 'bg-green-100 border-2 border-green-300' 
                    : 'bg-red-100 border-2 border-red-300'
                }`}>
                  <Clock className={`w-6 h-6 mx-auto mb-1 ${
                    (simulationResults.simulation.impact_analysis?.time_difference_minutes || 0) < 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`} />
                  <p className={`text-2xl font-bold ${
                    (simulationResults.simulation.impact_analysis?.time_difference_minutes || 0) < 0 
                      ? 'text-green-900' 
                      : 'text-red-900'
                  }`}>
                    {(simulationResults.simulation.impact_analysis?.time_difference_minutes || 0) > 0 ? '+' : ''}
                    {simulationResults.simulation.impact_analysis?.time_difference_minutes || 0}
                  </p>
                  <p className="text-xs text-gray-600">Minutes</p>
                </div>

                <div className={`p-3 rounded-lg text-center ${
                  (simulationResults.simulation.impact_analysis?.distance_difference_miles || 0) < 0 
                    ? 'bg-green-100 border-2 border-green-300' 
                    : 'bg-red-100 border-2 border-red-300'
                }`}>
                  <Navigation className={`w-6 h-6 mx-auto mb-1 ${
                    (simulationResults.simulation.impact_analysis?.distance_difference_miles || 0) < 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`} />
                  <p className={`text-2xl font-bold ${
                    (simulationResults.simulation.impact_analysis?.distance_difference_miles || 0) < 0 
                      ? 'text-green-900' 
                      : 'text-red-900'
                  }`}>
                    {(simulationResults.simulation.impact_analysis?.distance_difference_miles || 0) > 0 ? '+' : ''}
                    {(simulationResults.simulation.impact_analysis?.distance_difference_miles || 0).toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-600">Miles</p>
                </div>

                <div className={`p-3 rounded-lg text-center ${
                  (simulationResults.simulation.impact_analysis?.efficiency_change_percentage || 0) > 0 
                    ? 'bg-green-100 border-2 border-green-300' 
                    : 'bg-red-100 border-2 border-red-300'
                }`}>
                  <TrendingUp className={`w-6 h-6 mx-auto mb-1 ${
                    (simulationResults.simulation.impact_analysis?.efficiency_change_percentage || 0) > 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`} />
                  <p className={`text-2xl font-bold ${
                    (simulationResults.simulation.impact_analysis?.efficiency_change_percentage || 0) > 0 
                      ? 'text-green-900' 
                      : 'text-red-900'
                  }`}>
                    {(simulationResults.simulation.impact_analysis?.efficiency_change_percentage || 0) > 0 ? '+' : ''}
                    {(simulationResults.simulation.impact_analysis?.efficiency_change_percentage || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600">Efficiency</p>
                </div>

                <div className="p-3 bg-purple-100 rounded-lg text-center border-2 border-purple-300">
                  <MapPin className="w-6 h-6 mx-auto text-purple-600 mb-1" />
                  <p className="text-2xl font-bold text-purple-900">
                    {simulationResults.simulation.impact_analysis?.deliveries_affected_count || 0}
                  </p>
                  <p className="text-xs text-gray-600">Affected</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Recommendation */}
          <Card className={`border-2 ${
            simulationResults.simulation.ai_recommendation.includes('recommend') && 
            !simulationResults.simulation.ai_recommendation.includes('not')
              ? 'border-green-300 bg-green-50'
              : simulationResults.simulation.ai_recommendation.includes('not')
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = getRecommendationIcon(simulationResults.simulation.ai_recommendation);
                  return <Icon className="w-6 h-6 text-purple-600" />;
                })()}
                <div className="flex-1">
                  <CardTitle className="text-base">AI Recommendation</CardTitle>
                  <Badge className={`${getRecommendationColor(simulationResults.simulation.ai_recommendation)} text-white mt-1`}>
                    {simulationResults.simulation.ai_recommendation.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {simulationResults.simulation.ai_analysis}
              </p>
            </CardContent>
          </Card>

          {/* Pros & Cons */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pros */}
            <Card className="border-2 border-green-300 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-green-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ✅ Advantages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(simulationResults.simulation.pros || []).map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-green-900">
                      <span className="text-green-600 font-bold flex-shrink-0">{idx + 1}.</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Cons */}
            <Card className="border-2 border-orange-300 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-orange-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  ⚠️ Disadvantages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(simulationResults.simulation.cons || []).map((con, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-orange-900">
                      <span className="text-orange-600 font-bold flex-shrink-0">{idx + 1}.</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Risk Factors */}
          {simulationResults.simulation.risk_factors && simulationResults.simulation.risk_factors.length > 0 && (
            <Card className="border-2 border-red-300 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-red-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  ⚠️ Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {simulationResults.simulation.risk_factors.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-red-900">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Customer ETA Impacts */}
          {simulationResults.simulation && simulationResults.simulation.impact_analysis && simulationResults.simulation.impact_analysis.customer_eta_impacts && simulationResults.simulation.impact_analysis.customer_eta_impacts.length > 0 && (
            <Card className="border-2 border-purple-300">
              <CardHeader className="bg-purple-50 border-b border-purple-200">
                <CardTitle className="text-purple-900">Customer ETA Impacts</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {simulationResults.simulation.impact_analysis.customer_eta_impacts.map((impact) => {
                    const isEarlier = (impact.eta_shift_minutes || 0) < 0;
                    const isLater = (impact.eta_shift_minutes || 0) > 0;
                    const noChange = (impact.eta_shift_minutes || 0) === 0;

                    return (
                      <div 
                        key={impact.delivery_id}
                        className={`p-3 rounded-lg border-2 ${
                          impact.affects_delivery_window 
                            ? 'border-red-300 bg-red-50'
                            : isEarlier
                              ? 'border-green-300 bg-green-50'
                              : noChange
                                ? 'border-gray-200 bg-white'
                                : 'border-orange-300 bg-orange-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{impact.customer_name}</p>
                            {impact.affects_delivery_window && (
                              <Badge className="bg-red-600 text-white text-xs mt-1">
                                Window Affected
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            {isEarlier && (
                              <Badge className="bg-green-600 text-white">
                                <TrendingDown className="w-3 h-3 mr-1" />
                                {Math.abs(impact.eta_shift_minutes)}m earlier
                              </Badge>
                            )}
                            {isLater && (
                              <Badge className="bg-orange-600 text-white">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                {impact.eta_shift_minutes}m later
                              </Badge>
                            )}
                            {noChange && (
                              <Badge className="bg-gray-500 text-white">
                                No change
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-white rounded">
                            <p className="text-gray-600">Original ETA:</p>
                            <p className="font-semibold text-gray-900">{impact.original_eta}</p>
                          </div>
                          <div className={`p-2 rounded ${
                            isEarlier ? 'bg-green-100' : isLater ? 'bg-orange-100' : 'bg-white'
                          }`}>
                            <p className="text-gray-600">New ETA:</p>
                            <p className="font-semibold text-gray-900">{impact.new_eta}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sequence Comparison */}
          {simulationResults.aiResponse && simulationResults.aiResponse.simulated_sequence && simulationResults.aiResponse.simulated_sequence.length > 0 && (
            <Card className="border-2 border-blue-300">
              <CardHeader className="bg-blue-50 border-b border-blue-200">
                <CardTitle className="text-blue-900">Sequence Comparison</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Original Sequence */}
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-2">Original Order:</p>
                    <div className="space-y-1">
                      {(simulationResults.routeDeliveries || []).map((d, idx) => (
                        <div key={d.id} className="p-2 bg-gray-100 rounded text-sm flex items-center gap-2">
                          <span className="w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="flex-1 truncate">{d.customer_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulated Sequence */}
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-2">Simulated Order:</p>
                    <div className="space-y-1">
                      {simulationResults.aiResponse.simulated_sequence.map((seq, idx) => {
                        const delivery = allDeliveries.find(d => d.id === seq.delivery_id);
                        const originalIndex = selectedRoute && selectedRoute.delivery_ids 
                          ? selectedRoute.delivery_ids.indexOf(seq.delivery_id)
                          : -1;
                        const positionChanged = originalIndex !== -1 && originalIndex !== idx;
                        const isNewDelivery = originalIndex === -1;

                        return (
                          <div 
                            key={seq.delivery_id} 
                            className={`p-2 rounded text-sm flex items-center gap-2 ${
                              isNewDelivery 
                                ? 'bg-green-200 border-2 border-green-400'
                                : positionChanged
                                  ? 'bg-blue-100 border-2 border-blue-300'
                                  : 'bg-gray-100'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isNewDelivery 
                                ? 'bg-green-600 text-white'
                                : positionChanged
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-400 text-white'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="flex-1 truncate">{delivery?.customer_name || 'Unknown'}</span>
                            {isNewDelivery && <Badge className="bg-green-600 text-white text-xs">NEW</Badge>}
                            {positionChanged && !isNewDelivery && <ArrowRight className="w-4 h-4 text-blue-600" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={resetSimulation}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Run New Simulation
            </Button>
            
            {simulationResults.simulation.ai_recommendation && 
             simulationResults.simulation.ai_recommendation.includes('recommend') && 
             !simulationResults.simulation.ai_recommendation.includes('not') && (
              <Button
                onClick={() => {
                  if (confirm(`Apply this ${simulationType.replace(/_/g, ' ')} to the actual route?\n\nThis will update the driver's route immediately.`)) {
                    applySimulationMutation.mutate(simulationResults.simulation);
                  }
                }}
                disabled={applySimulationMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 font-bold"
              >
                {applySimulationMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Apply to Route
                  </>
                )}
              </Button>
            )}

            <Button
              onClick={() => {
                const dataStr = JSON.stringify(simulationResults.simulation, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `route-simulation-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
                a.click();
                toast.success("Simulation data downloaded!");
              }}
              variant="outline"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>

          {/* Explanation */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-xs text-blue-900">
                <Lightbulb className="w-4 h-4 inline mr-1" />
                <strong>Simulation Benefits:</strong> Test route changes risk-free before applying them. 
                See exact impacts on every customer's ETA, total route time, and efficiency. Make data-driven decisions with confidence.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
