
import { base44 } from "@/api/base44Client";
import { differenceInMinutes, differenceInSeconds } from "date-fns";

/**
 * AI-Powered Driver Behavior Monitoring System
 * Analyzes driving patterns and route adherence to detect risky behaviors
 */

class BehaviorMonitor {
  constructor(driverEmail, driverName) {
    this.driverEmail = driverEmail;
    this.driverName = driverName;
    this.lastLocationCheck = null;
    this.locationHistory = [];
    this.isMonitoring = false;
  }

  /**
   * Start continuous behavior monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Check behavior every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkBehavior();
    }, 120000); // 2 minutes
    
    console.log("Behavior monitoring started for", this.driverEmail);
  }

  /**
   * Stop behavior monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isMonitoring = false;
      console.log("Behavior monitoring stopped");
    }
  }

  /**
   * Add location data point
   */
  addLocationPoint(location, deliveryId = null) {
    const point = {
      location,
      timestamp: new Date(),
      deliveryId
    };
    
    this.locationHistory.push(point);
    
    // Keep only last 50 points (about 1.5 hours at 2-min intervals)
    if (this.locationHistory.length > 50) {
      this.locationHistory.shift();
    }
    
    // Check for movement patterns
    if (this.locationHistory.length >= 3) {
      this.checkMovementPatterns();
    }
  }

  /**
   * Check overall driver behavior
   */
  async checkBehavior() {
    try {
      // Get recent deliveries
      const recentDeliveries = await base44.entities.DeliveryRequest.filter({
        carrier_email: this.driverEmail
      });

      // Get recent exceptions
      const recentExceptions = await base44.entities.DeliveryException.filter({
        reported_by_email: this.driverEmail
      });

      // Get active routes
      const activeRoutes = await base44.entities.OptimizedRoute.filter({
        driver_email: this.driverEmail,
        status: ['active', 'in_progress']
      });

      // Analyze delivery patterns
      await this.analyzeDeliveryPatterns(recentDeliveries, recentExceptions);

      // Analyze route adherence
      if (activeRoutes.length > 0) {
        await this.analyzeRouteAdherence(activeRoutes[0], recentDeliveries);
      }

      // Analyze exception patterns
      await this.analyzeExceptionPatterns(recentExceptions);

    } catch (error) {
      console.error("Behavior monitoring error:", error);
    }
  }

  /**
   * Analyze delivery completion patterns
   */
  async analyzeDeliveryPatterns(deliveries, exceptions) {
    const today = new Date();
    const todayDeliveries = deliveries.filter(d => {
      if (!d.delivery_timestamp) return false;
      const deliveryDate = new Date(d.delivery_timestamp);
      return deliveryDate.toDateString() === today.toDateString();
    });

    if (todayDeliveries.length < 3) return; // Need enough data

    // Check for rushed deliveries (very short time between deliveries)
    const sortedDeliveries = todayDeliveries
      .sort((a, b) => new Date(a.delivery_timestamp) - new Date(b.delivery_timestamp));

    for (let i = 1; i < sortedDeliveries.length; i++) {
      const prev = sortedDeliveries[i - 1];
      const curr = sortedDeliveries[i];
      
      const timeDiff = differenceInMinutes(
        new Date(curr.delivery_timestamp),
        new Date(prev.delivery_timestamp)
      );

      // If deliveries are less than 3 minutes apart, might indicate rushing
      if (timeDiff < 3 && timeDiff > 0) {
        await this.createSafetyEvent({
          event_type: 'rapid_acceleration',
          severity: 'medium',
          location: curr.current_location,
          address: curr.delivery_address,
          delivery_id: curr.id,
          ai_confidence: 75,
          contributing_factors: ['Rushed delivery pattern detected', 'Less than 3 minutes between stops'],
          corrective_action_suggested: 'Take adequate time at each stop. Safety is more important than speed. Ensure proper package handling and customer interaction.'
        });
      }
    }

    // Check for excessive exceptions
    const todayExceptions = exceptions.filter(e => {
      const exceptionDate = new Date(e.timestamp);
      return exceptionDate.toDateString() === today.toDateString();
    });

    if (todayExceptions.length >= 3) {
      await this.createSafetyEvent({
        event_type: 'distracted_driving_pattern',
        severity: 'high',
        location: todayExceptions[0].location,
        ai_confidence: 80,
        contributing_factors: [`${todayExceptions.length} exceptions today`, 'May indicate distraction or rushing'],
        corrective_action_suggested: 'Multiple exceptions today. Take a short break to refocus. Review each delivery address carefully before departure.'
      });
    }
  }

  /**
   * Analyze route adherence
   */
  async analyzeRouteAdherence(route, deliveries) {
    if (!route.optimized_sequence || route.optimized_sequence.length === 0) return;

    const completedDeliveries = deliveries.filter(d => 
      d.status === 'delivered' && 
      route.delivery_ids.includes(d.id)
    );

    if (completedDeliveries.length < 2) return;

    // Check if driver is following optimized sequence
    const expectedOrder = route.optimized_sequence.map(s => s.delivery_id);
    const actualOrder = completedDeliveries
      .sort((a, b) => new Date(a.delivery_timestamp) - new Date(b.delivery_timestamp))
      .map(d => d.id);

    // Calculate adherence score
    let adherenceScore = 0;
    for (let i = 0; i < Math.min(actualOrder.length, expectedOrder.length); i++) {
      if (actualOrder[i] === expectedOrder[i]) {
        adherenceScore++;
      }
    }

    const adherencePercentage = (adherenceScore / actualOrder.length) * 100;

    // If adherence is low, create route deviation event
    if (adherencePercentage < 50 && actualOrder.length >= 3) {
      await this.createSafetyEvent({
        event_type: 'route_deviation',
        severity: 'low',
        route_id: route.id,
        ai_confidence: 85,
        contributing_factors: [
          `Only ${adherencePercentage.toFixed(0)}% route adherence`,
          'Deviating from optimized route may increase fuel costs and time'
        ],
        corrective_action_suggested: 'Follow the AI-optimized route sequence for maximum efficiency. If you need to deviate, communicate with dispatch.'
      });
    }

    // Check for timing issues
    for (const delivery of completedDeliveries) {
      const sequence = route.optimized_sequence.find(s => s.delivery_id === delivery.id);
      if (!sequence || !sequence.estimated_arrival) continue;

      const expectedArrival = new Date(sequence.estimated_arrival);
      const actualArrival = new Date(delivery.delivery_timestamp);
      const minutesLate = differenceInMinutes(actualArrival, expectedArrival);

      // If more than 30 minutes late, might indicate speeding or rushing
      if (minutesLate > 30) {
        await this.createSafetyEvent({
          event_type: 'speeding',
          severity: 'medium',
          location: delivery.current_location,
          address: delivery.delivery_address,
          delivery_id: delivery.id,
          ai_confidence: 70,
          contributing_factors: [
            `${minutesLate} minutes behind schedule`,
            'May indicate attempting to make up time'
          ],
          corrective_action_suggested: 'Maintain safe speeds even when behind schedule. Notify dispatch if you\'re running late rather than rushing.'
        });
      }
    }
  }

  /**
   * Analyze exception patterns
   */
  async analyzeExceptionPatterns(exceptions) {
    if (exceptions.length < 5) return;

    // Get exceptions from last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentExceptions = exceptions.filter(e => 
      new Date(e.timestamp) > weekAgo
    );

    if (recentExceptions.length === 0) return;

    // Count exception types
    const typeCounts = {};
    recentExceptions.forEach(e => {
      typeCounts[e.exception_type] = (typeCounts[e.exception_type] || 0) + 1;
    });

    // If same exception type appears 3+ times, create pattern event
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count >= 3) {
        // Use AI to analyze the pattern
        const prompt = `A delivery driver has reported ${count} "${type.replace(/_/g, ' ')}" exceptions in the past 7 days.

Analyze this pattern and provide:
1. Likely root cause
2. Safety implications
3. Specific corrective action

Format as JSON.`;

        const aiAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              root_cause: { type: "string" },
              safety_implications: { type: "string" },
              corrective_action: { type: "string" }
            }
          }
        });

        await this.createSafetyEvent({
          event_type: 'distracted_driving_pattern',
          severity: count >= 5 ? 'high' : 'medium',
          ai_confidence: 90,
          contributing_factors: [
            `${count} ${type.replace(/_/g, ' ')} exceptions in 7 days`,
            aiAnalysis.root_cause
          ],
          corrective_action_suggested: aiAnalysis.corrective_action
        });
      }
    }
  }

  /**
   * Check movement patterns from location history
   */
  async checkMovementPatterns() {
    if (this.locationHistory.length < 3) return;

    const recent = this.locationHistory.slice(-3);
    
    // Check for idling (same location for extended period)
    const allSameLocation = recent.every(p => 
      p.location.lat === recent[0].location.lat &&
      p.location.lng === recent[0].location.lng
    );

    if (allSameLocation) {
      const idleTime = differenceInMinutes(
        recent[recent.length - 1].timestamp,
        recent[0].timestamp
      );

      // If idling for more than 15 minutes (not at delivery location)
      if (idleTime > 15 && !recent[0].deliveryId) {
        await this.createSafetyEvent({
          event_type: 'idling_excessive',
          severity: 'low',
          location: `${recent[0].location.lat},${recent[0].location.lng}`,
          ai_confidence: 95,
          contributing_factors: [`Idling for ${idleTime} minutes`, 'Wastes fuel and increases emissions'],
          corrective_action_suggested: 'Turn off engine during extended stops. If experiencing difficulties, contact dispatch for assistance.'
        });
      }
    }

    // Check for erratic movement (rapid direction changes)
    // This could indicate sharp turns or distracted driving
    if (this.locationHistory.length >= 5) {
      const last5 = this.locationHistory.slice(-5);
      
      // Calculate direction changes
      let directionChanges = 0;
      for (let i = 1; i < last5.length - 1; i++) {
        const prev = last5[i - 1].location;
        const curr = last5[i].location;
        const next = last5[i + 1].location;
        
        // Simple direction check (could be enhanced with proper bearing calculations)
        const dir1 = Math.atan2(curr.lat - prev.lat, curr.lng - prev.lng);
        const dir2 = Math.atan2(next.lat - curr.lat, next.lng - curr.lng);
        const angleDiff = Math.abs(dir1 - dir2);
        
        if (angleDiff > Math.PI / 2) { // More than 90 degree change
          directionChanges++;
        }
      }

      if (directionChanges >= 3) {
        await this.createSafetyEvent({
          event_type: 'sharp_turn',
          severity: 'medium',
          location: `${last5[last5.length - 1].location.lat},${last5[last5.length - 1].location.lng}`,
          ai_confidence: 75,
          contributing_factors: ['Multiple sharp direction changes detected', 'May indicate distracted driving or navigation issues'],
          corrective_action_suggested: 'Drive smoothly and maintain steady course. If lost, safely pull over to check navigation before continuing.'
        });
      }
    }
  }

  /**
   * Create a safety event and notify driver
   */
  async createSafetyEvent(eventData) {
    try {
      // Check if similar event was created recently (avoid duplicates)
      const recentEvents = await base44.entities.DriverSafetyEvent.filter({
        driver_email: this.driverEmail
      });

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const duplicate = recentEvents.find(e => 
        e.event_type === eventData.event_type &&
        new Date(e.timestamp) > oneHourAgo
      );

      if (duplicate) return; // Don't create duplicate

      // Create the safety event
      const event = await base44.entities.DriverSafetyEvent.create({
        driver_email: this.driverEmail,
        driver_name: this.driverName,
        timestamp: new Date().toISOString(),
        driver_notified: true,
        ...eventData
      });

      // Create push notification for high/critical severity events
      if (eventData.severity === 'high' || eventData.severity === 'critical') {
        await base44.entities.PushNotification.create({
          driver_email: this.driverEmail,
          driver_name: this.driverName,
          notification_type: 'critical_safety_alert',
          priority: eventData.severity === 'critical' ? 'critical' : 'urgent',
          title: `⚠️ Safety Alert: ${eventData.event_type.replace(/_/g, ' ')}`,
          message: eventData.corrective_action_suggested || 'Please review this safety event and take corrective action.',
          action_required: true,
          action_type: 'view_safety_alert',
          action_url: 'safety',
          related_entity_type: 'safety_event',
          related_entity_id: event.id,
          sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(), // 24 hours
          sent_by: 'system'
        });
      }

      console.log("Safety event created with notification:", event);

      return event;
    } catch (error) {
      console.error("Failed to create safety event:", error);
    }
  }

  /**
   * Analyze delivery completion and create event if needed
   */
  async onDeliveryComplete(delivery, timeTaken, currentLocation) {
    // Check if delivery was too quick (potential rushing)
    if (timeTaken < 120) { // Less than 2 minutes
      await this.createSafetyEvent({
        event_type: 'rapid_acceleration',
        severity: 'low',
        location: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : delivery.current_location,
        address: delivery.delivery_address,
        delivery_id: delivery.id,
        ai_confidence: 70,
        contributing_factors: [`Delivery completed in ${timeTaken} seconds`, 'Very quick completion may indicate rushing'],
        corrective_action_suggested: 'Take adequate time for each delivery. Ensure proper customer interaction and photo documentation.'
      });
    }

    // Add this location to history
    if (currentLocation) {
      this.addLocationPoint(currentLocation, delivery.id);
    }
  }

  /**
   * Analyze exception report for safety implications
   */
  async onExceptionReported(exception) {
    // Certain exception types may indicate safety issues
    const safetyCriticalExceptions = [
      'vehicle_issue',
      'weather_delay',
      'access_issue'
    ];

    if (safetyCriticalExceptions.includes(exception.exception_type)) {
      await this.createSafetyEvent({
        event_type: 'distracted_driving_pattern',
        severity: exception.severity === 'critical' ? 'high' : 'medium',
        location: exception.location,
        delivery_id: exception.delivery_request_id,
        ai_confidence: 80,
        contributing_factors: [
          `${exception.exception_type.replace(/_/g, ' ')} reported`,
          'May indicate challenging conditions'
        ],
        corrective_action_suggested: 'If conditions are unsafe, prioritize your safety. Park safely and wait for conditions to improve or contact dispatch for guidance.'
      });
    }
  }
}

// Export singleton-like factory
const monitors = new Map();

export function getMonitor(driverEmail, driverName) {
  if (!monitors.has(driverEmail)) {
    monitors.set(driverEmail, new BehaviorMonitor(driverEmail, driverName));
  }
  return monitors.get(driverEmail);
}

export function startMonitoring(driverEmail, driverName) {
  const monitor = getMonitor(driverEmail, driverName);
  monitor.startMonitoring();
  return monitor;
}

export function stopMonitoring(driverEmail) {
  const monitor = monitors.get(driverEmail);
  if (monitor) {
    monitor.stopMonitoring();
  }
}

export default BehaviorMonitor;
