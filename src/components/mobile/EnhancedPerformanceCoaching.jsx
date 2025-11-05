
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Navigation,
  Award, Target, Zap, ThumbsUp, ThumbsDown, Lightbulb, Star,
  BarChart3, Trophy, BookOpen, PlayCircle, TrendingDown
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, subDays, subMonths } from "date-fns";
import LeaderboardDisplay from "./LeaderboardDisplay";
import BadgeShowcase from "./BadgeShowcase";
import PointsRewardsPanel from "./PointsRewardsPanel";

export default function EnhancedPerformanceCoaching({ driverEmail, driverName }) {
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [historicalMetrics, setHistoricalMetrics] = useState([]);
  const [insights, setInsights] = useState([]);
  const [trainingModules, setTrainingModules] = useState([]);
  const [trainingProgress, setTrainingProgress] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [driverEmail]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load current and historical metrics
      const allMetrics = await base44.entities.DriverPerformanceMetrics.filter({
        driver_email: driverEmail
      });

      const sortedMetrics = allMetrics.sort((a, b) =>
        new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
      );

      setCurrentMetrics(sortedMetrics[0] || null);
      setHistoricalMetrics(sortedMetrics);

      // Load coaching insights
      const insightsData = await base44.entities.DriverCoachingInsight.filter({
        driver_email: driverEmail
      });
      setInsights(insightsData.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));

      // Load training modules
      const modules = await base44.entities.DriverTrainingModule.list();
      setTrainingModules(modules);

      // Load training progress
      const progress = await base44.entities.DriverTrainingProgress.filter({
        driver_email: driverEmail
      });
      setTrainingProgress(progress);

    } catch (error) {
      console.error("Failed to load coaching data:", error);
    }
    setLoading(false);
  };

  const generateComprehensiveAnalysis = async () => {
    setGenerating(true);
    try {
      // Gather all historical data
      const allDeliveries = await base44.entities.DeliveryRequest.filter({
        carrier_email: driverEmail
      });

      const allExceptions = await base44.entities.DeliveryException.filter({
        reported_by_email: driverEmail
      });

      const allFeedback = await base44.entities.CustomerFeedback.filter({
        related_driver_email: driverEmail
      });

      const allRoutes = await base44.entities.OptimizedRoute.filter({
        driver_email: driverEmail
      });

      // Analyze exception patterns
      const exceptionPatterns = {};
      allExceptions.forEach(ex => {
        if (!exceptionPatterns[ex.exception_type]) {
          exceptionPatterns[ex.exception_type] = {
            count: 0,
            escalated: 0,
            resolved: 0,
            avgResolutionTime: []
          };
        }
        exceptionPatterns[ex.exception_type].count++;
        if (ex.escalated) exceptionPatterns[ex.exception_type].escalated++;
        if (ex.resolution_status === 'resolved') exceptionPatterns[ex.exception_type].resolved++;
      });

      // Analyze customer feedback patterns
      const feedbackAvgs = {
        overall: allFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / (allFeedback.length || 1),
        driver: allFeedback.reduce((sum, f) => sum + (f.driver_professionalism || 0), 0) / (allFeedback.length || 1),
        speed: allFeedback.reduce((sum, f) => sum + (f.delivery_speed || 0), 0) / (allFeedback.length || 1),
        communication: allFeedback.reduce((sum, f) => sum + (f.communication_quality || 0), 0) / (allFeedback.length || 1)
      };

      const negativeFeedback = allFeedback.filter(f =>
        f.ai_sentiment === 'negative' || f.ai_sentiment === 'very_negative'
      );

      // Analyze route efficiency over time
      const completedRoutes = allRoutes.filter(r => r.status === 'completed');
      const routeEfficiencies = completedRoutes.map(r => {
        if (!r.actual_completion_time_minutes || !r.total_estimated_time_minutes) return null;
        return (r.total_estimated_time_minutes / r.actual_completion_time_minutes) * 100;
      }).filter(e => e !== null);

      const avgRouteEfficiency = routeEfficiencies.length > 0
        ? routeEfficiencies.reduce((sum, e) => sum + e, 0) / routeEfficiencies.length
        : 0;

      // AI Pattern Analysis
      const patternAnalysisPrompt = `You are an expert delivery operations coach conducting a comprehensive performance analysis.

DRIVER: ${driverName}
ANALYSIS PERIOD: Last 90 days

DELIVERY DATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Deliveries: ${allDeliveries.length}
Successful: ${allDeliveries.filter(d => d.status === 'delivered').length}
With Exceptions: ${allExceptions.length}

EXCEPTION PATTERNS:
${Object.entries(exceptionPatterns).map(([type, data]) => `
${type.replace(/_/g, ' ').toUpperCase()}:
  - Total: ${data.count}
  - Escalated: ${data.escalated} (${((data.escalated / data.count) * 100).toFixed(1)}%)
  - Resolved: ${data.resolved} (${((data.resolved / data.count) * 100).toFixed(1)}%)
`).join('\n')}

CUSTOMER FEEDBACK (${allFeedback.length} responses):
- Overall Rating: ${feedbackAvgs.overall.toFixed(1)}/5
- Driver Professionalism: ${feedbackAvgs.driver.toFixed(1)}/5
- Delivery Speed: ${feedbackAvgs.speed.toFixed(1)}/5
- Communication: ${feedbackAvgs.communication.toFixed(1)}/5
- Negative Feedback Count: ${negativeFeedback.length}

ROUTE PERFORMANCE:
- Routes Completed: ${completedRoutes.length}
- Average Route Efficiency: ${avgRouteEfficiency.toFixed(1)}%

NEGATIVE FEEDBACK THEMES:
${negativeFeedback.slice(0, 5).map(f => `- ${f.feedback_text}`).join('\n')}

COMPREHENSIVE ANALYSIS REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ERROR PATTERN IDENTIFICATION:
   - What are the most common exception types?
   - Are there recurring patterns (time of day, location, customer type)?
   - Which exceptions escalate most often?
   - Root causes of frequent issues

2. CUSTOMER SERVICE ANALYSIS:
   - What do customers consistently praise?
   - What are common complaints?
   - Communication strengths and weaknesses
   - Professionalism assessment

3. EFFICIENCY ANALYSIS:
   - Route completion patterns
   - Time management effectiveness
   - Areas where time is lost
   - Best performing times/conditions

4. SPECIFIC TRAINING RECOMMENDATIONS:
   For each identified weakness, recommend:
   - Specific training module needed
   - Why this training will help
   - Expected improvement area
   - Priority level (critical/high/medium/low)

5. POSITIVE REINFORCEMENT:
   - Identify what driver does exceptionally well
   - Celebrate improvements
   - Highlight strengths to build on

Provide detailed, data-driven analysis with specific, actionable coaching.`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: patternAnalysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            error_patterns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pattern_type: { type: "string" },
                  frequency: { type: "string" },
                  root_cause: { type: "string" },
                  impact_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  trend: { type: "string", enum: ["improving", "stable", "worsening"] }
                }
              }
            },
            customer_service_insights: {
              type: "object",
              properties: {
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                common_complaints: { type: "array", items: { type: "string" } },
                common_praise: { type: "array", items: { type: "string" } }
              }
            },
            efficiency_insights: {
              type: "object",
              properties: {
                time_management_score: { type: "number" },
                route_adherence_score: { type: "number" },
                areas_losing_time: { type: "array", items: { type: "string" } },
                efficiency_opportunities: { type: "array", items: { type: "string" } }
              }
            },
            training_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  module_category: {
                    type: "string",
                    enum: ["exception_prevention", "customer_communication", "route_efficiency", "safety_driving", "package_handling", "time_management", "technology_usage", "documentation_best_practices"]
                  },
                  specific_topic: { type: "string" },
                  reason: { type: "string" },
                  expected_improvement: { type: "string" },
                  priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  estimated_impact: { type: "string" }
                }
              }
            },
            positive_reinforcement: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  achievement: { type: "string" },
                  specific_data: { type: "string" },
                  encouragement: { type: "string" }
                }
              }
            },
            improvement_tracking: {
              type: "object",
              properties: {
                areas_improving: { type: "array", items: { type: "string" } },
                areas_declining: { type: "array", items: { type: "string" } },
                overall_trajectory: { type: "string", enum: ["improving", "stable", "declining"] }
              }
            },
            quick_wins: {
              type: "array",
              items: { type: "string" },
              description: "Easy improvements driver can make immediately"
            }
          }
        }
      });

      setPatterns(aiAnalysis);

      // Calculate current metrics
      const deliveredPackages = allDeliveries.filter(d => d.status === 'delivered');
      const totalDeliveries = deliveredPackages.length;
      const exceptionRate = totalDeliveries > 0 ? (allExceptions.length / totalDeliveries) * 100 : 0;

      const withProof = deliveredPackages.filter(d => d.delivery_proof_photo_url).length;
      const photoProofRate = totalDeliveries > 0 ? (withProof / totalDeliveries) * 100 : 0;

      const routeEfficiency = avgRouteEfficiency;
      const safeDrivingScore = calculateSafeDrivingScore(exceptionRate, routeEfficiency, allExceptions.filter(e => e.escalated).length, totalDeliveries);

      const overallScore = (
        routeEfficiency * 0.25 +
        (100 - exceptionRate) * 0.25 +
        photoProofRate * 0.2 +
        safeDrivingScore * 0.15 +
        (feedbackAvgs.overall / 5) * 100 * 0.15
      );

      // Save metrics
      const metricsData = await base44.entities.DriverPerformanceMetrics.create({
        driver_email: driverEmail,
        driver_name: driverName,
        period_start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        period_end: format(new Date(), 'yyyy-MM-dd'),
        total_deliveries: allDeliveries.length,
        successful_deliveries: totalDeliveries,
        total_exceptions: allExceptions.length,
        escalated_exceptions: allExceptions.filter(e => e.escalated).length,
        exception_rate: exceptionRate,
        on_time_deliveries: withProof,
        on_time_rate: photoProofRate,
        route_efficiency_score: routeEfficiency,
        safe_driving_score: safeDrivingScore,
        customer_satisfaction_score: (feedbackAvgs.overall / 5) * 100,
        overall_performance_score: overallScore,
        routes_completed: completedRoutes.length,
        photo_proof_completion_rate: photoProofRate,
        areas_for_improvement: aiAnalysis.customer_service_insights.weaknesses,
        strengths: aiAnalysis.customer_service_insights.strengths,
        calculated_at: new Date().toISOString()
      });

      setCurrentMetrics(metricsData);

      // Generate coaching insights
      await generateCoachingInsights(aiAnalysis, metricsData);

      // Generate training recommendations
      await generateTrainingRecommendations(aiAnalysis);

      toast.success("Comprehensive coaching analysis complete!");
      await loadAllData(); // Reload to get new data

    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Failed to generate analysis");
    }
    setGenerating(false);
  };

  const calculateSafeDrivingScore = (exceptionRate, routeEfficiency, escalations, totalDeliveries) => {
    let score = 100;
    score -= exceptionRate * 2;
    score = score * (routeEfficiency / 100);
    if (totalDeliveries > 0) {
      const escalationRate = (escalations / totalDeliveries) * 100;
      score -= escalationRate * 5;
    }
    return Math.max(0, Math.min(100, score));
  };

  const generateCoachingInsights = async (analysis, metrics) => {
    const insights = [];

    // Positive reinforcement insights
    for (const achievement of analysis.positive_reinforcement) {
      insights.push({
        insight_type: 'achievement',
        priority: 'medium',
        title: achievement.achievement,
        message: `${achievement.encouragement}\n\nData: ${achievement.specific_data}`,
        actionable_tips: ['Keep up the excellent work!', 'Share your techniques with other drivers', 'This is a model for others to follow']
      });
    }

    // Error pattern insights
    for (const pattern of analysis.error_patterns) {
      if (pattern.impact_level === 'high' || pattern.impact_level === 'critical') {
        insights.push({
          insight_type: 'exception_handling',
          priority: pattern.impact_level === 'critical' ? 'high' : 'medium',
          title: `Pattern Detected: ${pattern.pattern_type}`,
          message: `Frequency: ${pattern.frequency}\nRoot Cause: ${pattern.root_cause}\nTrend: ${pattern.trend}`,
          actionable_tips: [`Address root cause: ${pattern.root_cause}`, 'Review related training modules', 'Track improvement over next week']
        });
      }
    }

    // Customer service insights
    if (analysis.customer_service_insights.weaknesses.length > 0) {
      insights.push({
        insight_type: 'customer_service',
        priority: 'high',
        title: 'Customer Service Opportunities',
        message: `Areas to improve:\n${analysis.customer_service_insights.weaknesses.join('\n')}`,
        actionable_tips: analysis.customer_service_insights.weaknesses.slice(0, 3)
      });
    }

    // Quick wins
    if (analysis.quick_wins.length > 0) {
      insights.push({
        insight_type: 'general_tip',
        priority: 'high',
        title: '⚡ Quick Wins - Easy Improvements',
        message: 'These simple changes can have immediate impact:',
        actionable_tips: analysis.quick_wins
      });
    }

    // Save insights
    for (const insight of insights) {
      await base44.entities.DriverCoachingInsight.create({
        driver_email: driverEmail,
        driver_name: driverName,
        ...insight,
        metrics_supporting: {
          overall_score: metrics.overall_performance_score,
          exception_rate: metrics.exception_rate,
          customer_satisfaction: metrics.customer_satisfaction_score
        },
        created_at: new Date().toISOString(),
        read: false
      });
    }
  };

  const generateTrainingRecommendations = async (analysis) => {
    for (const rec of analysis.training_recommendations) {
      // Find matching training module
      const matchingModule = trainingModules.find(m =>
        m.module_category === rec.module_category
      );

      if (!matchingModule) continue;

      // Check if already assigned
      const existing = trainingProgress.find(p =>
        p.training_module_id === matchingModule.id &&
        p.status !== 'completed'
      );

      if (existing) continue;

      // Assign training
      await base44.entities.DriverTrainingProgress.create({
        driver_email: driverEmail,
        driver_name: driverName,
        training_module_id: matchingModule.id,
        module_name: matchingModule.module_name,
        recommended_by_ai: true,
        recommendation_reason: `${rec.reason}\n\nExpected Improvement: ${rec.expected_improvement}`,
        assigned_at: new Date().toISOString(),
        status: 'not_started'
      });
    }
  };

  const startTraining = async (moduleId) => {
    const progress = trainingProgress.find(p => p.training_module_id === moduleId);
    if (!progress) return;

    await base44.entities.DriverTrainingProgress.update(progress.id, {
      status: 'in_progress',
      started_at: new Date().toISOString()
    });

    toast.success("Training started! Good luck!");
    await loadAllData();
  };

  const completeTraining = async (progressId, passed = true, score = null) => {
    await base44.entities.DriverTrainingProgress.update(progressId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      passed: passed,
      quiz_score: score
    });

    // Award points for training completion - NEW
    if (passed) {
      const progress = trainingProgress.find(p => p.id === progressId);
      const pointsEarned = score >= 90 ? 100 : score >= 75 ? 75 : 50;

      // Get current balance
      const allPoints = await base44.entities.DriverPoints.filter({
        driver_email: driverEmail
      });
      const currentBalance = allPoints.length > 0
        ? allPoints.sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())[0].current_balance || 0
        : 0;

      await base44.entities.DriverPoints.create({
        driver_email: driverEmail,
        driver_name: driverName,
        points_earned: pointsEarned,
        current_balance: currentBalance + pointsEarned,
        source_type: 'training_completed',
        source_description: `Completed: ${progress?.module_name} (Score: ${score}%)`,
        related_entity_id: progressId,
        earned_at: new Date().toISOString()
      });

      // Check if this earns a badge
      if (score >= 95) {
        await base44.entities.DriverBadge.create({
          driver_email: driverEmail,
          driver_name: driverName,
          badge_id: `training-perfect-${driverEmail}-${progressId}-${Date.now()}`, // Ensure unique ID
          badge_name: 'Perfect Score Master',
          badge_category: 'training',
          badge_tier: 'gold',
          icon_emoji: '📚',
          description: 'Achieved 95%+ on training module',
          earned_at: new Date().toISOString(),
          points_awarded: 200
        });

        toast.success("🏆 Badge Earned: Perfect Score Master! +200 bonus points!");
      }
    }

    toast.success(passed ? "Training completed! 🎉" : "Training completed. Consider retrying for better score.");
    await loadAllData();
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (trend === 'worsening') return <TrendingDown className="w-5 h-5 text-red-600" />;
    return <TrendingUp className="w-5 h-5 text-gray-600" />;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading coaching data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analysis Button */}
      <Button
        onClick={generateComprehensiveAnalysis}
        disabled={generating}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6"
      >
        {generating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Running Deep AI Analysis...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Run Comprehensive Analysis
          </>
        )}
      </Button>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 bg-white text-xs">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-1" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="w-4 h-4 mr-1" />
            Ranks
          </TabsTrigger>
          <TabsTrigger value="badges">
            <Award className="w-4 h-4 mr-1" />
            Badges
          </TabsTrigger>
          <TabsTrigger value="points">
            <Star className="w-4 h-4 mr-1" />
            Points
          </TabsTrigger>
          <TabsTrigger value="training">
            <BookOpen className="w-4 h-4 mr-1" />
            Train
          </TabsTrigger>
          {/* Insights tab moved here */}
          <TabsTrigger value="insights">
            <Lightbulb className="w-4 h-4 mr-1" />
            Tips
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {currentMetrics ? (
            <>
              {/* Performance Score Card */}
              <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Overall Performance Score</p>
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <p className={`text-6xl font-bold ${getScoreColor(currentMetrics.overall_performance_score)}`}>
                        {currentMetrics.overall_performance_score.toFixed(0)}
                      </p>
                      <span className="text-3xl text-gray-500">/100</span>
                    </div>
                    <Progress value={currentMetrics.overall_performance_score} className="h-4 mb-2" />

                    {/* Trend Indicator */}
                    {historicalMetrics.length > 1 && (
                      <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                        {(() => {
                          const previousScore = historicalMetrics[1].overall_performance_score;
                          const change = currentMetrics.overall_performance_score - previousScore;
                          const improving = change > 0;

                          return (
                            <div className="flex items-center justify-center gap-2">
                              {improving ? (
                                <TrendingUp className="w-5 h-5 text-green-600" />
                              ) : change < 0 ? (
                                <TrendingDown className="w-5 h-5 text-red-600" />
                              ) : (
                                <TrendingUp className="w-5 h-5 text-gray-600" />
                              )}
                              <span className={`font-bold ${improving ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {improving ? '+' : ''}{change.toFixed(1)} points from last period
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-2 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-5 h-5 text-green-600" />
                      <p className="text-xs font-semibold text-gray-600">Customer Rating</p>
                    </div>
                    <p className={`text-3xl font-bold ${getScoreColor(currentMetrics.customer_satisfaction_score)}`}>
                      {currentMetrics.customer_satisfaction_score.toFixed(0)}
                    </p>
                    <Progress value={currentMetrics.customer_satisfaction_score} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Navigation className="w-5 h-5 text-blue-600" />
                      <p className="text-xs font-semibold text-gray-600">Route Efficiency</p>
                    </div>
                    <p className={`text-3xl font-bold ${getScoreColor(currentMetrics.route_efficiency_score)}`}>
                      {currentMetrics.route_efficiency_score.toFixed(0)}
                    </p>
                    <Progress value={currentMetrics.route_efficiency_score} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card className="border-2 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-purple-600" />
                      <p className="text-xs font-semibold text-gray-600">Success Rate</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-900">
                      {((currentMetrics.successful_deliveries / currentMetrics.total_deliveries) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {currentMetrics.successful_deliveries} of {currentMetrics.total_deliveries}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <p className="text-xs font-semibold text-gray-600">Exception Rate</p>
                    </div>
                    <p className={`text-3xl font-bold ${currentMetrics.exception_rate < 10 ? 'text-green-600' : 'text-orange-600'}`}>
                      {currentMetrics.exception_rate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {currentMetrics.total_exceptions} exceptions
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Achievements */}
              {currentMetrics.strengths && currentMetrics.strengths.length > 0 && (
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardHeader className="pb-3 bg-green-100">
                    <CardTitle className="text-base text-green-900 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      🏆 Your Strengths & Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-4">
                    {currentMetrics.strengths.map((strength, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-green-900 font-semibold">{strength}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-12 text-center">
                <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 text-lg">No performance data yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Click "Run Comprehensive Analysis" to generate your coaching report
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardDisplay driverEmail={driverEmail} />
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="mt-4">
          <BadgeShowcase driverEmail={driverEmail} />
        </TabsContent>

        {/* Points & Rewards Tab */}
        <TabsContent value="points" className="mt-4">
          <PointsRewardsPanel
            driverEmail={driverEmail}
            driverName={driverName}
          />
        </TabsContent>
        {/* Training Tab */}
        <TabsContent value="training" className="mt-4 space-y-4">
          {trainingProgress.filter(p => p.recommended_by_ai && p.status !== 'completed').length > 0 ? (
            <>
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <p className="text-sm text-blue-900">
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    <strong>AI has recommended personalized training based on your performance patterns.</strong>
                  </p>
                </CardContent>
              </Card>

              {trainingProgress
                .filter(p => p.recommended_by_ai && p.status !== 'completed')
                .map((progress) => {
                  const module = trainingModules.find(m => m.id === progress.training_module_id);
                  if (!module) return null;

                  return (
                    <Card key={progress.id} className="border-2 border-purple-300">
                      <CardHeader className="pb-3 bg-purple-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base text-purple-900">{module.module_name}</CardTitle>
                            <p className="text-sm text-purple-700 mt-1">{module.description}</p>
                          </div>
                          <Badge className={
                            progress.status === 'in_progress' ? 'bg-blue-600' :
                              'bg-purple-600'
                          }>
                            {progress.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Why Recommended */}
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-900 mb-1">🎯 Why This Training:</p>
                          <p className="text-sm text-yellow-800">{progress.recommendation_reason}</p>
                        </div>

                        {/* Module Details */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-2 bg-white rounded">
                            <p className="text-xs text-gray-600">Duration:</p>
                            <p className="font-semibold">{module.estimated_duration_minutes} minutes</p>
                          </div>
                          <div className="p-2 bg-white rounded">
                            <p className="text-xs text-gray-600">Type:</p>
                            <p className="font-semibold">{module.content_type}</p>
                          </div>
                        </div>

                        {/* Learning Objectives */}
                        {module.learning_objectives && module.learning_objectives.length > 0 && (
                          <div className="p-3 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs font-semibold text-gray-900 mb-2">What You'll Learn:</p>
                            <ul className="space-y-1">
                              {module.learning_objectives.map((obj, idx) => (
                                <li key={idx} className="text-sm text-gray-700">• {obj}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Action Button */}
                        {progress.status === 'not_started' && (
                          <Button
                            onClick={() => startTraining(module.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 font-bold"
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Start Training
                          </Button>
                        )}

                        {progress.status === 'in_progress' && (
                          <div className="space-y-2">
                            <Progress value={50} className="h-3" />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => completeTraining(progress.id, true, 85)}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                Complete Training
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </>
          ) : (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-12 text-center">
                <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 text-lg">No training recommended yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Run analysis to get personalized training recommendations
                </p>
              </CardContent>
            </Card>
          )}

          {/* Completed Training */}
          {trainingProgress.filter(p => p.status === 'completed').length > 0 && (
            <Card className="border-2 border-green-300 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-green-900">✅ Completed Training</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trainingProgress
                    .filter(p => p.status === 'completed')
                    .map((progress) => (
                      <div key={progress.id} className="p-2 bg-white rounded flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{progress.module_name}</p>
                          <p className="text-xs text-gray-600">
                            Completed {format(new Date(progress.completed_at), "MMM d")}
                          </p>
                        </div>
                        {progress.quiz_score && (
                          <Badge className="bg-green-600">
                            Score: {progress.quiz_score}%
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="mt-4 space-y-3">
          {insights.length > 0 ? (
            insights.map((insight) => {
              const insightIcons = {
                achievement: Trophy,
                exception_handling: AlertTriangle,
                customer_service: Star,
                route_efficiency: Navigation,
                time_management: Clock,
                safety: CheckCircle2,
                general_tip: Lightbulb
              };

              const Icon = insightIcons[insight.insight_type] || Lightbulb;

              return (
                <Card
                  key={insight.id}
                  className={`border-2 ${
                    insight.insight_type === 'achievement' ? 'border-green-300 bg-green-50' :
                      insight.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                        'border-blue-300 bg-blue-50'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${
                          insight.insight_type === 'achievement' ? 'text-green-600' : 'text-blue-600'
                        }`} />
                        <CardTitle className="text-base">{insight.title}</CardTitle>
                      </div>
                      {!insight.read && (
                        <Badge className="bg-blue-600 text-white text-xs">New</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{insight.message}</p>

                    {insight.actionable_tips && insight.actionable_tips.length > 0 && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-900 mb-2">💡 Action Steps:</p>
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
                          onClick={async () => {
                            await base44.entities.DriverCoachingInsight.update(insight.id, {
                              read: true,
                              read_at: new Date().toISOString()
                            });
                            await loadAllData();
                          }}
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
                            onClick={async () => {
                              await base44.entities.DriverCoachingInsight.update(insight.id, {
                                helpful: true
                              });
                              await loadAllData();
                              toast.success("Thanks for your feedback! 👍");
                            }}
                            className="border-green-300 text-green-700"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await base44.entities.DriverCoachingInsight.update(insight.id, {
                                helpful: false
                              });
                              await loadAllData();
                              toast.info("We'll improve our coaching. 👎");
                            }}
                            className="border-red-300 text-red-700"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-12 text-center">
                <Lightbulb className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 text-lg">No coaching insights yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Improvement Tracker */}
      {historicalMetrics.length > 1 && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader className="pb-3 bg-green-100">
            <CardTitle className="text-green-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Trend (Last {historicalMetrics.length} Periods)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {historicalMetrics.slice(0, 5).map((metric, idx) => (
                <div key={metric.id} className="p-3 bg-white rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">
                      {format(new Date(metric.period_start), "MMM d")} - {format(new Date(metric.period_end), "MMM d")}
                    </p>
                    <Badge className={
                      metric.overall_performance_score >= 90 ? 'bg-green-600' :
                        metric.overall_performance_score >= 75 ? 'bg-blue-600' :
                          'bg-yellow-600'
                    }>
                      {metric.overall_performance_score.toFixed(0)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-600">Deliveries:</p>
                      <p className="font-semibold">{metric.successful_deliveries}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Exceptions:</p>
                      <p className="font-semibold">{metric.exception_rate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Route Eff:</p>
                      <p className="font-semibold">{metric.route_efficiency_score.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
