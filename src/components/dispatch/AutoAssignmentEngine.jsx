import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Auto-assignment engine for dispatcher task allocation
 * Implements load balancing, expertise matching, and priority handling
 */

// Exception type to team mapping
const EXCEPTION_TEAM_MAPPING = {
  customer_unavailable: "customer_service",
  incorrect_address: "route_planning",
  damaged_package: "operations",
  access_issue: "route_planning",
  weather_delay: "operations",
  vehicle_issue: "operations",
  refused_delivery: "customer_service",
  business_closed: "customer_service",
  requires_id: "customer_service",
  other: "operations"
};

// Severity to priority mapping
const SEVERITY_PRIORITY_MAPPING = {
  critical: "emergency",
  high: "urgent",
  medium: "standard",
  low: "standard"
};

/**
 * Calculate dispatcher score for assignment
 * Higher score = better candidate
 */
function calculateDispatcherScore(dispatcher, exception, teamNeeded) {
  let score = 100;

  // Factor 1: Availability (40 points)
  if (dispatcher.status !== "available") {
    score -= 40;
  }

  // Factor 2: Workload (30 points)
  const workloadRatio = dispatcher.current_workload / dispatcher.max_concurrent_assignments;
  score -= workloadRatio * 30;

  // Factor 3: Expertise match (20 points)
  if (dispatcher.primary_team === teamNeeded) {
    score += 20;
  } else if (dispatcher.secondary_teams?.includes(teamNeeded)) {
    score += 10;
  } else {
    score -= 10;
  }

  // Factor 4: Performance rating (10 points)
  score += (dispatcher.performance_rating / 10) * 10;

  // Bonus: Recent activity (balance load)
  if (dispatcher.last_assignment_time) {
    const minutesSinceLastAssignment = 
      (new Date() - new Date(dispatcher.last_assignment_time)) / 1000 / 60;
    if (minutesSinceLastAssignment > 30) {
      score += 5; // Bonus for being idle
    }
  }

  return Math.max(0, score);
}

/**
 * Find best dispatcher for an exception
 */
export async function findBestDispatcher(exception, exceptionType, severity) {
  const teamNeeded = EXCEPTION_TEAM_MAPPING[exceptionType] || "operations";
  
  // Get all dispatchers
  const allDispatchers = await base44.entities.Dispatcher.list();
  
  // Filter available dispatchers
  const availableDispatchers = allDispatchers.filter(d => 
    d.current_workload < d.max_concurrent_assignments &&
    d.status !== "offline"
  );

  if (availableDispatchers.length === 0) {
    // No available dispatchers - assign to team queue
    return {
      dispatcher: null,
      team: teamNeeded,
      reason: "No available dispatchers - assigned to team queue"
    };
  }

  // Calculate scores for all dispatchers
  const scoredDispatchers = availableDispatchers.map(dispatcher => ({
    dispatcher,
    score: calculateDispatcherScore(dispatcher, exception, teamNeeded)
  }));

  // Sort by score (highest first)
  scoredDispatchers.sort((a, b) => b.score - a.score);

  const best = scoredDispatchers[0];

  return {
    dispatcher: best.dispatcher,
    team: teamNeeded,
    score: best.score,
    reason: `Auto-assigned: workload=${best.dispatcher.current_workload}/${best.dispatcher.max_concurrent_assignments}, ` +
            `team match=${best.dispatcher.primary_team === teamNeeded ? 'primary' : 'secondary'}, ` +
            `score=${best.score.toFixed(1)}`
  };
}

/**
 * Auto-assign exception to dispatcher
 */
export async function autoAssignException(exception, delivery) {
  const priority = SEVERITY_PRIORITY_MAPPING[exception.severity] || "standard";
  
  // Find best dispatcher
  const assignment = await findBestDispatcher(
    exception,
    exception.exception_type,
    exception.severity
  );

  const dispatcher = assignment.dispatcher;
  const assignedDispatcherId = dispatcher?.dispatcher_id || `${assignment.team}_queue_${Date.now() % 100}`;
  const assignedDispatcherName = dispatcher?.full_name || `${assignment.team} Team Queue`;
  const assignedDispatcherEmail = dispatcher?.email || `${assignment.team}@dispatch.usps.com`;

  // Update exception with assignment
  await base44.entities.DeliveryException.update(exception.id, {
    assigned_dispatcher: assignedDispatcherId,
    dispatcher_team: assignment.team,
    escalation_priority: priority
  });

  // Create assignment record
  await base44.entities.DispatcherAssignment.create({
    exception_id: exception.id,
    delivery_request_id: delivery.id,
    tracking_number: exception.tracking_number,
    dispatcher_id: assignedDispatcherId,
    dispatcher_name: assignedDispatcherName,
    dispatcher_email: assignedDispatcherEmail,
    team_assigned: assignment.team,
    assignment_method: "auto_assigned",
    assignment_reason: assignment.reason,
    assigned_at: new Date().toISOString(),
    assigned_by: "Auto-Assignment System",
    priority: priority,
    status: "assigned",
    auto_assignment_score: assignment.score
  });

  // Update dispatcher workload if specific dispatcher was assigned
  if (dispatcher) {
    await base44.entities.Dispatcher.update(dispatcher.id, {
      current_workload: (dispatcher.current_workload || 0) + 1,
      last_assignment_time: new Date().toISOString()
    });
  }

  // Send notifications
  await sendAssignmentNotifications(
    dispatcher || { email: assignedDispatcherEmail, full_name: assignedDispatcherName },
    exception,
    delivery,
    priority
  );

  return {
    dispatcher: dispatcher || { dispatcher_id: assignedDispatcherId, full_name: assignedDispatcherName },
    team: assignment.team,
    priority: priority,
    reason: assignment.reason
  };
}

/**
 * Send notifications to assigned dispatcher
 */
async function sendAssignmentNotifications(dispatcher, exception, delivery, priority) {
  const priorityEmoji = {
    emergency: "🚨🚨🚨",
    urgent: "⚠️",
    standard: "📋"
  }[priority];

  // Email notification
  await base44.integrations.Core.SendEmail({
    to: dispatcher.email,
    subject: `${priorityEmoji} New Assignment: ${exception.exception_type.replace(/_/g, ' ')} - ${exception.tracking_number}`,
    body: `Hello ${dispatcher.full_name},

You have been assigned a new exception to resolve:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSIGNMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority: ${priority.toUpperCase()}
Assigned: ${new Date().toLocaleString()}
Assignment Method: Auto-assigned based on workload and expertise

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXCEPTION INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: ${exception.exception_type.replace(/_/g, ' ')}
Severity: ${exception.severity.toUpperCase()}
Tracking: ${exception.tracking_number}

Description:
${exception.description}

${exception.escalation_reason ? `Driver's Escalation Reason:\n${exception.escalation_reason}\n\n` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRIVER & CUSTOMER INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Driver: ${exception.reported_by} (${exception.reported_by_email})
Customer: ${delivery.customer_name}
Address: ${delivery.delivery_address}
Phone: ${delivery.customer_phone || 'Not provided'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please review and take action in the Dispatch Dashboard:
https://app.usps.com/dispatch

This is an automated assignment from the dispatch system.
`,
    from_name: 'USPS Auto-Assignment System'
  });

  // Create in-app notification
  await base44.entities.DispatchNotification.create({
    exception_id: exception.id,
    delivery_request_id: delivery.id,
    tracking_number: exception.tracking_number,
    notification_type: 'dashboard_alert',
    priority: priority === 'emergency' ? 'critical' : priority === 'urgent' ? 'high' : 'medium',
    sent_to: dispatcher.email,
    sent_at: new Date().toISOString(),
    acknowledged: false,
    resolved: false
  });
}

/**
 * Reassign exception to different dispatcher
 */
export async function reassignException(exception, newDispatcherId, reason, reassignedBy) {
  // Get old assignment
  const oldAssignments = await base44.entities.DispatcherAssignment.filter({
    exception_id: exception.id,
    status: ["assigned", "accepted", "in_progress"]
  });

  const oldAssignment = oldAssignments[0];

  if (oldAssignment) {
    // Mark old assignment as reassigned
    await base44.entities.DispatcherAssignment.update(oldAssignment.id, {
      status: "reassigned",
      reassigned_to: newDispatcherId,
      reassignment_reason: reason
    });

    // Decrement old dispatcher's workload
    if (oldAssignment.dispatcher_id) {
      const oldDispatchers = await base44.entities.Dispatcher.filter({
        dispatcher_id: oldAssignment.dispatcher_id
      });
      if (oldDispatchers.length > 0) {
        const oldDispatcher = oldDispatchers[0];
        await base44.entities.Dispatcher.update(oldDispatcher.id, {
          current_workload: Math.max(0, (oldDispatcher.current_workload || 1) - 1)
        });
      }
    }
  }

  // Get new dispatcher
  const newDispatchers = await base44.entities.Dispatcher.filter({
    dispatcher_id: newDispatcherId
  });

  const newDispatcher = newDispatchers[0];

  if (!newDispatcher) {
    throw new Error("Dispatcher not found");
  }

  // Create new assignment
  await base44.entities.DispatcherAssignment.create({
    exception_id: exception.id,
    delivery_request_id: exception.delivery_request_id,
    tracking_number: exception.tracking_number,
    dispatcher_id: newDispatcher.dispatcher_id,
    dispatcher_name: newDispatcher.full_name,
    dispatcher_email: newDispatcher.email,
    team_assigned: newDispatcher.primary_team,
    assignment_method: "reassigned",
    assignment_reason: reason,
    assigned_at: new Date().toISOString(),
    assigned_by: reassignedBy,
    priority: exception.escalation_priority || "standard",
    status: "assigned"
  });

  // Update exception
  await base44.entities.DeliveryException.update(exception.id, {
    assigned_dispatcher: newDispatcher.dispatcher_id,
    dispatcher_team: newDispatcher.primary_team
  });

  // Update new dispatcher workload
  await base44.entities.Dispatcher.update(newDispatcher.id, {
    current_workload: (newDispatcher.current_workload || 0) + 1,
    last_assignment_time: new Date().toISOString()
  });

  // Send notification to new dispatcher
  const delivery = await base44.entities.DeliveryRequest.filter({ id: exception.delivery_request_id });
  if (delivery.length > 0) {
    await sendAssignmentNotifications(
      newDispatcher,
      exception,
      delivery[0],
      exception.escalation_priority || "standard"
    );
  }

  return newDispatcher;
}

/**
 * Mark assignment as resolved and update metrics
 */
export async function resolveAssignment(assignmentId, resolutionNotes) {
  const assignments = await base44.entities.DispatcherAssignment.filter({ id: assignmentId });
  
  if (assignments.length === 0) return;
  
  const assignment = assignments[0];
  const resolvedAt = new Date();
  const assignedAt = new Date(assignment.assigned_at);
  const resolutionTimeMinutes = (resolvedAt - assignedAt) / 1000 / 60;

  // Update assignment
  await base44.entities.DispatcherAssignment.update(assignmentId, {
    status: "resolved",
    resolved_at: resolvedAt.toISOString(),
    resolution_time_minutes: resolutionTimeMinutes,
    dispatcher_notes: resolutionNotes
  });

  // Update dispatcher metrics
  const dispatchers = await base44.entities.Dispatcher.filter({
    dispatcher_id: assignment.dispatcher_id
  });

  if (dispatchers.length > 0) {
    const dispatcher = dispatchers[0];
    const totalAssignments = (dispatcher.total_assignments_handled || 0) + 1;
    const currentAverage = dispatcher.average_resolution_time_minutes || 0;
    const newAverage = ((currentAverage * (totalAssignments - 1)) + resolutionTimeMinutes) / totalAssignments;

    await base44.entities.Dispatcher.update(dispatcher.id, {
      current_workload: Math.max(0, (dispatcher.current_workload || 1) - 1),
      total_assignments_handled: totalAssignments,
      average_resolution_time_minutes: newAverage
    });
  }
}

export default {
  findBestDispatcher,
  autoAssignException,
  reassignException,
  resolveAssignment
};