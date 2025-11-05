
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { differenceInMinutes, format } from "date-fns";

/**
 * AI Operations Monitor
 * Continuously monitors operations and takes proactive actions
 */

class AIOperationsMonitor {
  constructor() {
    this.monitoringInterval = null;
    this.lastCheck = new Date();
    this.isRunning = false;
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log("AI Operations Monitor already running");
      return;
    }

    console.log("🤖 Starting AI Operations Monitor...");
    this.isRunning = true;

    // Initial check
    await this.runMonitoringCycle();

    // Run every 3 minutes
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle();
    }, 180000);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isRunning = false;
      console.log("AI Operations Monitor stopped");
    }
  }

  async runMonitoringCycle() {
    try {
      console.log("🔍 Running AI monitoring cycle...");

      // Run all monitoring checks in parallel
      await Promise.all([
        this.monitorCriticalDelays(),
        this.monitorStuckExceptions(),
        this.monitorDriverOverload(),
        this.autoCreateFollowupTasks(),
        this.monitorRouteDeviations(),
        this.analyzeSimulationPerformance() // NEW
      ]);

      this.lastCheck = new Date();
    } catch (error) {
      console.error("AI monitoring cycle error:", error);
    }
  }

  /**
   * Monitor for critical delays requiring reassignment
   */
  async monitorCriticalDelays() {
    try {
      const activeRoutes = await base44.entities.OptimizedRoute.filter({
        status: ['active', 'in_progress']
      });

      for (const route of activeRoutes) {
        // Check if route is significantly delayed
        if (!route.estimated_completion_time) continue;

        const expectedCompletion = new Date(route.estimated_completion_time);
        const now = new Date();
        const delayMinutes = differenceInMinutes(now, expectedCompletion);

        // If route is >30 minutes behind and still active
        if (delayMinutes > 30) {
          // Check if we already suggested reassignment
          const existingRecommendations = await base44.entities.DispatchAssistantRecommendation.filter({
            related_entity_id: route.id,
            recommendation_type: 'reassign_driver',
            status: 'active',
            created_at: { $gte: new Date(Date.now() - 60 * 60000).toISOString() } // Last hour
          });

          if (existingRecommendations.length > 0) continue;

          // Get remaining deliveries
          const allDeliveries = await base44.entities.DeliveryRequest.list();
          const routeDeliveries = allDeliveries.filter(d => route.delivery_ids.includes(d.id));
          const remaining = routeDeliveries.filter(d => d.status !== 'delivered');

          if (remaining.length < 2) continue; // Not worth reassigning

          // Create reassignment recommendation
          await base44.entities.DispatchAssistantRecommendation.create({
            recommendation_type: 'reassign_driver',
            priority: delayMinutes > 60 ? 'critical' : 'high',
            title: `Route ${delayMinutes}min Behind - Consider Reassignment`,
            summary: `${route.driver_name}'s route is ${delayMinutes} minutes behind schedule with ${remaining.length} deliveries remaining`,
            context: `Route "${route.route_name}" was expected to complete at ${format(expectedCompletion, 'h:mm a')} but is still active. ${remaining.length} deliveries remain undelivered. Consider reassigning some stops to another driver or adjusting delivery windows.`,
            reasoning: `Automated monitoring detected significant delay. Reassigning ${Math.ceil(remaining.length / 2)} deliveries to another driver could help both routes complete on time.`,
            ai_confidence: 85,
            estimated_impact: `Rescue ${remaining.length} deliveries from potential late delivery`,
            related_entity_type: 'route',
            related_entity_id: route.id,
            related_driver_email: route.driver_email,
            quick_action_data: {
              action_type: 'open_reassignment_dialog',
              route_id: route.id,
              deliveries_to_reassign: remaining.slice(Math.ceil(remaining.length / 2)).map(d => d.id)
            },
            status: 'active',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 2 * 60 * 60000).toISOString()
          });

          console.log(`Created reassignment recommendation for ${route.driver_name}`);
        }
      }
    } catch (error) {
      console.error("Error monitoring critical delays:", error);
    }
  }

  /**
   * Monitor for exceptions stuck without resolution
   */
  async monitorStuckExceptions() {
    try {
      const unresolvedExceptions = await base44.entities.DeliveryException.filter({
        resolution_status: ['pending', 'escalated']
      });

      for (const exception of unresolvedExceptions) {
        const minutesSinceReport = differenceInMinutes(new Date(), new Date(exception.timestamp));

        // If exception is >45 minutes old and not escalated
        if (minutesSinceReport > 45 && !exception.escalated) {
          // Check for existing recommendation
          const existingRec = await base44.entities.DispatchAssistantRecommendation.filter({
            related_entity_id: exception.id,
            recommendation_type: 'escalate_exception',
            status: 'active'
          });

          if (existingRec.length > 0) continue;

          // Auto-escalate or create recommendation
          if (exception.severity === 'critical' || minutesSinceReport > 90) {
            // Auto-escalate critical or very old exceptions
            await base44.entities.DeliveryException.update(exception.id, {
              escalated: true,
              escalated_at: new Date().toISOString(),
              escalated_by: 'AI Auto-Escalation',
              escalation_reason: `Exception unresolved after ${minutesSinceReport} minutes. ${exception.severity === 'critical' ? 'Critical severity requires immediate attention.' : 'Extended time without resolution triggers automatic escalation.'}`,
              escalation_priority: exception.severity === 'critical' ? 'emergency' : 'urgent',
              resolution_status: 'escalated',
              dispatcher_team: exception.exception_type === 'customer_unavailable' ? 'customer_service' : 'operations'
            });

            console.log(`Auto-escalated exception: ${exception.tracking_number}`);
          } else {
            // Create recommendation for dispatcher review
            await base44.entities.DispatchAssistantRecommendation.create({
              recommendation_type: 'escalate_exception',
              priority: 'high',
              title: `Exception Unresolved for ${minutesSinceReport} Minutes`,
              summary: `${exception.exception_type.replace(/_/g, ' ')} reported by ${exception.reported_by} needs attention`,
              context: `This exception has been unresolved for ${minutesSinceReport} minutes. Driver: ${exception.reported_by}. Description: ${exception.description}`,
              reasoning: `Extended unresolved time suggests driver may be stuck or needs dispatcher support. Consider escalating or contacting driver.`,
              ai_confidence: 82,
              estimated_impact: 'Prevent further delays and potential customer dissatisfaction',
              related_entity_type: 'exception',
              related_entity_id: exception.id,
              related_driver_email: exception.reported_by_email,
              related_tracking_number: exception.tracking_number,
              status: 'active',
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 2 * 60 * 60000).toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error("Error monitoring stuck exceptions:", error);
    }
  }

  /**
   * Monitor for driver overload situations
   */
  async monitorDriverOverload() {
    try {
      const allDeliveries = await base44.entities.DeliveryRequest.list();
      const allExceptions = await base44.entities.DeliveryException.list();

      // Group by driver
      const driverStats = {};

      allDeliveries.forEach(d => {
        if (!d.carrier_email || d.status === 'delivered') return;

        if (!driverStats[d.carrier_email]) {
          driverStats[d.carrier_email] = {
            email: d.carrier_email,
            name: d.carrier_name,
            active_deliveries: 0,
            exceptions: 0,
            escalated: 0
          };
        }
        driverStats[d.carrier_email].active_deliveries++;
      });

      // Count exceptions per driver
      allExceptions.forEach(e => {
        if (e.resolution_status === 'resolved') return;

        if (driverStats[e.reported_by_email]) {
          driverStats[e.reported_by_email].exceptions++;
          if (e.escalated) driverStats[e.reported_by_email].escalated++;
        }
      });

      // Identify overloaded drivers
      for (const [email, stats] of Object.entries(driverStats)) {
        const isOverloaded = stats.exceptions >= 3 || stats.escalated >= 2 ||
          (stats.active_deliveries > 15 && stats.exceptions >= 2);

        if (!isOverloaded) continue;

        // Check for existing recommendation
        const existingRec = await base44.entities.DispatchAssistantRecommendation.filter({
          related_driver_email: email,
          recommendation_type: 'send_driver_message',
          status: 'active',
          created_at: { $gte: new Date(Date.now() - 60 * 60000).toISOString() }
        });

        if (existingRec.length > 0) continue;

        // Create support recommendation
        await base44.entities.DispatchAssistantRecommendation.create({
          recommendation_type: 'send_driver_message',
          priority: stats.escalated >= 2 ? 'critical' : 'high',
          title: `Driver ${stats.name} May Need Support`,
          summary: `${stats.exceptions} active exceptions, ${stats.escalated} escalated, ${stats.active_deliveries} deliveries pending`,
          context: `Pattern detected: ${stats.name} has ${stats.exceptions} unresolved exceptions (${stats.escalated} escalated) with ${stats.active_deliveries} active deliveries. This suggests potential overload or challenging route conditions.`,
          reasoning: `Multiple exceptions from same driver indicate need for support. Recommend checking in with driver, considering reassignment of some deliveries, or providing guidance.`,
          ai_confidence: 88,
          estimated_impact: 'Prevent further escalations and improve driver morale',
          related_entity_type: 'driver',
          related_driver_email: email,
          quick_action_data: {
            action_type: 'message_driver',
            suggested_message: `Hi ${stats.name}, I noticed you have ${stats.exceptions} active exceptions. Is everything okay? Do you need any support with your route today?`
          },
          status: 'active',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 60 * 60000).toISOString()
        });

        console.log(`Created support recommendation for overloaded driver: ${stats.name}`);
      }
    } catch (error) {
      console.error("Error monitoring driver overload:", error);
    }
  }

  /**
   * Auto-create follow-up tasks for exceptions
   */
  async autoCreateFollowupTasks() {
    try {
      const exceptions = await base44.entities.DeliveryException.filter({
        resolution_status: ['pending', 'escalated']
      });

      for (const exception of exceptions) {
        // Check if tasks already exist for this exception
        const existingTasks = await base44.entities.ExceptionTask.filter({
          exception_id: exception.id
        });

        // Skip if tasks already created
        if (existingTasks.length > 0) continue;

        const minutesSinceReport = differenceInMinutes(new Date(), new Date(exception.timestamp));

        // Auto-create tasks based on exception type and age
        const tasksToCreate = [];

        // Customer unavailable - create callback task
        if (exception.exception_type === 'customer_unavailable' && minutesSinceReport > 30) {
          tasksToCreate.push({
            task_title: `Customer Callback - ${exception.tracking_number}`,
            task_description: `Customer was unavailable for delivery. Contact customer to arrange redelivery or hold at post office.`,
            task_type: 'contact_customer',
            priority: 'normal',
            assigned_team: 'customer_service',
            due_date: new Date(Date.now() + 4 * 60 * 60000).toISOString(), // 4 hours
            estimated_duration: '15 minutes'
          });
        }

        // Address issues - create verification task
        if (exception.exception_type === 'incorrect_address' && minutesSinceReport > 20) {
          tasksToCreate.push({
            task_title: `Verify Address - ${exception.tracking_number}`,
            task_description: `Address issue reported. Verify correct address with customer and update system.`,
            task_type: 'verify_address',
            priority: 'high',
            assigned_team: 'route_planning',
            due_date: new Date(Date.now() + 2 * 60 * 60000).toISOString(), // 2 hours
            estimated_duration: '20 minutes'
          });
        }

        // Access issues - create investigation task
        if (exception.exception_type === 'access_issue' && minutesSinceReport > 30) {
          tasksToCreate.push({
            task_title: `Investigate Access Issue - ${exception.tracking_number}`,
            task_description: `Access issue at delivery location. Investigate and determine alternative delivery method.`,
            task_type: 'investigate',
            priority: 'normal',
            assigned_team: 'operations',
            due_date: new Date(Date.now() + 6 * 60 * 60000).toISOString(), // 6 hours
            estimated_duration: '30 minutes'
          });
        }

        // Escalated exceptions - create high priority task
        if (exception.escalated && existingTasks.filter(t => t.status !== 'completed').length === 0) {
          tasksToCreate.push({
            task_title: `🚨 Resolve Escalated Exception - ${exception.tracking_number}`,
            task_description: `Driver escalated this exception: ${exception.escalation_reason}`,
            task_type: 'investigate',
            priority: 'urgent',
            assigned_team: exception.dispatcher_team || 'emergency',
            due_date: new Date(Date.now() + 1 * 60 * 60000).toISOString(), // 1 hour
            estimated_duration: '45 minutes',
            notes: `Escalation priority: ${exception.escalation_priority}\nDriver: ${exception.reported_by}`
          });
        }

        // Create tasks
        const delivery = await base44.entities.DeliveryRequest.filter({ id: exception.delivery_request_id });
        const deliveryData = delivery[0];

        for (const taskData of tasksToCreate) {
          const created = await base44.entities.ExceptionTask.create({
            exception_id: exception.id,
            delivery_request_id: exception.delivery_request_id,
            tracking_number: exception.tracking_number,
            ...taskData,
            created_by: 'AI Auto-Task System',
            created_at: new Date().toISOString()
          });

          // Send notification to assigned team
          await base44.integrations.Core.SendEmail({
            to: `${taskData.assigned_team}@usps-dispatch.com`,
            subject: `🤖 Auto-Generated Task: ${taskData.task_title}`,
            body: `An AI-generated task has been assigned to ${taskData.assigned_team.replace(/_/g, ' ')} team:

Task: ${taskData.task_title}
Priority: ${taskData.priority.toUpperCase()}
Due: ${format(new Date(taskData.due_date), "MMM d 'at' h:mm a")}

Description: ${taskData.task_description}

Exception Details:
- Type: ${exception.exception_type.replace(/_/g, ' ')}
- Driver: ${exception.reported_by}
- Customer: ${deliveryData?.customer_name}
- Address: ${deliveryData?.delivery_address}

This task was automatically created by the AI Operations Monitor based on exception patterns.

View in Dispatch Dashboard to take action.`,
            from_name: 'AI Task Automation'
          });

          console.log(`Auto-created task: ${taskData.task_title}`);
        }
      }
    } catch (error) {
      console.error("Error auto-creating tasks:", error);
    }
  }

  /**
   * Monitor for route deviations
   */
  async monitorRouteDeviations() {
    try {
      const activeRoutes = await base44.entities.OptimizedRoute.filter({
        status: ['active', 'in_progress']
      });

      for (const route of activeRoutes) {
        // Get actual delivery sequence
        const allDeliveries = await base44.entities.DeliveryRequest.list();
        const routeDeliveries = allDeliveries.filter(d => route.delivery_ids.includes(d.id));
        const deliveredInOrder = routeDeliveries
          .filter(d => d.status === 'delivered')
          .sort((a, b) => new Date(a.delivery_timestamp) - new Date(b.delivery_timestamp));

        if (deliveredInOrder.length < 3) continue; // Need at least 3 to detect pattern

        // Check if deliveries were completed in optimized order
        let outOfSequence = 0;
        deliveredInOrder.forEach((delivery, idx) => {
          const expectedIndex = route.delivery_ids.indexOf(delivery.id);
          if (expectedIndex !== idx) outOfSequence++;
        });

        const deviationRate = (outOfSequence / deliveredInOrder.length) * 100;

        // If >40% out of sequence, driver may have found better route
        if (deviationRate > 40) {
          // Check for existing recommendation
          const existingRec = await base44.entities.DispatchAssistantRecommendation.filter({
            related_entity_id: route.id,
            recommendation_type: 'optimize_route',
            status: 'active'
          });

          if (existingRec.length > 0) continue;

          await base44.entities.DispatchAssistantRecommendation.create({
            recommendation_type: 'send_driver_message',
            priority: 'medium',
            title: `Route Deviation Detected - Driver Insight Opportunity`,
            summary: `${route.driver_name} deviated from optimized sequence - may have local knowledge`,
            context: `Driver completed ${outOfSequence} of ${deliveredInOrder.length} deliveries out of the AI-optimized sequence (${deviationRate.toFixed(0)}% deviation). This could indicate driver found a more efficient route based on local knowledge.`,
            reasoning: `High deviation rate suggests driver expertise. Recommend asking driver for feedback to improve future route optimization.`,
            ai_confidence: 75,
            estimated_impact: 'Improve future route optimization with driver insights',
            related_entity_type: 'route',
            related_entity_id: route.id,
            related_driver_email: route.driver_email,
            quick_action_data: {
              action_type: 'request_feedback',
              message: `Hi ${route.driver_name}, I noticed you took a different sequence than the optimized route today. Did you find a more efficient path? Your local knowledge helps our AI improve!`
            },
            status: 'active',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 4 * 60 * 60000).toISOString()
          });

          console.log(`Created route deviation feedback request for ${route.driver_name}`);
        }
      }
    } catch (error) {
      console.error("Error monitoring route deviations:", error);
    }
  }

  /**
   * Analyze route simulation accuracy and learn from patterns
   */
  async analyzeSimulationPerformance() {
    try {
      // Run detailed analysis once per day (check if already run today)
      const today = format(new Date(), 'yyyy-MM-dd');
      const existingInsights = await base44.entities.RouteOptimizationInsight.filter({
        insight_date: today
      });

      if (existingInsights.length > 0) return; // Already analyzed today

      // Get all simulations from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60000);
      const allSimulations = await base44.entities.RouteSimulation.list();
      const recentSimulations = allSimulations.filter(s =>
        new Date(s.created_at) >= thirtyDaysAgo
      );

      if (recentSimulations.length < 5) return; // Need at least 5 for analysis

      // Separate applied vs not applied
      const appliedSimulations = recentSimulations.filter(s => s.applied_to_actual_route);
      const notAppliedSimulations = recentSimulations.filter(s => !s.applied_to_actual_route);

      // Analyze applied simulations for accuracy
      let accurateSimulations = 0;
      let timeErrors = [];
      let distanceErrors = [];

      for (const sim of appliedSimulations) {
        if (!sim.actual_results) continue;

        const timePredicted = sim.impact_analysis.time_difference_minutes;
        const timeActual = sim.actual_results.actual_time_difference_minutes;
        const timeError = timeActual - timePredicted;
        timeErrors.push(timeError);

        const distPredicted = sim.impact_analysis.distance_difference_miles;
        const distActual = sim.actual_results.actual_distance_difference_miles;
        const distError = distActual - distPredicted;
        distanceErrors.push(distError);

        // Consider accurate if within 10% margin
        const timeAccurate = Math.abs(timeError) <= Math.abs(timePredicted) * 0.1;
        const distAccurate = Math.abs(distError) <= Math.abs(distPredicted) * 0.1;

        if (timeAccurate && distAccurate) accurateSimulations++;
      }

      const predictionAccuracy = appliedSimulations.length > 0
        ? (accurateSimulations / appliedSimulations.length) * 100
        : 0;

      // Calculate average errors
      const avgTimeError = timeErrors.length > 0
        ? timeErrors.reduce((sum, e) => sum + e, 0) / timeErrors.length
        : 0;
      const avgDistError = distanceErrors.length > 0
        ? distanceErrors.reduce((sum, e) => sum + e, 0) / distanceErrors.length
        : 0;

      // Analyze recommendation effectiveness
      const recEffectiveness = {};
      ['strongly_recommend', 'recommend', 'neutral', 'not_recommend', 'strongly_not_recommend'].forEach(rec => {
        const withRec = recentSimulations.filter(s => s.ai_recommendation === rec);
        const applied = withRec.filter(s => s.applied_to_actual_route);
        recEffectiveness[rec] = withRec.length > 0 ? (applied.length / withRec.length) * 100 : 0;
      });

      // Pattern detection with AI
      const patternPrompt = `Analyze route simulation patterns to improve optimization algorithm.

SIMULATION DATA (Last 30 Days):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Simulations: ${recentSimulations.length}
Applied: ${appliedSimulations.length} (${((appliedSimulations.length / recentSimulations.length) * 100).toFixed(1)}%)
Not Applied: ${notAppliedSimulations.length}

PREDICTION ACCURACY:
Accurate Predictions: ${accurateSimulations}/${appliedSimulations.length} (${predictionAccuracy.toFixed(1)}%)
Average Time Estimation Error: ${avgTimeError.toFixed(1)} minutes ${avgTimeError > 0 ? '(underestimating)' : '(overestimating)'}
Average Distance Error: ${avgDistError.toFixed(2)} miles ${avgDistError > 0 ? '(underestimating)' : '(overestimating)'}

SIMULATION TYPES BREAKDOWN:
${Object.entries(recentSimulations.reduce((acc, s) => {
        acc[s.simulation_type] = (acc[s.simulation_type] || 0) + 1;
        return acc;
      }, {})).map(([type, count]) => {
        const applied = appliedSimulations.filter(s => s.simulation_type === type).length;
        return `- ${type}: ${count} simulations, ${applied} applied (${((applied / count) * 100).toFixed(0)}%)`;
      }).join('\n')}

RECOMMENDATION EFFECTIVENESS:
- Strongly Recommend: ${recEffectiveness.strongly_recommend?.toFixed(1)}% applied
- Recommend: ${recEffectiveness.recommend?.toFixed(1)}% applied
- Neutral: ${recEffectiveness.neutral?.toFixed(1)}% applied
- Not Recommend: ${recEffectiveness.not_recommend?.toFixed(1)}% applied

APPLIED SIMULATIONS ANALYSIS:
${appliedSimulations.slice(0, 10).map(s => `
Type: ${s.simulation_type}
Predicted Impact: ${s.impact_analysis.time_difference_minutes}min, ${s.impact_analysis.distance_difference_miles}mi
AI Recommendation: ${s.ai_recommendation}
AI Confidence: ${s.ai_confidence}%
${s.actual_results ? `Actual Impact: ${s.actual_results.actual_time_difference_minutes}min, ${s.actual_results.actual_distance_difference_miles}mi` : 'No actual results recorded'}
`).join('\n')}

REJECTED SIMULATIONS (Why weren't they applied?):
${notAppliedSimulations.slice(0, 5).map(s => `
Type: ${s.simulation_type}
AI Recommendation: ${s.ai_recommendation}
Confidence: ${s.ai_confidence}%
Predicted: ${s.impact_analysis.time_difference_minutes}min saved
Pros: ${s.pros?.length || 0} identified
Cons: ${s.cons?.length || 0} identified
Risks: ${s.risk_factors?.length || 0} identified
`).join('\n')}

COMPREHENSIVE ANALYSIS REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PATTERN IDENTIFICATION:
   - Which simulation types are most successful?
   - What characteristics lead to dispatcher acceptance?
   - What causes dispatchers to reject simulations?
   - Are there systematic biases in predictions?

2. PREDICTION ACCURACY:
   - Is AI consistently over/underestimating impacts?
   - Which factors are hardest to predict accurately?
   - How can prediction models be improved?

3. RECOMMENDATION CALIBRATION:
   - Are recommendations too conservative or aggressive?
   - Should confidence thresholds be adjusted?
   - What confidence level correlates with acceptance?

4. ALGORITHM IMPROVEMENTS:
   - Specific parameter adjustments needed
   - New factors to consider
   - Better ways to estimate time/distance
   - Improved risk assessment

5. ACTIONABLE RECOMMENDATIONS:
   - Specific changes to implement
   - Priority order of improvements
   - Expected impact of each change

Provide data-driven, specific recommendations with clear reasoning.`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: patternPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            patterns_identified: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pattern_type: { type: "string" },
                  description: { type: "string" },
                  frequency: { type: "number" },
                  success_rate: { type: "number" },
                  recommendation: { type: "string" }
                }
              }
            },
            successful_characteristics: {
              type: "object",
              properties: {
                common_modification_types: { type: "array", items: { type: "string" } },
                average_time_saved: { type: "number" },
                average_distance_saved: { type: "number" },
                high_confidence_threshold: { type: "number" },
                dispatcher_acceptance_factors: { type: "array", items: { type: "string" } }
              }
            },
            unsuccessful_characteristics: {
              type: "object",
              properties: {
                common_rejection_reasons: { type: "array", items: { type: "string" } },
                prediction_errors: { type: "array", items: { type: "string" } },
                overestimated_benefits: { type: "boolean" },
                underestimated_risks: { type: "boolean" }
              }
            },
            algorithm_adjustments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  adjustment_type: { type: "string" },
                  current_value: { type: "number" },
                  recommended_value: { type: "number" },
                  reason: { type: "string" },
                  expected_improvement: { type: "string" }
                }
              }
            },
            time_estimation_analysis: {
              type: "object",
              properties: {
                average_error_minutes: { type: "number" },
                tends_to_overestimate: { type: "boolean" },
                tends_to_underestimate: { type: "boolean" },
                correction_factor: { type: "number" }
              }
            },
            distance_estimation_analysis: {
              type: "object",
              properties: {
                average_error_miles: { type: "number" },
                tends_to_overestimate: { type: "boolean" },
                tends_to_underestimate: { type: "boolean" },
                correction_factor: { type: "number" }
              }
            },
            recommendation_calibration: {
              type: "object",
              properties: {
                strongly_recommend_acceptance_rate: { type: "number" },
                recommend_acceptance_rate: { type: "number" },
                neutral_acceptance_rate: { type: "number" },
                calibration_needed: { type: "boolean" },
                suggested_confidence_thresholds: {
                  type: "object",
                  properties: {
                    strongly_recommend_min: { type: "number" },
                    recommend_min: { type: "number" },
                    neutral_range: { type: "string" }
                  }
                }
              }
            },
            key_learnings: {
              type: "array",
              items: { type: "string" }
            },
            actionable_improvements: {
              type: "array",
              items: { type: "string" }
            },
            traffic_prediction_insights: {
              type: "string"
            }
          }
        }
      });

      // Save insights
      await base44.entities.RouteOptimizationInsight.create({
        insight_date: today,
        analysis_period_start: format(thirtyDaysAgo, 'yyyy-MM-dd'),
        analysis_period_end: today,
        total_simulations_analyzed: recentSimulations.length,
        applied_simulations: appliedSimulations.length,
        successful_predictions: accurateSimulations,
        prediction_accuracy_rate: predictionAccuracy,
        patterns_identified: aiAnalysis.patterns_identified,
        successful_simulation_characteristics: aiAnalysis.successful_characteristics,
        unsuccessful_simulation_characteristics: aiAnalysis.unsuccessful_characteristics,
        algorithm_adjustments_recommended: aiAnalysis.algorithm_adjustments,
        time_estimation_bias: aiAnalysis.time_estimation_analysis,
        distance_estimation_bias: aiAnalysis.distance_estimation_analysis,
        traffic_impact_accuracy: 0, // Would calculate from actual data
        recommendation_effectiveness: aiAnalysis.recommendation_calibration,
        key_learnings: aiAnalysis.key_learnings,
        actionable_improvements: aiAnalysis.actionable_improvements,
        generated_at: new Date().toISOString(),
        implemented: false
      });

      console.log(`✅ Route optimization insights generated: ${predictionAccuracy.toFixed(1)}% accuracy`);

    } catch (error) {
      console.error("Error analyzing simulation performance:", error);
    }
  }

  /**
   * Generate end-of-day summary
   */
  static async generateDailySummary(date = new Date()) {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      // Gather all data
      const allDeliveries = await base44.entities.DeliveryRequest.list();
      const todayDeliveries = allDeliveries.filter(d => {
        const createdDate = new Date(d.created_date);
        return createdDate >= startOfDay && createdDate <= endOfDay;
      });

      const allExceptions = await base44.entities.DeliveryException.list();
      const todayExceptions = allExceptions.filter(e => {
        const exceptionDate = new Date(e.timestamp);
        return exceptionDate >= startOfDay && exceptionDate <= endOfDay;
      });

      const allRoutes = await base44.entities.OptimizedRoute.list();
      const todayRoutes = allRoutes.filter(r => {
        const routeDate = new Date(r.created_at);
        return routeDate >= startOfDay && routeDate <= endOfDay;
      });

      const allFeedback = await base44.entities.CustomerFeedback.list();
      const todayFeedback = allFeedback.filter(f => {
        const feedbackDate = new Date(f.submitted_at);
        return feedbackDate >= startOfDay && feedbackDate <= endOfDay;
      });

      const allRecommendations = await base44.entities.DispatchAssistantRecommendation.list();
      const todayRecommendations = allRecommendations.filter(r => {
        const recDate = new Date(r.created_at);
        return recDate >= startOfDay && recDate <= endOfDay;
      });

      const allSafetyEvents = await base44.entities.DriverSafetyEvent.list();
      const todaySafetyEvents = allSafetyEvents.filter(e => {
        const eventDate = new Date(e.timestamp);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });

      // Calculate metrics
      const successfulDeliveries = todayDeliveries.filter(d => d.status === 'delivered').length;
      const criticalExceptions = todayExceptions.filter(e => e.severity === 'critical').length;
      const escalatedExceptions = todayExceptions.filter(e => e.escalated).length;

      // Get unique active drivers
      const activeDrivers = new Set(todayDeliveries.map(d => d.carrier_email).filter(Boolean)).size;

      // Calculate average route efficiency
      const completedRoutes = todayRoutes.filter(r => r.status === 'completed' && r.efficiency_score);
      const avgEfficiency = completedRoutes.length > 0
        ? completedRoutes.reduce((sum, r) => sum + r.efficiency_score, 0) / completedRoutes.length
        : 0;

      // Top performers
      const driverPerformance = {};
      todayDeliveries.forEach(d => {
        if (!d.carrier_email || d.status !== 'delivered') return;
        if (!driverPerformance[d.carrier_email]) {
          driverPerformance[d.carrier_email] = {
            driver_email: d.carrier_email,
            driver_name: d.carrier_name,
            deliveries_completed: 0,
            exceptions: 0
          };
        }
        driverPerformance[d.carrier_email].deliveries_completed++;
      });

      todayExceptions.forEach(e => {
        if (driverPerformance[e.reported_by_email]) {
          driverPerformance[e.reported_by_email].exceptions++;
        }
      });

      const topPerformers = Object.values(driverPerformance)
        .map(d => ({
          ...d,
          performance_score: d.deliveries_completed * 10 - d.exceptions * 15
        }))
        .sort((a, b) => b.performance_score - a.performance_score)
        .slice(0, 5);

      // Drivers needing support
      const driversNeedingSupport = Object.values(driverPerformance)
        .filter(d => d.exceptions >= 2)
        .map(d => ({
          driver_email: d.driver_email,
          driver_name: d.driver_name,
          issue: `${d.exceptions} exceptions reported`,
          exception_count: d.exceptions
        }));

      // Exception patterns
      const exceptionPatterns = {};
      todayExceptions.forEach(e => {
        if (!exceptionPatterns[e.exception_type]) {
          exceptionPatterns[e.exception_type] = {
            exception_type: e.exception_type,
            count: 0,
            locations: []
          };
        }
        exceptionPatterns[e.exception_type].count++;
        if (e.location) exceptionPatterns[e.exception_type].locations.push(e.location);
      });

      const patternArray = Object.values(exceptionPatterns)
        .map(p => ({
          exception_type: p.exception_type,
          count: p.count,
          trend: 'analyzing', // Would compare to previous days
          common_locations: p.locations.slice(0, 3)
        }))
        .sort((a, b) => b.count - a.count);

      // Customer satisfaction
      const avgSatisfaction = todayFeedback.length > 0
        ? (todayFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / todayFeedback.length) * 20 // Convert to 100 scale
        : 0;

      // AI insights generation
      const insightsPrompt = `Generate key operational insights from today's delivery data.

DAILY METRICS:
- Total Deliveries: ${todayDeliveries.length}
- Successful: ${successfulDeliveries}
- Success Rate: ${((successfulDeliveries / todayDeliveries.length) * 100).toFixed(1)}%
- Total Exceptions: ${todayExceptions.length}
- Critical Exceptions: ${criticalExceptions}
- Escalated: ${escalatedExceptions}
- Active Drivers: ${activeDrivers}
- Routes Created: ${todayRoutes.length}
- Average Route Efficiency: ${avgEfficiency.toFixed(1)}%
- Customer Satisfaction: ${avgSatisfaction.toFixed(1)}/100
- Safety Events: ${todaySafetyEvents.length}
- Critical Safety Events: ${todaySafetyEvents.filter(e => e.severity === 'critical').length}

TOP EXCEPTION TYPES:
${patternArray.slice(0, 5).map(p => `- ${p.exception_type}: ${p.count} occurrences`).join('\n')}

DRIVERS NEEDING SUPPORT: ${driversNeedingSupport.length}

Provide:
1. 3-5 key insights from today (What went well? What needs attention?)
2. Potential issues for tomorrow (Based on patterns)
3. 3 recommended actions for tomorrow
4. Brief weather/traffic impact summary (use general knowledge)`;

      const aiInsights = await base44.integrations.Core.InvokeLLM({
        prompt: insightsPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            key_insights: {
              type: "array",
              items: { type: "string" }
            },
            potential_issues_tomorrow: {
              type: "array",
              items: { type: "string" }
            },
            recommended_actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  reason: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            weather_impact_summary: { type: "string" },
            traffic_impact_summary: { type: "string" }
          }
        }
      });

      // Create daily summary
      const summary = await base44.entities.DailyOperationsSummary.create({
        summary_date: dateStr,
        generated_at: new Date().toISOString(),
        total_deliveries: todayDeliveries.length,
        successful_deliveries: successfulDeliveries,
        total_exceptions: todayExceptions.length,
        critical_exceptions: criticalExceptions,
        escalated_exceptions: escalatedExceptions,
        active_drivers: activeDrivers,
        routes_optimized: todayRoutes.length,
        average_route_efficiency: avgEfficiency,
        top_performing_drivers: topPerformers,
        drivers_needing_support: driversNeedingSupport,
        exception_patterns: patternArray,
        route_modifications: todayRecommendations.filter(r => r.recommendation_type === 'optimize_route').length,
        ai_recommendations_generated: todayRecommendations.length,
        ai_recommendations_actioned: todayRecommendations.filter(r => r.status === 'actioned').length,
        customer_satisfaction_average: avgSatisfaction,
        safety_events: todaySafetyEvents.length,
        critical_safety_events: todaySafetyEvents.filter(e => e.severity === 'critical').length,
        key_insights: aiInsights.key_insights,
        potential_issues_tomorrow: aiInsights.potential_issues_tomorrow,
        recommended_actions: aiInsights.recommended_actions,
        weather_impact_summary: aiInsights.weather_impact_summary,
        traffic_impact_summary: aiInsights.traffic_impact_summary
      });

      console.log("✅ Daily operations summary generated");
      return summary;

    } catch (error) {
      console.error("Error generating daily summary:", error);
      throw error;
    }
  }
}

// Singleton instance
let monitorInstance = null;

export function startAIMonitoring() {
  if (!monitorInstance) {
    monitorInstance = new AIOperationsMonitor();
  }
  monitorInstance.startMonitoring();
  return monitorInstance;
}

export function stopAIMonitoring() {
  if (monitorInstance) {
    monitorInstance.stopMonitoring();
  }
}

export { AIOperationsMonitor };
