
import { base44 } from "@/api/base44Client";
import { differenceInMinutes, format } from "date-fns";

/**
 * Real-Time Route Monitoring and Dynamic Adjustment Engine
 * Continuously monitors route conditions and suggests optimizations
 */

class RealTimeRouteMonitor {
  constructor(driverEmail, driverName) {
    this.driverEmail = driverEmail;
    this.driverName = driverName;
    this.activeRoute = null;
    this.isMonitoring = false;
    this.checkInterval = null;
    this.lastCheckTime = null;
  }

  /**
   * Start monitoring active route
   */
  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Check every 5 minutes for route adjustments
    this.checkInterval = setInterval(() => {
      this.checkForRouteAdjustments();
    }, 300000); // 5 minutes
    
    // Also check immediately
    await this.checkForRouteAdjustments();
    
    console.log("Real-time route monitoring started");
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.isMonitoring = false;
      console.log("Real-time route monitoring stopped");
    }
  }

  /**
   * Update current active route
   */
  setActiveRoute(route) {
    this.activeRoute = route;
  }

  /**
   * Main check for route adjustments
   */
  async checkForRouteAdjustments() {
    if (!this.activeRoute) return;

    try {
      // Get current route status
      const routes = await base44.entities.OptimizedRoute.filter({
        id: this.activeRoute.id
      });

      if (routes.length === 0) return;
      const currentRoute = routes[0];

      // Get deliveries in route
      const allDeliveries = await base44.entities.DeliveryRequest.list();
      const deliveries = allDeliveries.filter(d => 
        currentRoute.delivery_ids.includes(d.id)
      );

      // Get any recent exceptions
      const recentExceptions = await base44.entities.DeliveryException.filter({
        delivery_request_id: { $in: currentRoute.delivery_ids },
        resolution_status: ['pending', 'escalated']
      });

      // Check various conditions that might require route adjustment
      await this.checkTrafficConditions(currentRoute, deliveries);
      await this.checkExceptionImpact(currentRoute, deliveries, recentExceptions);
      await this.checkDeliveryProgress(currentRoute, deliveries);
      await this.checkDeliveryWindows(currentRoute, deliveries);
      await this.checkWeatherConditions(currentRoute, deliveries);

      this.lastCheckTime = new Date();
    } catch (error) {
      console.error("Error checking route adjustments:", error);
    }
  }

  /**
   * Check weather conditions and suggest modifications
   */
  async checkWeatherConditions(route, deliveries) {
    try {
      const remainingDeliveries = deliveries.filter(d => d.status !== 'delivered');
      if (remainingDeliveries.length < 2) return;

      // Simulate weather check - in production, integrate real weather API
      const weatherPrompt = `Analyze weather impact on delivery route.

ROUTE: ${route.route_name}
DRIVER: ${route.driver_name}
REMAINING STOPS: ${remainingDeliveries.length}
CURRENT TIME: ${format(new Date(), "h:mm a")}

DELIVERIES:
${remainingDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name} - ${d.delivery_address}
   Premium: ${d.has_premium_insurance ? 'YES' : 'NO'}
`).join('\n')}

Assuming current weather conditions:
- Temperature: 45°F
- Conditions: Light rain expected in 2 hours
- Visibility: Moderate

Should route be modified? Consider:
1. Safety implications
2. Delivery time window conflicts
3. Package protection (especially premium)
4. Driver safety and efficiency`;

      const weatherAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: weatherPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            modification_needed: { type: "boolean" },
            suggested_sequence: {
              type: "array",
              items: { type: "string" }
            },
            reasoning: { type: "string" },
            confidence: { type: "number" },
            weather_impact_score: { type: "number" },
            safety_priority_adjustments: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      if (weatherAnalysis.modification_needed) {
        // Check for existing weather-related modifications
        const existingMods = await base44.entities.RouteModification.filter({
          route_id: route.id,
          trigger_reason: 'weather_conditions',
          status: ['pending_driver_review', 'pending_dispatcher_approval']
        });

        if (existingMods.length > 0) return;

        await base44.entities.RouteModification.create({
          route_id: route.id,
          driver_email: this.driverEmail,
          driver_name: this.driverName,
          modification_type: 'change_priority',
          trigger_reason: 'weather_conditions',
          trigger_details: 'AI detected weather conditions that may impact route safety and delivery success',
          original_sequence: route.delivery_ids,
          modified_sequence: weatherAnalysis.suggested_sequence,
          affected_deliveries: weatherAnalysis.suggested_sequence,
          ai_confidence: weatherAnalysis.confidence,
          ai_reasoning: weatherAnalysis.reasoning,
          suggested_at: new Date().toISOString(),
          status: 'pending_driver_review',
          requires_dispatcher_approval: false,
          expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
          priority: weatherAnalysis.weather_impact_score >= 7 ? 'high' : 'medium'
        });

        console.log("Weather-based route modification suggested");
      }
    } catch (error) {
      console.error("Error checking weather conditions:", error);
    }
  }

  /**
   * Check traffic conditions (enhanced with better AI analysis)
   */
  async checkTrafficConditions(route, deliveries) {
    const remainingDeliveries = deliveries.filter(d => d.status !== 'delivered');
    
    if (remainingDeliveries.length < 2) return;

    // Simulate: 15% chance of traffic issue (replace with real traffic API)
    const hasTrafficIssue = Math.random() < 0.15;
    
    if (hasTrafficIssue) {
      const existingMods = await base44.entities.RouteModification.filter({
        route_id: route.id,
        trigger_reason: ['heavy_traffic', 'accident_reported', 'road_closure'],
        status: ['pending_driver_review', 'pending_dispatcher_approval']
      });

      if (existingMods.length > 0) return;

      await this.suggestTrafficBasedResequence(route, remainingDeliveries);
    }
  }

  /**
   * Suggest traffic-based resequence with enhanced AI
   */
  async suggestTrafficBasedResequence(route, remainingDeliveries) {
    try {
      const prompt = `You are an expert route optimization AI analyzing traffic conditions.

CURRENT ROUTE STATUS:
- Driver: ${this.driverName}
- Remaining Deliveries: ${remainingDeliveries.length}
- Original ETA: ${route.estimated_completion_time ? format(new Date(route.estimated_completion_time), 'h:mm a') : 'Unknown'}
- Current Time: ${format(new Date(), 'h:mm a')}

TRAFFIC SITUATION:
- Heavy traffic detected on current route path
- Alternative routes available with lighter traffic
- Rush hour considerations
- Real-time congestion patterns

DELIVERIES TO OPTIMIZE:
${remainingDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name}
   Address: ${d.delivery_address}
   Priority: ${d.has_premium_insurance ? 'HIGH (Premium)' : 'NORMAL'}
   Insurance: ${d.insurance_tier || 'none'}
   Scheduled: ${d.scheduled_delivery_date ? format(new Date(d.scheduled_delivery_date), "MMM d 'at' h:mm a") : 'Flexible'}
   Current Sequence Position: ${i + 1}
`).join('\n')}

OPTIMIZATION REQUIREMENTS:
1. Minimize time in traffic
2. Geographic clustering to reduce backtracking  
3. Honor delivery windows (highest priority)
4. Prioritize premium/insured packages
5. Calculate realistic time savings

PROVIDE:
- Optimized delivery sequence (IDs in new order)
- Estimated time saved in minutes
- Detailed reasoning for changes
- Confidence level (0-100) based on:
  * Traffic data reliability
  * Geographic optimization quality
  * Delivery window compliance
  * Risk of unforeseen delays
- Specific traffic factors considered`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            suggested_sequence: {
              type: "array",
              items: { type: "string" }
            },
            estimated_time_saved_minutes: { type: "number" },
            estimated_distance_change_miles: { type: "number" },
            reasoning: { type: "string" },
            confidence: { type: "number" },
            traffic_factors: {
              type: "array",
              items: { type: "string" }
            },
            risk_assessment: { type: "string" },
            alternative_benefits: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      const modification = await base44.entities.RouteModification.create({
        route_id: route.id,
        driver_email: this.driverEmail,
        driver_name: this.driverName,
        modification_type: 'route_around_traffic',
        trigger_reason: 'heavy_traffic',
        trigger_details: `AI Traffic Analysis: ${aiResponse.traffic_factors?.join(', ') || 'Traffic detected on route'}`,
        original_sequence: route.delivery_ids,
        modified_sequence: aiResponse.suggested_sequence,
        affected_deliveries: aiResponse.suggested_sequence,
        original_estimated_time: route.total_estimated_time_minutes,
        new_estimated_time: route.total_estimated_time_minutes - aiResponse.estimated_time_saved_minutes,
        time_saved_minutes: aiResponse.estimated_time_saved_minutes,
        original_distance_miles: route.total_distance_miles,
        new_distance_miles: route.total_distance_miles + (aiResponse.estimated_distance_change_miles || 0),
        ai_confidence: aiResponse.confidence,
        ai_reasoning: `${aiResponse.reasoning}\n\nRisk Assessment: ${aiResponse.risk_assessment}\n\nAdditional Benefits: ${aiResponse.alternative_benefits?.join(', ')}`,
        suggested_at: new Date().toISOString(),
        status: aiResponse.confidence >= 85 ? 'pending_driver_review' : 'pending_dispatcher_approval',
        requires_dispatcher_approval: aiResponse.confidence < 85,
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
        priority: aiResponse.estimated_time_saved_minutes >= 15 ? 'high' : 'medium'
      });

      await base44.entities.PushNotification.create({
        driver_email: this.driverEmail,
        driver_name: this.driverName,
        notification_type: 'urgent_route_modification',
        priority: aiResponse.estimated_time_saved_minutes >= 15 ? 'urgent' : 'high',
        title: '🚦 AI Traffic Optimization',
        message: `Route adjusted to avoid traffic. Save ${aiResponse.estimated_time_saved_minutes} minutes! Confidence: ${aiResponse.confidence}%`,
        action_required: true,
        action_type: 'review_route_change',
        action_url: 'route',
        related_entity_type: 'route_modification',
        related_entity_id: modification.id,
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
        sent_by: 'AI System'
      });

      console.log("Enhanced traffic-based route modification created");
    } catch (error) {
      console.error("Error suggesting traffic-based resequence:", error);
    }
  }

  /**
   * Check impact of exceptions on route
   */
  async checkExceptionImpact(route, deliveries, exceptions) {
    if (exceptions.length === 0) return;

    const criticalExceptions = exceptions.filter(e => 
      e.severity === 'critical' || e.severity === 'high'
    );

    for (const exception of criticalExceptions) {
      const delivery = deliveries.find(d => d.id === exception.delivery_request_id);
      if (!delivery) continue;

      if (delivery.exception_count >= 2) {
        await this.suggestSkipDelivery(route, delivery, exception, deliveries);
      } else {
        await this.suggestResequenceForException(route, delivery, exception, deliveries);
      }
    }
  }

  /**
   * Suggest skipping a problematic delivery with enhanced AI
   */
  async suggestSkipDelivery(route, delivery, exception, allDeliveries) {
    try {
      const remainingDeliveries = allDeliveries.filter(d => 
        d.status !== 'delivered' && d.id !== delivery.id
      );

      const skipAnalysisPrompt = `Analyze whether to skip a problematic delivery.

PROBLEMATIC DELIVERY:
- Customer: ${delivery.customer_name}
- Address: ${delivery.delivery_address}
- Tracking: ${delivery.tracking_number}
- Exception Count: ${delivery.exception_count}
- Current Exception: ${exception.exception_type}
- Severity: ${exception.severity}
- Description: ${exception.description}

REMAINING ROUTE:
- ${remainingDeliveries.length} other deliveries remain
- Estimated time if skip: Save ~15 minutes
- Can reattempt tomorrow

FACTORS TO CONSIDER:
1. Impact on other deliveries if we continue trying
2. Customer satisfaction vs operational efficiency
3. Whether exception is likely to resolve today
4. Premium package priority
5. Overall route completion success

Should we skip this delivery? Provide confidence score and reasoning.`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: skipAnalysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            should_skip: { type: "boolean" },
            confidence_score: { type: "number" },
            reasoning: { type: "string" },
            estimated_time_saved: { type: "number" },
            risk_factors: {
              type: "array",
              items: { type: "string" }
            },
            alternative_actions: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      if (aiAnalysis.should_skip) {
        const newSequence = route.delivery_ids.filter(id => id !== delivery.id);

        const modification = await base44.entities.RouteModification.create({
          route_id: route.id,
          driver_email: this.driverEmail,
          driver_name: this.driverName,
          modification_type: 'skip_delivery',
          trigger_reason: 'exception_occurred',
          trigger_details: `AI Analysis: ${delivery.exception_count} exceptions for ${delivery.tracking_number}. Latest: ${exception.exception_type}. ${aiAnalysis.risk_factors?.join(', ')}`,
          original_sequence: route.delivery_ids,
          modified_sequence: newSequence,
          affected_deliveries: [delivery.id],
          original_estimated_time: route.total_estimated_time_minutes,
          new_estimated_time: route.total_estimated_time_minutes - aiAnalysis.estimated_time_saved,
          time_saved_minutes: aiAnalysis.estimated_time_saved,
          ai_confidence: aiAnalysis.confidence_score,
          ai_reasoning: `${aiAnalysis.reasoning}\n\nRisk Factors: ${aiAnalysis.risk_factors?.join(', ')}\n\nAlternatives Considered: ${aiAnalysis.alternative_actions?.join(', ')}`,
          suggested_at: new Date().toISOString(),
          status: 'pending_dispatcher_approval',
          requires_dispatcher_approval: true,
          expires_at: new Date(Date.now() + 60 * 60000).toISOString(),
          priority: aiAnalysis.confidence_score >= 80 ? 'high' : 'medium'
        });

        await base44.entities.PushNotification.create({
          driver_email: this.driverEmail,
          driver_name: this.driverName,
          notification_type: 'immediate_exception_response',
          priority: 'urgent',
          title: '⚠️ AI Skip Recommendation',
          message: `AI suggests skipping ${delivery.tracking_number} (${delivery.exception_count} exceptions). Can save ${aiAnalysis.estimated_time_saved}min. Dispatcher review required.`,
          action_required: true,
          action_type: 'review_route_change',
          action_url: 'route',
          related_entity_type: 'route_modification',
          related_entity_id: modification.id,
          sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60 * 60000).toISOString(),
          sent_by: 'AI System'
        });

        console.log("AI-enhanced skip delivery suggestion created");
      }
    } catch (error) {
      console.error("Error suggesting skip delivery:", error);
    }
  }

  /**
   * Suggest resequencing to handle exception
   */
  async suggestResequenceForException(route, delivery, exception, allDeliveries) {
    try {
      // Move problematic delivery to end of route
      const newSequence = route.delivery_ids.filter(id => id !== delivery.id);
      newSequence.push(delivery.id);

      const remainingDeliveries = allDeliveries.filter(d => 
        newSequence.includes(d.id) && d.status !== 'delivered'
      );

      await base44.entities.RouteModification.create({
        route_id: route.id,
        driver_email: this.driverEmail,
        driver_name: this.driverName,
        modification_type: 'resequence',
        trigger_reason: 'exception_occurred',
        trigger_details: `Exception: ${exception.exception_type}. Moving ${delivery.tracking_number} to end of route to allow resolution time while completing other deliveries.`,
        original_sequence: route.delivery_ids,
        modified_sequence: newSequence,
        affected_deliveries: [delivery.id],
        ai_confidence: 75,
        ai_reasoning: `Resequencing strategy: Complete ${remainingDeliveries.length - 1} successful deliveries first while giving more time for exception resolution. This maintains route momentum and may allow customer/address issue to be resolved.`,
        suggested_at: new Date().toISOString(),
        status: 'pending_driver_review',
        requires_dispatcher_approval: false,
        expires_at: new Date(Date.now() + 20 * 60000).toISOString(),
        priority: 'medium'
      });
    } catch (error) {
      console.error("Error suggesting resequence for exception:", error);
    }
  }

  /**
   * Check actual delivery progress vs estimates
   */
  async checkDeliveryProgress(route, deliveries) {
    const completedDeliveries = deliveries.filter(d => 
      d.status === 'delivered' && d.delivery_timestamp
    );

    if (completedDeliveries.length < 2) return;

    // Calculate if driver is running behind schedule
    let totalDelay = 0;
    
    for (const delivery of completedDeliveries) {
      const sequenceInfo = route.optimized_sequence?.find(s => s.delivery_id === delivery.id);
      if (!sequenceInfo || !sequenceInfo.estimated_arrival) continue;

      const estimated = new Date(sequenceInfo.estimated_arrival);
      const actual = new Date(delivery.delivery_timestamp);
      const delayMinutes = differenceInMinutes(actual, estimated);
      
      if (delayMinutes > 0) {
        totalDelay += delayMinutes;
      }
    }

    // If running more than 30 minutes behind, suggest optimization
    const avgDelay = totalDelay / completedDeliveries.length;
    if (avgDelay > 15) {
      await this.suggestProgressBasedOptimization(route, deliveries, avgDelay);
    }
  }

  /**
   * Suggest optimization based on actual progress
   */
  async suggestProgressBasedOptimization(route, deliveries, avgDelay) {
    try {
      const remainingDeliveries = deliveries.filter(d => d.status !== 'delivered');
      if (remainingDeliveries.length < 2) return;

      const prompt = `Route performance analysis and recovery optimization.

PERFORMANCE STATUS:
- Driver: ${this.driverName}
- Running Behind: ${avgDelay.toFixed(1)} minutes per stop
- Remaining Deliveries: ${remainingDeliveries.length}
- Must recover time to meet route completion target

REMAINING STOPS:
${remainingDeliveries.map((d, i) => `
${i + 1}. ${d.customer_name}
   Address: ${d.delivery_address}
   Premium: ${d.has_premium_insurance}
   Scheduled: ${d.scheduled_delivery_date || 'Flexible'}
`).join('\n')}

OPTIMIZATION GOAL:
Resequence to recover maximum time while ensuring:
1. Critical time windows are met
2. Geographic efficiency (minimize driving)
3. Premium packages get priority
4. Realistic improvement (don't over-promise)

Provide optimized sequence with realistic time recovery estimate.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            optimized_sequence: { 
              type: "array", 
              items: { type: "string" } 
            },
            time_recovery_minutes: { type: "number" },
            confidence_score: { type: "number" },
            reasoning: { type: "string" },
            key_changes: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      const existingMods = await base44.entities.RouteModification.filter({
        route_id: route.id,
        trigger_reason: 'driver_reported_delay',
        status: ['pending_driver_review', 'pending_dispatcher_approval']
      });

      if (existingMods.length > 0) return;

      await base44.entities.RouteModification.create({
        route_id: route.id,
        driver_email: this.driverEmail,
        driver_name: this.driverName,
        modification_type: 'resequence',
        trigger_reason: 'driver_reported_delay',
        trigger_details: `Driver running ${avgDelay.toFixed(1)} min/stop behind schedule. AI detected optimization opportunity.`,
        original_sequence: route.delivery_ids,
        modified_sequence: aiResponse.optimized_sequence,
        time_saved_minutes: aiResponse.time_recovery_minutes,
        ai_confidence: aiResponse.confidence_score,
        ai_reasoning: `${aiResponse.reasoning}\n\nKey Changes: ${aiResponse.key_changes?.join('; ')}`,
        suggested_at: new Date().toISOString(),
        status: aiResponse.confidence_score >= 75 ? 'pending_driver_review' : 'pending_dispatcher_approval',
        requires_dispatcher_approval: aiResponse.confidence_score < 75,
        expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
        priority: 'high'
      });
    } catch (error) {
      console.error("Error suggesting progress-based optimization:", error);
    }
  }

  /**
   * Check delivery windows
   */
  async checkDeliveryWindows(route, deliveries) {
    const now = new Date();
    const remainingDeliveries = deliveries.filter(d => d.status !== 'delivered');

    for (const delivery of remainingDeliveries) {
      if (!delivery.scheduled_delivery_date) continue;

      const scheduledDate = new Date(delivery.scheduled_delivery_date);
      const hoursUntil = differenceInMinutes(scheduledDate, now) / 60;

      // If delivery window is within 2 hours and it's not next, suggest reprioritization
      if (hoursUntil < 2 && hoursUntil > 0) {
        const currentSequence = route.delivery_ids.indexOf(delivery.id);
        const completedCount = deliveries.filter(d => d.status === 'delivered').length;

        if (currentSequence - completedCount > 2) {
          await this.suggestPriorityChange(route, delivery, deliveries, "Approaching delivery window");
        }
      }
    }
  }

  /**
   * Suggest priority change
   */
  async suggestPriorityChange(route, delivery, allDeliveries, reason) {
    try {
      const completedCount = allDeliveries.filter(d => 
        d.status === 'delivered' && route.delivery_ids.includes(d.id)
      ).length;

      const newSequence = [...route.delivery_ids];
      const currentIndex = newSequence.indexOf(delivery.id);
      
      if (currentIndex > completedCount) {
        newSequence.splice(currentIndex, 1);
        newSequence.splice(completedCount, 0, delivery.id);

        await base44.entities.RouteModification.create({
          route_id: route.id,
          driver_email: this.driverEmail,
          driver_name: this.driverName,
          modification_type: 'change_priority',
          trigger_reason: 'delivery_window_conflict',
          trigger_details: reason,
          original_sequence: route.delivery_ids,
          modified_sequence: newSequence,
          affected_deliveries: [delivery.id],
          ai_confidence: 90,
          ai_reasoning: `${reason}. Moving ${delivery.tracking_number} to next delivery position to meet scheduled window at ${format(new Date(delivery.scheduled_delivery_date), 'h:mm a')}. High confidence due to clear time constraint.`,
          suggested_at: new Date().toISOString(),
          status: 'pending_driver_review',
          requires_dispatcher_approval: false,
          expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
          priority: 'urgent'
        });
      }
    } catch (error) {
      console.error("Error suggesting priority change:", error);
    }
  }
}

// Export singleton factory
const monitors = new Map();

export function getRouteMonitor(driverEmail, driverName) {
  if (!monitors.has(driverEmail)) {
    monitors.set(driverEmail, new RealTimeRouteMonitor(driverEmail, driverName));
  }
  return monitors.get(driverEmail);
}

export function startRouteMonitoring(driverEmail, driverName, activeRoute) {
  const monitor = getRouteMonitor(driverEmail, driverName);
  monitor.setActiveRoute(activeRoute);
  monitor.startMonitoring();
  return monitor;
}

export function stopRouteMonitoring(driverEmail) {
  const monitor = monitors.get(driverEmail);
  if (monitor) {
    monitor.stopMonitoring();
  }
}

export default RealTimeRouteMonitor;
