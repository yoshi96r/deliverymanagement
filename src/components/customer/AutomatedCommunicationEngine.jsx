import { base44 } from "@/api/base44Client";
import { format, addMinutes, differenceInMinutes } from "date-fns";

/**
 * Automated Customer Communication Engine
 * Monitors deliveries and automatically sends personalized updates
 */

class AutomatedCommunicationEngine {
  constructor() {
    this.monitoringInterval = null;
    this.lastCheck = new Date();
  }

  /**
   * Start monitoring deliveries for communication triggers
   */
  async startMonitoring() {
    console.log("🤖 Starting Automated Customer Communication Engine...");
    
    // Check immediately
    await this.checkForCommunicationTriggers();
    
    // Then check every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkForCommunicationTriggers();
    }, 120000); // 2 minutes
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log("Stopped automated communication monitoring");
    }
  }

  /**
   * Main check for communication triggers
   */
  async checkForCommunicationTriggers() {
    try {
      const deliveries = await base44.entities.DeliveryRequest.list();
      const activeDeliveries = deliveries.filter(d => 
        !['delivered', 'cancelled'].includes(d.status)
      );

      for (const delivery of activeDeliveries) {
        // Skip if no customer contact info
        if (!delivery.customer_email && !delivery.customer_phone) continue;

        // Check various triggers
        await this.checkOutForDeliveryTrigger(delivery);
        await this.checkApproachingTrigger(delivery);
        await this.checkDelayTrigger(delivery);
        await this.checkExceptionTrigger(delivery);
      }

      this.lastCheck = new Date();
    } catch (error) {
      console.error("Error checking communication triggers:", error);
    }
  }

  /**
   * Trigger: Package is out for delivery
   */
  async checkOutForDeliveryTrigger(delivery) {
    if (delivery.status !== 'out_for_delivery') return;

    // Check if we already sent this notification
    const existingComms = await base44.entities.CustomerCommunication.filter({
      delivery_request_id: delivery.id,
      trigger_event: 'status_changed_to_out_for_delivery'
    });

    if (existingComms.length > 0) return;

    // Get route info
    const routes = await base44.entities.OptimizedRoute.filter({
      delivery_ids: delivery.id,
      status: ['active', 'in_progress']
    });

    const route = routes.length > 0 ? routes[0] : null;
    const stopPosition = route ? route.delivery_ids.indexOf(delivery.id) + 1 : null;
    const totalStops = route ? route.delivery_ids.length : null;

    // Generate AI-personalized message
    const messagePrompt = `Generate a friendly, professional notification to customer that their package is out for delivery.

Customer: ${delivery.customer_name}
Tracking: ${delivery.tracking_number}
Address: ${delivery.delivery_address}
${route ? `Route Position: Stop ${stopPosition} of ${totalStops}` : ''}
${route?.estimated_completion_time ? `Expected Delivery By: ${format(new Date(route.estimated_completion_time), 'h:mm a')}` : ''}
Driver: ${delivery.carrier_name || 'Your carrier'}

Create a warm, professional message that:
1. Confirms package is on the way
2. Provides estimated delivery timeframe
3. Mentions what customer should do if not home
4. Is concise but friendly
5. Includes tracking number for reference

Generate both email subject and message body.`;

    const aiMessage = await base44.integrations.Core.InvokeLLM({
      prompt: messagePrompt,
      response_json_schema: {
        type: "object",
        properties: {
          email_subject: { type: "string" },
          message_body: { type: "string" },
          sms_version: { type: "string" }
        }
      }
    });

    // Send email
    if (delivery.customer_email) {
      await base44.integrations.Core.SendEmail({
        to: delivery.customer_email,
        subject: aiMessage.email_subject,
        body: aiMessage.message_body,
        from_name: 'USPS Delivery Updates'
      });

      await base44.entities.CustomerCommunication.create({
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        customer_name: delivery.customer_name,
        customer_email: delivery.customer_email,
        communication_type: 'email',
        message_category: 'status_update',
        trigger_event: 'status_changed_to_out_for_delivery',
        message_subject: aiMessage.email_subject,
        message_body: aiMessage.message_body,
        ai_generated: true,
        ai_confidence: 95,
        personalization_data: {
          driver_name: delivery.carrier_name,
          stops_away: stopPosition,
          current_eta: route?.estimated_completion_time
        },
        sent_at: new Date().toISOString(),
        delivered: true,
        delivered_at: new Date().toISOString()
      });
    }

    // Send SMS (simulated - would use Twilio in production)
    if (delivery.customer_phone) {
      // In production: await sendSMS(delivery.customer_phone, aiMessage.sms_version)
      
      await base44.entities.CustomerCommunication.create({
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        customer_name: delivery.customer_name,
        customer_phone: delivery.customer_phone,
        communication_type: 'sms',
        message_category: 'status_update',
        trigger_event: 'status_changed_to_out_for_delivery',
        message_subject: 'Package Out for Delivery',
        message_body: aiMessage.sms_version,
        ai_generated: true,
        ai_confidence: 95,
        sent_at: new Date().toISOString(),
        delivered: true
      });
    }

    console.log(`Sent out-for-delivery notification: ${delivery.tracking_number}`);
  }

  /**
   * Trigger: Driver is approaching (within 3 stops or 30 minutes)
   */
  async checkApproachingTrigger(delivery) {
    if (delivery.status !== 'out_for_delivery') return;

    // Get active route
    const routes = await base44.entities.OptimizedRoute.filter({
      delivery_ids: delivery.id,
      status: ['active', 'in_progress']
    });

    if (routes.length === 0) return;
    const route = routes[0];

    // Find delivery position
    const deliveryPosition = route.delivery_ids.indexOf(delivery.id);
    
    // Get completed deliveries
    const allDeliveries = await base44.entities.DeliveryRequest.list();
    const routeDeliveries = allDeliveries.filter(d => route.delivery_ids.includes(d.id));
    const completedCount = routeDeliveries.filter(d => d.status === 'delivered').length;

    const stopsAway = deliveryPosition - completedCount;

    // Only trigger if 3 stops or less away
    if (stopsAway > 3 || stopsAway < 0) return;

    // Check if already sent
    const existingComms = await base44.entities.CustomerCommunication.filter({
      delivery_request_id: delivery.id,
      trigger_event: 'driver_within_10_stops'
    });

    if (existingComms.length > 0) return;

    // Generate approaching message
    const messagePrompt = `Generate an "approaching soon" notification for customer.

Customer: ${delivery.customer_name}
Tracking: ${delivery.tracking_number}
Stops Away: ${stopsAway}
Estimated Time: ${stopsAway * 8} minutes (approximate)
Driver: ${delivery.carrier_name}

Create a message that:
1. Lets them know driver is nearby (${stopsAway} stops away)
2. Provides realistic time estimate
3. Reminds them to be available
4. Is brief and actionable

Generate email and SMS versions.`;

    const aiMessage = await base44.integrations.Core.InvokeLLM({
      prompt: messagePrompt,
      response_json_schema: {
        type: "object",
        properties: {
          email_subject: { type: "string" },
          message_body: { type: "string" },
          sms_version: { type: "string" }
        }
      }
    });

    // Send notifications
    if (delivery.customer_email) {
      await base44.integrations.Core.SendEmail({
        to: delivery.customer_email,
        subject: aiMessage.email_subject,
        body: aiMessage.message_body,
        from_name: 'USPS Delivery Updates'
      });
    }

    await base44.entities.CustomerCommunication.create({
      delivery_request_id: delivery.id,
      tracking_number: delivery.tracking_number,
      customer_name: delivery.customer_name,
      customer_email: delivery.customer_email,
      customer_phone: delivery.customer_phone,
      communication_type: delivery.customer_email ? 'email' : 'sms',
      message_category: 'approaching_soon',
      trigger_event: 'driver_within_10_stops',
      message_subject: aiMessage.email_subject,
      message_body: aiMessage.message_body,
      ai_generated: true,
      ai_confidence: 90,
      personalization_data: {
        driver_name: delivery.carrier_name,
        stops_away: stopsAway,
        estimated_minutes: stopsAway * 8
      },
      sent_at: new Date().toISOString(),
      delivered: true
    });

    console.log(`Sent approaching notification: ${delivery.tracking_number} (${stopsAway} stops away)`);
  }

  /**
   * Trigger: Delay detected on route
   */
  async checkDelayTrigger(delivery) {
    if (delivery.status !== 'out_for_delivery') return;
    if (!delivery.scheduled_delivery_date) return;

    const scheduledDate = new Date(delivery.scheduled_delivery_date);
    const now = new Date();

    // If past scheduled time by more than 30 minutes
    const delayMinutes = differenceInMinutes(now, scheduledDate);
    if (delayMinutes < 30) return;

    // Check if already notified of delay
    const existingComms = await base44.entities.CustomerCommunication.filter({
      delivery_request_id: delivery.id,
      trigger_event: 'delay_detected'
    });

    if (existingComms.length > 0) {
      // Don't send duplicate delay notifications within 2 hours
      const lastComm = existingComms[existingComms.length - 1];
      const minutesSinceLastComm = differenceInMinutes(now, new Date(lastComm.sent_at));
      if (minutesSinceLastComm < 120) return;
    }

    // Get route for ETA
    const routes = await base44.entities.OptimizedRoute.filter({
      delivery_ids: delivery.id,
      status: ['active', 'in_progress']
    });

    const route = routes[0];
    const deliveryPosition = route ? route.delivery_ids.indexOf(delivery.id) : -1;
    
    // Calculate new ETA
    let newETA = 'later today';
    if (route && deliveryPosition >= 0) {
      const routeDeliveries = await base44.entities.DeliveryRequest.filter({
        id: { $in: route.delivery_ids }
      });
      const completedCount = routeDeliveries.filter(d => d.status === 'delivered').length;
      const stopsRemaining = deliveryPosition - completedCount;
      const estimatedMinutes = stopsRemaining * 10; // 10 min per stop
      newETA = format(addMinutes(now, estimatedMinutes), 'h:mm a');
    }

    // AI-generate proactive delay message
    const messagePrompt = `Generate a proactive, apologetic message about delivery delay.

Customer: ${delivery.customer_name}
Tracking: ${delivery.tracking_number}
Original ETA: ${format(scheduledDate, 'h:mm a')}
Current Time: ${format(now, 'h:mm a')}
Delay: ${delayMinutes} minutes
New ETA: ${newETA}
Driver: ${delivery.carrier_name}

Create a message that:
1. Apologizes for the delay professionally
2. Explains delay is due to route conditions (without blaming driver)
3. Provides updated ETA
4. Reassures package will arrive today
5. Thanks customer for patience

Be empathetic, professional, and solution-focused.`;

    const aiMessage = await base44.integrations.Core.InvokeLLM({
      prompt: messagePrompt,
      response_json_schema: {
        type: "object",
        properties: {
          email_subject: { type: "string" },
          message_body: { type: "string" },
          sms_version: { type: "string" },
          tone: { type: "string" }
        }
      }
    });

    // Send proactive update
    if (delivery.customer_email) {
      await base44.integrations.Core.SendEmail({
        to: delivery.customer_email,
        subject: aiMessage.email_subject,
        body: aiMessage.message_body,
        from_name: 'USPS Customer Service'
      });
    }

    await base44.entities.CustomerCommunication.create({
      delivery_request_id: delivery.id,
      tracking_number: delivery.tracking_number,
      customer_name: delivery.customer_name,
      customer_email: delivery.customer_email,
      customer_phone: delivery.customer_phone,
      communication_type: 'email',
      message_category: 'delay_notification',
      trigger_event: 'delay_detected',
      message_subject: aiMessage.email_subject,
      message_body: aiMessage.message_body,
      ai_generated: true,
      ai_confidence: 88,
      personalization_data: {
        driver_name: delivery.carrier_name,
        current_eta: newETA,
        delay_reason: 'route_conditions'
      },
      sent_at: new Date().toISOString(),
      delivered: true
    });

    console.log(`Sent proactive delay notification: ${delivery.tracking_number}`);
  }

  /**
   * Trigger: Exception occurred
   */
  async checkExceptionTrigger(delivery) {
    if (!delivery.has_active_exception) return;

    // Get recent exceptions
    const exceptions = await base44.entities.DeliveryException.filter({
      delivery_request_id: delivery.id,
      resolution_status: ['pending', 'reattempt_scheduled', 'escalated']
    });

    for (const exception of exceptions) {
      // Check if already notified about this specific exception
      const existingComms = await base44.entities.CustomerCommunication.filter({
        delivery_request_id: delivery.id,
        trigger_event: 'exception_reported',
        sent_at: { $gte: exception.timestamp }
      });

      if (existingComms.length > 0) continue;

      // Generate empathetic exception message
      const messagePrompt = `Generate a customer-friendly exception notification.

Customer: ${delivery.customer_name}
Tracking: ${delivery.tracking_number}
Exception: ${exception.exception_type}
Driver Notes: ${exception.description}
${exception.reattempt_date ? `Reattempt Scheduled: ${format(new Date(exception.reattempt_date), "EEEE, MMMM d")}` : ''}

Create a message that:
1. Explains what happened in simple terms
2. Provides next steps
3. Offers solutions (if applicable)
4. Is empathetic and apologetic
5. Gives customer control/options

Be professional yet warm. Don't blame anyone.`;

      const aiMessage = await base44.integrations.Core.InvokeLLM({
        prompt: messagePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            email_subject: { type: "string" },
            message_body: { type: "string" },
            sms_version: { type: "string" },
            call_to_action: { type: "string" }
          }
        }
      });

      if (delivery.customer_email) {
        await base44.integrations.Core.SendEmail({
          to: delivery.customer_email,
          subject: aiMessage.email_subject,
          body: aiMessage.message_body,
          from_name: 'USPS Customer Service'
        });
      }

      await base44.entities.CustomerCommunication.create({
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        customer_name: delivery.customer_name,
        customer_email: delivery.customer_email,
        communication_type: 'email',
        message_category: 'exception_notification',
        trigger_event: 'exception_reported',
        message_subject: aiMessage.email_subject,
        message_body: aiMessage.message_body,
        ai_generated: true,
        ai_confidence: 92,
        sent_at: new Date().toISOString(),
        delivered: true
      });

      console.log(`Sent exception notification: ${delivery.tracking_number}`);
    }
  }

  /**
   * Send delivery confirmation
   */
  static async sendDeliveryConfirmation(delivery) {
    // Check if already sent
    const existingComms = await base44.entities.CustomerCommunication.filter({
      delivery_request_id: delivery.id,
      trigger_event: 'delivery_completed'
    });

    if (existingComms.length > 0) return;

    // Generate confirmation message with feedback request
    const messagePrompt = `Generate a delivery confirmation message with feedback request.

Customer: ${delivery.customer_name}
Tracking: ${delivery.tracking_number}
Delivered At: ${delivery.delivery_address}
Driver: ${delivery.carrier_name}
Time: ${format(new Date(delivery.delivery_timestamp), "h:mm a")}

Create a message that:
1. Confirms successful delivery
2. Thanks customer
3. Requests quick feedback (1-5 rating)
4. Asks if delivery met expectations
5. Provides link to view delivery proof

Keep it brief but warm and appreciative.`;

    const aiMessage = await base44.integrations.Core.InvokeLLM({
      prompt: messagePrompt,
      response_json_schema: {
        type: "object",
        properties: {
          email_subject: { type: "string" },
          message_body: { type: "string" },
          sms_version: { type: "string" }
        }
      }
    });

    if (delivery.customer_email) {
      await base44.integrations.Core.SendEmail({
        to: delivery.customer_email,
        subject: aiMessage.email_subject,
        body: aiMessage.message_body,
        from_name: 'USPS Delivery Confirmation'
      });

      await base44.entities.CustomerCommunication.create({
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        customer_name: delivery.customer_name,
        customer_email: delivery.customer_email,
        communication_type: 'email',
        message_category: 'delivery_confirmed',
        trigger_event: 'delivery_completed',
        message_subject: aiMessage.email_subject,
        message_body: aiMessage.message_body,
        ai_generated: true,
        ai_confidence: 95,
        sent_at: new Date().toISOString(),
        delivered: true
      });
    }

    console.log(`Sent delivery confirmation: ${delivery.tracking_number}`);
  }
}

// Singleton instance
let engineInstance = null;

export function startAutomatedCommunications() {
  if (!engineInstance) {
    engineInstance = new AutomatedCommunicationEngine();
  }
  engineInstance.startMonitoring();
  return engineInstance;
}

export function stopAutomatedCommunications() {
  if (engineInstance) {
    engineInstance.stopMonitoring();
  }
}

export { AutomatedCommunicationEngine };