import { base44 } from "@/api/base44Client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

/**
 * Gamification Manager
 * Handles automated badge awards, points calculation, and leaderboard updates
 */

class GamificationManager {
  constructor() {
    this.checkInterval = null;
  }

  async startAutomatedChecks() {
    console.log("🎮 Starting Gamification Manager...");

    // Initial check
    await this.runGamificationCycle();

    // Run every hour
    this.checkInterval = setInterval(() => {
      this.runGamificationCycle();
    }, 3600000);
  }

  stopAutomatedChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async runGamificationCycle() {
    try {
      await Promise.all([
        this.checkAndAwardBadges(),
        this.updateLeaderboards(),
        this.awardDailyPoints()
      ]);
    } catch (error) {
      console.error("Gamification cycle error:", error);
    }
  }

  /**
   * Check and award badges based on performance
   */
  async checkAndAwardBadges() {
    try {
      const allDrivers = await base44.entities.DeliveryRequest.list();
      const uniqueDrivers = [...new Set(allDrivers.map(d => d.carrier_email).filter(Boolean))];

      for (const driverEmail of uniqueDrivers) {
        const driverDeliveries = allDrivers.filter(d => d.carrier_email === driverEmail);
        const driverName = driverDeliveries[0]?.carrier_name;
        if (!driverName) continue;

        // Get driver's existing badges
        const existingBadges = await base44.entities.DriverBadge.filter({
          driver_email: driverEmail
        });
        const earnedBadgeIds = new Set(existingBadges.map(b => b.badge_id));

        // Check various badge criteria
        await this.checkDeliveryMilestoneBadges(driverEmail, driverName, driverDeliveries, earnedBadgeIds);
        await this.checkPerfectWeekBadge(driverEmail, driverName, earnedBadgeIds);
        await this.checkCustomerServiceBadges(driverEmail, driverName, earnedBadgeIds);
        await this.checkSafetyBadges(driverEmail, driverName, earnedBadgeIds);
      }
    } catch (error) {
      console.error("Badge award error:", error);
    }
  }

  async checkDeliveryMilestoneBadges(driverEmail, driverName, deliveries, earnedBadgeIds) {
    const totalDelivered = deliveries.filter(d => d.status === 'delivered').length;

    const milestones = [
      { count: 10, id: 'first-10', name: 'Getting Started', tier: 'bronze', emoji: '📦', points: 100 },
      { count: 50, id: 'fifty-club', name: '50 Deliveries Club', tier: 'silver', emoji: '🚀', points: 250 },
      { count: 100, id: 'century', name: 'Century Maker', tier: 'gold', emoji: '💯', points: 500 },
      { count: 500, id: 'veteran', name: 'Delivery Veteran', tier: 'platinum', emoji: '⭐', points: 1000 },
      { count: 1000, id: 'legend', name: 'Delivery Legend', tier: 'diamond', emoji: '👑', points: 2500 }
    ];

    for (const milestone of milestones) {
      if (totalDelivered >= milestone.count && !earnedBadgeIds.has(milestone.id)) {
        await this.awardBadge(driverEmail, driverName, {
          badge_id: milestone.id,
          badge_name: milestone.name,
          badge_category: 'milestone',
          badge_tier: milestone.tier,
          icon_emoji: milestone.emoji,
          description: `Completed ${milestone.count} deliveries`,
          points_awarded: milestone.points
        });
      }
    }
  }

  async checkPerfectWeekBadge(driverEmail, driverName, earnedBadgeIds) {
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());

    const exceptions = await base44.entities.DeliveryException.filter({
      reported_by_email: driverEmail
    });

    const weekExceptions = exceptions.filter(e => {
      const exDate = new Date(e.timestamp);
      return exDate >= weekStart && exDate <= weekEnd;
    });

    const badgeId = `perfect-week-${format(weekStart, 'yyyy-MM-dd')}`;

    if (weekExceptions.length === 0 && !earnedBadgeIds.has(badgeId)) {
      const deliveries = await base44.entities.DeliveryRequest.filter({
        carrier_email: driverEmail,
        status: 'delivered'
      });

      const weekDeliveries = deliveries.filter(d => {
        if (!d.delivery_timestamp) return false;
        const delDate = new Date(d.delivery_timestamp);
        return delDate >= weekStart && delDate <= weekEnd;
      });

      // Only award if at least 10 deliveries
      if (weekDeliveries.length >= 10) {
        await this.awardBadge(driverEmail, driverName, {
          badge_id: badgeId,
          badge_name: 'Perfect Week',
          badge_category: 'consistency',
          badge_tier: 'gold',
          icon_emoji: '🌟',
          description: `No exceptions for entire week (${weekDeliveries.length} deliveries)`,
          points_awarded: 500,
          is_rare: true,
          rarity_percentage: 15
        });
      }
    }
  }

  async checkCustomerServiceBadges(driverEmail, driverName, earnedBadgeIds) {
    const feedback = await base44.entities.CustomerFeedback.filter({
      related_driver_email: driverEmail
    });

    const recentFeedback = feedback.filter(f => {
      const days = (new Date() - new Date(f.submitted_at)) / (1000 * 60 * 60 * 24);
      return days <= 30;
    });

    if (recentFeedback.length >= 5) {
      const avgRating = recentFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / recentFeedback.length;

      if (avgRating >= 4.8 && !earnedBadgeIds.has('customer-champion')) {
        await this.awardBadge(driverEmail, driverName, {
          badge_id: 'customer-champion',
          badge_name: 'Customer Champion',
          badge_category: 'customer_service',
          badge_tier: 'platinum',
          icon_emoji: '💎',
          description: 'Maintained 4.8+ star rating over 30 days',
          points_awarded: 1000,
          is_rare: true,
          rarity_percentage: 10
        });
      }
    }
  }

  async checkSafetyBadges(driverEmail, driverName, earnedBadgeIds) {
    const safetyEvents = await base44.entities.DriverSafetyEvent.filter({
      driver_email: driverEmail
    });

    const last30Days = safetyEvents.filter(e => {
      const days = (new Date() - new Date(e.timestamp)) / (1000 * 60 * 60 * 24);
      return days <= 30;
    });

    const badgeId = `safety-star-${format(new Date(), 'yyyy-MM')}`;

    if (last30Days.length === 0 && !earnedBadgeIds.has(badgeId)) {
      await this.awardBadge(driverEmail, driverName, {
        badge_id: badgeId,
        badge_name: 'Safety Star',
        badge_category: 'safety',
        badge_tier: 'gold',
        icon_emoji: '🛡️',
        description: '30 days with zero safety events',
        points_awarded: 300
      });
    }
  }

  async awardBadge(driverEmail, driverName, badgeData) {
    // Award the badge
    await base44.entities.DriverBadge.create({
      driver_email: driverEmail,
      driver_name: driverName,
      ...badgeData,
      earned_at: new Date().toISOString()
    });

    // Award points
    if (badgeData.points_awarded > 0) {
      const allPoints = await base44.entities.DriverPoints.filter({
        driver_email: driverEmail
      });
      const currentBalance = allPoints.length > 0 
        ? allPoints.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))[0].current_balance || 0
        : 0;

      await base44.entities.DriverPoints.create({
        driver_email: driverEmail,
        driver_name: driverName,
        points_earned: badgeData.points_awarded,
        current_balance: currentBalance + badgeData.points_awarded,
        source_type: 'badge_earned',
        source_description: `Badge Earned: ${badgeData.badge_name}`,
        earned_at: new Date().toISOString()
      });
    }

    // Notify driver
    await base44.entities.PushNotification.create({
      driver_email: driverEmail,
      driver_name: driverName,
      notification_type: 'system_critical',
      priority: 'high',
      title: `🏆 Badge Unlocked: ${badgeData.badge_name}!`,
      message: `Congratulations! You've earned the ${badgeData.badge_tier} "${badgeData.badge_name}" badge. +${badgeData.points_awarded} points!`,
      action_required: false,
      action_url: 'performance',
      sent_at: new Date().toISOString(),
      sent_by: 'Gamification System'
    });

    console.log(`Awarded badge "${badgeData.badge_name}" to ${driverName}`);
  }

  /**
   * Update leaderboards for all metrics
   */
  async updateLeaderboards() {
    try {
      const periods = ['daily', 'weekly', 'monthly'];
      const metrics = ['overall_performance', 'customer_satisfaction', 'route_efficiency', 'safety_score', 'total_points'];

      for (const period of periods) {
        for (const metric of metrics) {
          await this.generateLeaderboard(period, metric);
        }
      }
    } catch (error) {
      console.error("Leaderboard update error:", error);
    }
  }

  async generateLeaderboard(periodType, metricType) {
    try {
      let periodStart, periodEnd;
      const now = new Date();

      switch (periodType) {
        case 'daily':
          periodStart = new Date(now.setHours(0, 0, 0, 0));
          periodEnd = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'weekly':
          periodStart = startOfWeek(now);
          periodEnd = endOfWeek(now);
          break;
        case 'monthly':
          periodStart = startOfMonth(now);
          periodEnd = endOfMonth(now);
          break;
      }

      // Get all drivers' metrics
      const allMetrics = await base44.entities.DriverPerformanceMetrics.list();
      const allPoints = await base44.entities.DriverPoints.list();
      const allBadges = await base44.entities.DriverBadge.list();

      // Group by driver
      const driverScores = {};

      allMetrics.forEach(m => {
        if (!driverScores[m.driver_email]) {
          driverScores[m.driver_email] = {
            driver_email: m.driver_email,
            driver_name: m.driver_name,
            overall_performance: 0,
            customer_satisfaction: 0,
            route_efficiency: 0,
            safety_score: 0,
            total_points: 0,
            badge_count: 0
          };
        }

        // Use most recent metrics
        driverScores[m.driver_email].overall_performance = Math.max(
          driverScores[m.driver_email].overall_performance,
          m.overall_performance_score || 0
        );
        driverScores[m.driver_email].customer_satisfaction = Math.max(
          driverScores[m.driver_email].customer_satisfaction,
          m.customer_satisfaction_score || 0
        );
        driverScores[m.driver_email].route_efficiency = Math.max(
          driverScores[m.driver_email].route_efficiency,
          m.route_efficiency_score || 0
        );
        driverScores[m.driver_email].safety_score = Math.max(
          driverScores[m.driver_email].safety_score,
          m.safe_driving_score || 0
        );
      });

      // Add points
      allPoints.forEach(p => {
        if (driverScores[p.driver_email]) {
          // Sum up current balance from latest transaction
          driverScores[p.driver_email].total_points = p.current_balance || 0;
        }
      });

      // Add badge counts
      allBadges.forEach(b => {
        if (driverScores[b.driver_email]) {
          driverScores[b.driver_email].badge_count++;
        }
      });

      // Sort by selected metric
      const sortedDrivers = Object.values(driverScores).sort((a, b) => {
        return b[metricType] - a[metricType];
      });

      // Create rankings
      const rankings = sortedDrivers.map((driver, index) => ({
        rank: index + 1,
        driver_email: driver.driver_email,
        driver_name: driver.driver_name,
        score: driver[metricType],
        metric_value: driver[metricType],
        badge_count: driver.badge_count,
        total_points: driver.total_points,
        rank_change: 0 // Would calculate from previous leaderboard
      }));

      // Save leaderboard
      await base44.entities.PerformanceLeaderboard.create({
        period_type: periodType,
        period_start: format(periodStart, 'yyyy-MM-dd'),
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        metric_type: metricType,
        rankings: rankings,
        total_drivers: rankings.length,
        generated_at: new Date().toISOString(),
        next_update_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
      });

      console.log(`Updated ${periodType} ${metricType} leaderboard`);

    } catch (error) {
      console.error(`Failed to generate leaderboard:`, error);
    }
  }

  /**
   * Award daily points for completed deliveries
   */
  async awardDailyPoints() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const allDeliveries = await base44.entities.DeliveryRequest.list();

      // Group by driver
      const driverDeliveries = {};

      allDeliveries.forEach(d => {
        if (!d.carrier_email || !d.delivery_timestamp) return;
        
        const delDate = format(new Date(d.delivery_timestamp), 'yyyy-MM-dd');
        if (delDate !== today) return;

        if (!driverDeliveries[d.carrier_email]) {
          driverDeliveries[d.carrier_email] = {
            email: d.carrier_email,
            name: d.carrier_name,
            deliveries: []
          };
        }
        driverDeliveries[d.carrier_email].deliveries.push(d);
      });

      // Award points for each driver
      for (const [email, data] of Object.entries(driverDeliveries)) {
        // Check if already awarded today
        const existingPoints = await base44.entities.DriverPoints.filter({
          driver_email: email,
          source_type: 'delivery_completion',
          source_description: `Daily deliveries - ${today}`
        });

        if (existingPoints.length > 0) continue;

        // Calculate points
        let basePoints = data.deliveries.length * 10; // 10 points per delivery
        const premiumDeliveries = data.deliveries.filter(d => d.has_premium_insurance).length;
        const premiumBonus = premiumDeliveries * 15; // Extra 15 points for premium

        const totalPoints = basePoints + premiumBonus;

        // Get current balance
        const allPoints = await base44.entities.DriverPoints.filter({
          driver_email: email
        });
        const currentBalance = allPoints.length > 0 
          ? allPoints.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))[0].current_balance || 0
          : 0;

        await base44.entities.DriverPoints.create({
          driver_email: email,
          driver_name: data.name,
          points_earned: totalPoints,
          current_balance: currentBalance + totalPoints,
          source_type: 'delivery_completion',
          source_description: `Daily deliveries - ${today} (${data.deliveries.length} packages${premiumDeliveries > 0 ? `, ${premiumDeliveries} premium` : ''})`,
          earned_at: new Date().toISOString()
        });

        console.log(`Awarded ${totalPoints} points to ${data.name} for ${data.deliveries.length} deliveries`);
      }
    } catch (error) {
      console.error("Daily points award error:", error);
    }
  }
}

// Singleton
let gamificationInstance = null;

export function startGamificationManager() {
  if (!gamificationInstance) {
    gamificationInstance = new GamificationManager();
  }
  gamificationInstance.startAutomatedChecks();
  return gamificationInstance;
}

export function stopGamificationManager() {
  if (gamificationInstance) {
    gamificationInstance.stopAutomatedChecks();
  }
}

export { GamificationManager };