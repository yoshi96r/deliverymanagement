import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Navigation,
  Award, Target, Zap, ThumbsUp, ThumbsDown, Lightbulb, Star
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

export default function PerformanceCoaching({ driverEmail, driverName }) {
  const [metrics, setMetrics] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadPerformanceData();
  }, [driverEmail]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      // Get latest metrics
      const metricsData = await base44.entities.DriverPerformanceMetrics.filter({
        driver_email: driverEmail
      });
      
      if (metricsData.length > 0) {
        setMetrics(metricsData[0]);
      } else {
        // Generate metrics if none exist
        await generateMetrics();
      }

      // Get coaching insights
      const insightsData = await base44.entities.DriverCoachingInsight.filter({
        driver_email: driverEmail
      });
      setInsights(insightsData.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ));
    } catch (error) {
      console.error("Failed to load performance data:", error);
    }
    setLoading(false);
  };

  const generateMetrics = async () => {
    setGenerating(true);
    try {
      // Get deliveries and exceptions for this driver
      const allDeliveries = await base44.entities.DeliveryRequest.filter({
        carrier_email: driverEmail
      });

      const allExceptions = await base44.entities.DeliveryException.filter({
        reported_by_email: driverEmail
      });

      const allRoutes = await base44.entities.OptimizedRoute.filter({
        driver_email: driverEmail,
        status: 'completed'
      });

      // Calculate metrics
      const deliveredPackages = allDeliveries.filter(d => d.status === 'delivered');
      const totalDeliveries = deliveredPackages.length;
      const totalExceptions = allExceptions.length;
      const escalatedExceptions = allExceptions.filter(e => e.escalated).length;
      
      const exceptionRate = totalDeliveries > 0 
        ? (totalExceptions / totalDeliveries) * 100 
        : 0;

      // Calculate on-time rate (packages with photo proof)
      const withProof = deliveredPackages.filter(d => d.delivery_proof_photo_url).length;
      const photoProofRate = totalDeliveries > 0 
        ? (withProof / totalDeliveries) * 100 
        : 0;

      // Calculate route efficiency
      let totalEfficiency = 0;
      allRoutes.forEach(route => {
        if (route.actual_completion_time_minutes && route.total_estimated_time_minutes) {
          const efficiency = Math.min(100, 
            (route.total_estimated_time_minutes / route.actual_completion_time_minutes) * 100
          );
          totalEfficiency += efficiency;
        }
      });
      const routeEfficiency = allRoutes.length > 0 
        ? totalEfficiency / allRoutes.length 
        : 0;

      // Calculate safe driving score based on various factors
      const safeDrivingScore = calculateSafeDrivingScore(
        exceptionRate,
        routeEfficiency,
        escalatedExceptions,
        totalDeliveries
      );

      // Calculate overall performance score
      const overallScore = (
        routeEfficiency * 0.3 +
        (100 - exceptionRate) * 0.3 +
        photoProofRate * 0.2 +
        safeDrivingScore * 0.2
      );

      // Identify strengths and areas for improvement
      const strengths = [];
      const areasForImprovement = [];

      if (routeEfficiency > 90) strengths.push("Excellent route efficiency");
      else if (routeEfficiency < 70) areasForImprovement.push("Route time management");

      if (exceptionRate < 5) strengths.push("Low exception rate");
      else if (exceptionRate > 15) areasForImprovement.push("Exception prevention");

      if (photoProofRate > 95) strengths.push("Consistent documentation");
      else if (photoProofRate < 85) areasForImprovement.push("Delivery proof completion");

      if (escalatedExceptions === 0) strengths.push("Strong problem-solving skills");
      else if (escalatedExceptions > 5) areasForImprovement.push("Independent issue resolution");

      // Save metrics
      const metricsData = await base44.entities.DriverPerformanceMetrics.create({
        driver_email: driverEmail,
        driver_name: driverName,
        period_start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        period_end: format(new Date(), 'yyyy-MM-dd'),
        total_deliveries: allDeliveries.length,
        successful_deliveries: totalDeliveries,
        total_exceptions: totalExceptions,
        escalated_exceptions: escalatedExceptions,
        exception_rate: exceptionRate,
        on_time_deliveries: withProof,
        on_time_rate: photoProofRate,
        route_efficiency_score: routeEfficiency,
        safe_driving_score: safeDrivingScore,
        overall_performance_score: overallScore,
        routes_completed: allRoutes.length,
        photo_proof_completion_rate: photoProofRate,
        areas_for_improvement: areasForImprovement,
        strengths: strengths,
        calculated_at: new Date().toISOString()
      });

      setMetrics(metricsData);

      // Generate AI coaching insights
      await generateCoachingInsights(metricsData, allDeliveries, allExceptions, allRoutes);

      toast.success("Performance analysis complete!");
    } catch (error) {
      console.error("Failed to generate metrics:", error);
      toast.error("Failed to analyze performance");
    }
    setGenerating(false);
  };

  const calculateSafeDrivingScore = (exceptionRate, routeEfficiency, escalations, totalDeliveries) => {
    let score = 100;

    // Penalize high exception rate
    score -= exceptionRate * 2;

    // Reward good route adherence/efficiency
    score = score * (routeEfficiency / 100);

    // Penalize escalations
    if (totalDeliveries > 0) {
      const escalationRate = (escalations / totalDeliveries) * 100;
      score -= escalationRate * 5;
    }

    return Math.max(0, Math.min(100, score));
  };

  const generateCoachingInsights = async (metrics, deliveries, exceptions, routes) => {
    try {
      const prompt = `You are an expert delivery operations coach. Analyze this driver's performance and provide personalized, actionable coaching insights.

DRIVER PERFORMANCE DATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Performance Score: ${metrics.overall_performance_score.toFixed(1)}/100
Route Efficiency: ${metrics.route_efficiency_score.toFixed(1)}/100
Safe Driving Score: ${metrics.safe_driving_score.toFixed(1)}/100
Exception Rate: ${metrics.exception_rate.toFixed(1)}%

Total Deliveries: ${metrics.total_deliveries}
Successful: ${metrics.successful_deliveries}
Total Exceptions: ${metrics.total_exceptions}
Escalated Exceptions: ${metrics.escalated_exceptions}
Photo Proof Rate: ${metrics.photo_proof_completion_rate.toFixed(1)}%
Routes Completed: ${metrics.routes_completed}

Strengths: ${metrics.strengths?.join(', ') || 'None identified yet'}
Areas for Improvement: ${metrics.areas_for_improvement?.join(', ') || 'None identified yet'}

PROVIDE 3-5 COACHING INSIGHTS:
1. Celebrate achievements and strengths (if any)
2. Address areas for improvement with specific, actionable tips
3. Provide time management or efficiency suggestions
4. Offer customer service or communication tips
5. Safety or documentation reminders

For each insight, provide:
- Type (route_efficiency, exception_handling, time_management, customer_service, safety, documentation, achievement)
- Priority (low, medium, high)
- Title (brief, encouraging)
- Message (personalized, specific to this driver's data)
- 2-3 actionable tips (concrete steps they can take)

Be encouraging, specific, and data-driven. Focus on growth and improvement.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  insight_type: { 
                    type: "string",
                    enum: ["route_efficiency", "exception_handling", "time_management", "customer_service", "safety", "documentation", "achievement", "general_tip"]
                  },
                  priority: { 
                    type: "string",
                    enum: ["low", "medium", "high"]
                  },
                  title: { type: "string" },
                  message: { type: "string" },
                  actionable_tips: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        }
      });

      // Save each insight
      const createdInsights = [];
      for (const insight of response.insights) {
        const created = await base44.entities.DriverCoachingInsight.create({
          driver_email: driverEmail,
          driver_name: driverName,
          insight_type: insight.insight_type,
          priority: insight.priority,
          title: insight.title,
          message: insight.message,
          actionable_tips: insight.actionable_tips,
          metrics_supporting: {
            overall_score: metrics.overall_performance_score,
            route_efficiency: metrics.route_efficiency_score,
            safe_driving: metrics.safe_driving_score,
            exception_rate: metrics.exception_rate
          },
          created_at: new Date().toISOString(),
          read: false
        });
        createdInsights.push(created);
      }

      setInsights(createdInsights);
    } catch (error) {
      console.error("Failed to generate coaching insights:", error);
    }
  };

  const markInsightAsRead = async (insightId) => {
    try {
      await base44.entities.DriverCoachingInsight.update(insightId, {
        read: true,
        read_at: new Date().toISOString()
      });
      setInsights(insights.map(i => 
        i.id === insightId ? {...i, read: true} : i
      ));
    } catch (error) {
      console.error("Failed to mark insight as read:", error);
    }
  };

  const provideFeedback = async (insightId, helpful) => {
    try {
      await base44.entities.DriverCoachingInsight.update(insightId, {
        helpful
      });
      setInsights(insights.map(i => 
        i.id === insightId ? {...i, helpful} : i
      ));
      toast.success(helpful ? "Thanks for your feedback! 👍" : "We'll improve our coaching. 👎");
    } catch (error) {
      console.error("Failed to provide feedback:", error);
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

  const insightIcons = {
    route_efficiency: Navigation,
    exception_handling: AlertTriangle,
    time_management: Clock,
    customer_service: Star,
    safety: CheckCircle2,
    documentation: Award,
    achievement: Trophy,
    general_tip: Lightbulb
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Analyzing your performance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate/Refresh Button */}
      <Button
        onClick={generateMetrics}
        disabled={generating}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold"
      >
        <Zap className="w-4 h-4 mr-2" />
        {generating ? "Analyzing Performance..." : metrics ? "Refresh Analysis" : "Analyze My Performance"}
      </Button>

      {metrics && (
        <>
          {/* Overall Performance Score */}
          <Card className={`border-2 ${getScoreBgColor(metrics.overall_performance_score)}`}>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600 mb-2">Overall Performance Score</p>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <p className={`text-5xl font-bold ${getScoreColor(metrics.overall_performance_score)}`}>
                    {metrics.overall_performance_score.toFixed(0)}
                  </p>
                  <span className="text-2xl text-gray-500">/100</span>
                </div>
                <Progress 
                  value={metrics.overall_performance_score} 
                  className="h-3"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Last 30 days • Updated {format(new Date(metrics.calculated_at), "MMM d")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-2 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  <p className="text-xs font-semibold text-gray-600">Route Efficiency</p>
                </div>
                <p className={`text-3xl font-bold ${getScoreColor(metrics.route_efficiency_score)}`}>
                  {metrics.route_efficiency_score.toFixed(0)}
                </p>
                <Progress value={metrics.route_efficiency_score} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-xs font-semibold text-gray-600">Safe Driving</p>
                </div>
                <p className={`text-3xl font-bold ${getScoreColor(metrics.safe_driving_score)}`}>
                  {metrics.safe_driving_score.toFixed(0)}
                </p>
                <Progress value={metrics.safe_driving_score} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <p className="text-xs font-semibold text-gray-600">Success Rate</p>
                </div>
                <p className="text-3xl font-bold text-purple-900">
                  {((metrics.successful_deliveries / metrics.total_deliveries) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {metrics.successful_deliveries} of {metrics.total_deliveries}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <p className="text-xs font-semibold text-gray-600">Exception Rate</p>
                </div>
                <p className={`text-3xl font-bold ${metrics.exception_rate < 10 ? 'text-green-600' : 'text-orange-600'}`}>
                  {metrics.exception_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {metrics.total_exceptions} exceptions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Strengths */}
          {metrics.strengths && metrics.strengths.length > 0 && (
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-green-900 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Your Strengths
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.strengths.map((strength, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-800">{strength}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Areas for Improvement */}
          {metrics.areas_for_improvement && metrics.areas_for_improvement.length > 0 && (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Growth Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.areas_for_improvement.map((area, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                    <p className="text-sm text-blue-800">{area}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Coaching Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-600" />
            AI Coaching Insights
          </h3>

          {insights.map((insight) => {
            const Icon = insightIcons[insight.insight_type] || Lightbulb;
            return (
              <Card 
                key={insight.id} 
                className={`border-2 ${
                  insight.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                  insight.priority === 'medium' ? 'border-blue-300 bg-blue-50' :
                  'border-gray-200'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-base">{insight.title}</CardTitle>
                    </div>
                    {!insight.read && (
                      <Badge className="bg-blue-600 text-white text-xs">New</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-700">{insight.message}</p>

                  {insight.actionable_tips && insight.actionable_tips.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-2">💡 Action Steps:</p>
                      <ul className="space-y-1">
                        {insight.actionable_tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-600 font-bold flex-shrink-0">{idx + 1}.</span>
                            <span className="text-gray-700">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {!insight.read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markInsightAsRead(insight.id)}
                        className="flex-1"
                      >
                        Mark as Read
                      </Button>
                    )}
                    {insight.helpful === undefined && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => provideFeedback(insight.id, true)}
                          className="border-green-300 text-green-700"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => provideFeedback(insight.id, false)}
                          className="border-red-300 text-red-700"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {insight.helpful !== undefined && (
                      <Badge variant="outline" className="ml-auto">
                        {insight.helpful ? '👍 Helpful' : '👎 Not helpful'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!metrics && !generating && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 text-lg mb-2">No performance data yet</p>
            <p className="text-sm text-gray-500">
              Complete some deliveries, then click "Analyze My Performance" to see your coaching insights
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}