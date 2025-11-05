
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, AlertTriangle, CheckCircle2, TrendingUp, Award,
  AlertCircle, Zap, ThumbsUp, Calendar, MapPin, Clock
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, subDays, differenceInDays } from "date-fns";

export default function SafetyMonitor({ driverEmail, driverName }) {
  const [safetyScore, setSafetyScore] = useState(100);
  const [recentEvents, setRecentEvents] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [latestReport, setLatestReport] = useState(null);

  useEffect(() => {
    loadSafetyData();
    const interval = setInterval(loadSafetyData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [driverEmail]);

  const loadSafetyData = async () => {
    try {
      // Get recent safety events (last 7 days)
      const events = await base44.entities.DriverSafetyEvent.filter({
        driver_email: driverEmail
      });

      const last7Days = events.filter(e => {
        const eventDate = new Date(e.timestamp);
        const daysAgo = differenceInDays(new Date(), eventDate);
        return daysAgo <= 7;
      }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setRecentEvents(last7Days);

      // Get latest safety report
      const reports = await base44.entities.DriverSafetyReport.filter({
        driver_email: driverEmail
      });

      if (reports.length > 0) {
        const latest = reports.sort((a, b) => 
          new Date(b.generated_at) - new Date(a.generated_at)
        )[0];
        setLatestReport(latest);
        setSafetyScore(latest.overall_safety_score || 100);
        setCurrentStreak(latest.safe_driving_streak_days || 0);
      } else {
        // Generate initial report if none exists
        await generateSafetyReport();
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load safety data:", error);
      setLoading(false);
    }
  };

  const generateSafetyReport = async () => {
    try {
      // Get all safety events for this driver
      const allEvents = await base44.entities.DriverSafetyEvent.filter({
        driver_email: driverEmail
      });

      const last30Days = allEvents.filter(e => {
        const eventDate = new Date(e.timestamp);
        const daysAgo = differenceInDays(new Date(), eventDate);
        return daysAgo <= 30;
      });

      // Get deliveries to calculate miles
      const deliveries = await base44.entities.DeliveryRequest.filter({
        carrier_email: driverEmail,
        status: 'delivered'
      });

      const recentDeliveries = deliveries.filter(d => {
        if (!d.delivery_timestamp) return false;
        const daysAgo = differenceInDays(new Date(), new Date(d.delivery_timestamp));
        return daysAgo <= 30;
      });

      // Calculate metrics
      const totalEvents = last30Days.length;
      const criticalEvents = last30Days.filter(e => e.severity === 'critical').length;
      const highEvents = last30Days.filter(e => e.severity === 'high').length;
      const mediumEvents = last30Days.filter(e => e.severity === 'medium').length;
      const lowEvents = last30Days.filter(e => e.severity === 'low').length;

      // Event breakdown
      const eventBreakdown = {
        harsh_braking: last30Days.filter(e => e.event_type === 'harsh_braking').length,
        rapid_acceleration: last30Days.filter(e => e.event_type === 'rapid_acceleration').length,
        speeding: last30Days.filter(e => e.event_type === 'speeding').length,
        sharp_turn: last30Days.filter(e => e.event_type === 'sharp_turn').length,
        route_deviation: last30Days.filter(e => e.event_type === 'route_deviation').length,
        idling_excessive: last30Days.filter(e => e.event_type === 'idling_excessive').length
      };

      // Calculate safety score (100 - penalties)
      let score = 100;
      score -= criticalEvents * 15;
      score -= highEvents * 10;
      score -= mediumEvents * 5;
      score -= lowEvents * 2;
      score = Math.max(0, Math.min(100, score));

      // Calculate streak
      const sortedEvents = allEvents.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      let streak = 0;
      if (sortedEvents.length === 0 || sortedEvents[0].severity === 'low') {
        const lastEvent = sortedEvents[0];
        if (lastEvent) {
          streak = differenceInDays(new Date(), new Date(lastEvent.timestamp));
        } else {
          streak = 30; // Default to 30 if no events
        }
      }

      // Determine risk level
      let riskLevel = 'low_risk';
      if (criticalEvents > 0 || highEvents > 3) riskLevel = 'critical_risk';
      else if (highEvents > 0 || mediumEvents > 5) riskLevel = 'high_risk';
      else if (mediumEvents > 0 || lowEvents > 10) riskLevel = 'moderate_risk';

      // Generate AI recommendations
      const prompt = `Analyze this driver's safety data and provide specific, actionable safety recommendations.

DRIVER SAFETY PROFILE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Safety Score: ${score}/100
Total Safety Events (30 days): ${totalEvents}
- Critical: ${criticalEvents}
- High: ${highEvents}
- Medium: ${mediumEvents}
- Low: ${lowEvents}

Event Breakdown:
- Harsh Braking: ${eventBreakdown.harsh_braking}
- Rapid Acceleration: ${eventBreakdown.rapid_acceleration}
- Speeding: ${eventBreakdown.speeding}
- Sharp Turns: ${eventBreakdown.sharp_turn}
- Route Deviations: ${eventBreakdown.route_deviation}

Safe Driving Streak: ${streak} days

PROVIDE:
1. Specific strengths (2-3 items)
2. Areas for improvement (2-3 items)
3. Actionable safety recommendations (3-5 items)
4. Recommended training modules (if needed)

Be encouraging, specific, and focused on practical improvements.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            strengths: {
              type: "array",
              items: { type: "string" }
            },
            areas_for_improvement: {
              type: "array",
              items: { type: "string" }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            },
            training_modules: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      // Create safety report
      const report = await base44.entities.DriverSafetyReport.create({
        driver_email: driverEmail,
        driver_name: driverName,
        report_period_start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        report_period_end: format(new Date(), 'yyyy-MM-dd'),
        total_events: totalEvents,
        critical_events: criticalEvents,
        high_severity_events: highEvents,
        medium_severity_events: mediumEvents,
        low_severity_events: lowEvents,
        event_breakdown: eventBreakdown,
        overall_safety_score: score,
        safe_driving_streak_days: streak,
        total_miles_driven: recentDeliveries.length * 5, // Rough estimate
        risk_level: riskLevel,
        strengths: aiResponse.strengths,
        areas_for_improvement: aiResponse.areas_for_improvement,
        ai_recommendations: aiResponse.recommendations,
        training_recommended: aiResponse.training_modules,
        generated_at: new Date().toISOString(),
        management_action_required: riskLevel === 'critical_risk' || riskLevel === 'high_risk'
      });

      setLatestReport(report);
      setSafetyScore(score);
      setCurrentStreak(streak);
    } catch (error) {
      console.error("Failed to generate safety report:", error);
    }
  };

  const acknowledgeEvent = async (eventId) => {
    try {
      await base44.entities.DriverSafetyEvent.update(eventId, {
        driver_acknowledged: true,
        driver_response: "Acknowledged - will be more careful"
      });

      setRecentEvents(recentEvents.map(e => 
        e.id === eventId ? { ...e, driver_acknowledged: true } : e
      ));

      toast.success("Event acknowledged");
    } catch (error) {
      console.error("Failed to acknowledge event:", error);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score) => {
    if (score >= 90) return "bg-green-50 border-green-300";
    if (score >= 75) return "bg-blue-50 border-blue-300";
    if (score >= 60) return "bg-yellow-50 border-yellow-300";
    return "bg-red-50 border-red-300";
  };

  const eventIcons = {
    harsh_braking: AlertTriangle,
    rapid_acceleration: Zap,
    speeding: TrendingUp,
    sharp_turn: AlertCircle,
    route_deviation: MapPin,
    idling_excessive: Clock
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading safety data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Real-time monitoring indicator */}
      <Card className="border-2 border-blue-300 bg-blue-50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-semibold text-blue-900">
              🤖 AI Safety Monitoring Active
            </p>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            Real-time behavior analysis is protecting you and others on the road
          </p>
        </CardContent>
      </Card>

      {/* Safety Score Card */}
      <Card className={`border-2 ${getScoreBgColor(safetyScore)}`}>
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className={`w-12 h-12 mx-auto mb-2 ${getScoreColor(safetyScore)}`} />
            <p className="text-sm font-semibold text-gray-600 mb-2">Safety Score</p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <p className={`text-5xl font-bold ${getScoreColor(safetyScore)}`}>
                {safetyScore.toFixed(0)}
              </p>
              <span className="text-2xl text-gray-500">/100</span>
            </div>
            <Progress value={safetyScore} className="h-3 mb-2" />
            <p className="text-xs text-gray-600">Last 30 days</p>
          </div>
        </CardContent>
      </Card>

      {/* Streak Card */}
      <Card className="border-2 border-green-300 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-700">Safe Driving Streak</p>
              <p className="text-3xl font-bold text-green-900">{currentStreak} days</p>
            </div>
            {currentStreak >= 30 && (
              <ThumbsUp className="w-8 h-8 text-green-600" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Recent Safety Events (Last 7 Days)
          </h3>

          {recentEvents.slice(0, 5).map((event) => {
            const Icon = eventIcons[event.event_type] || AlertTriangle;
            return (
              <Card 
                key={event.id}
                className={`border-2 ${
                  event.severity === 'critical' ? 'border-red-300 bg-red-50' :
                  event.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                  event.severity === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Icon className={`w-6 h-6 ${
                      event.severity === 'critical' ? 'text-red-600' :
                      event.severity === 'high' ? 'text-orange-600' :
                      event.severity === 'medium' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={
                          event.severity === 'critical' ? 'bg-red-600' :
                          event.severity === 'high' ? 'bg-orange-600' :
                          event.severity === 'medium' ? 'bg-yellow-600' :
                          'bg-blue-600'
                        }>
                          {event.severity}
                        </Badge>
                        {event.driver_acknowledged && (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Acknowledged
                          </Badge>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-600 mb-2">
                        {format(new Date(event.timestamp), "MMM d 'at' h:mm a")}
                      </p>

                      {event.speed_over_limit && (
                        <div className="p-2 bg-white rounded border border-red-200 mb-2">
                          <p className="text-xs text-red-900">
                            <strong>Speed:</strong> {event.speed_mph} MPH in {event.speed_limit} MPH zone
                            <span className="font-bold"> ({event.speed_over_limit} over)</span>
                          </p>
                        </div>
                      )}

                      {event.corrective_action_suggested && (
                        <div className="p-2 bg-white rounded border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-1">
                            💡 Safety Tip:
                          </p>
                          <p className="text-xs text-blue-800">{event.corrective_action_suggested}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!event.driver_acknowledged && (
                    <Button
                      onClick={() => acknowledgeEvent(event.id)}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Acknowledge & Improve
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Latest Report Highlights */}
      {latestReport && (
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-purple-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Safety Report Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestReport.strengths && latestReport.strengths.length > 0 && (
              <div>
                <p className="text-sm font-bold text-green-900 mb-2">✅ Your Strengths:</p>
                <ul className="space-y-1">
                  {latestReport.strengths.map((strength, idx) => (
                    <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {latestReport.ai_recommendations && latestReport.ai_recommendations.length > 0 && (
              <div className="p-3 bg-white rounded-lg border border-purple-200">
                <p className="text-sm font-bold text-purple-900 mb-2">🎯 Recommendations:</p>
                <ul className="space-y-1">
                  {latestReport.ai_recommendations.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="text-sm text-purple-800 flex items-start gap-2">
                      <span className="font-bold">{idx + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Events - Celebration */}
      {recentEvents.length === 0 && (
        <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-8 text-center">
            <Award className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <p className="text-xl font-bold text-green-900 mb-2">Perfect Safety Record!</p>
            <p className="text-gray-700">
              No safety events in the last 7 days. Keep up the excellent work!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <Button
        onClick={() => {
          loadSafetyData();
          toast.success("Safety data refreshed");
        }}
        variant="outline"
        className="w-full"
      >
        Refresh Safety Data
      </Button>
    </div>
  );
}
