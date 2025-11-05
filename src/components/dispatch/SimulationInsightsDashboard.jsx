import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Brain, TrendingUp, TrendingDown, Target, AlertTriangle,
  CheckCircle2, Lightbulb, BarChart3, Zap, Settings
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SimulationInsightsDashboard() {
  const queryClient = useQueryClient();

  const { data: insights, isLoading } = useQuery({
    queryKey: ['routeOptimizationInsights'],
    queryFn: async () => {
      const insights = await base44.entities.RouteOptimizationInsight.list('-insight_date', 30);
      return insights;
    },
    initialData: [],
  });

  const implementAdjustmentsMutation = useMutation({
    mutationFn: async (insightId) => {
      await base44.entities.RouteOptimizationInsight.update(insightId, {
        implemented: true,
        implementation_notes: `Adjustments implemented on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routeOptimizationInsights'] });
      toast.success("Algorithm adjustments marked as implemented!");
    },
  });

  const latestInsight = insights && insights.length > 0 ? insights[0] : null;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading optimization insights...</p>
      </div>
    );
  }

  if (!latestInsight) {
    return (
      <Card className="border-2 border-dashed border-gray-200">
        <CardContent className="p-12 text-center">
          <Brain className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 text-lg">No optimization insights yet</p>
          <p className="text-sm text-gray-500 mt-2">
            AI will analyze simulation patterns once enough data is available (minimum 5 simulations needed)
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-purple-900">AI Learning & Optimization Insights</CardTitle>
                <p className="text-sm text-purple-700">
                  Analysis from {latestInsight.total_simulations_analyzed || 0} simulations
                </p>
              </div>
            </div>
            <Badge className="bg-purple-600 text-white">
              Last updated: {format(new Date(latestInsight.generated_at), "MMM d")}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Accuracy Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-green-200">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-900">
              {latestInsight.prediction_accuracy_rate?.toFixed(1) || 0}%
            </p>
            <p className="text-sm text-gray-600">Prediction Accuracy</p>
            <p className="text-xs text-gray-500 mt-1">
              {latestInsight.successful_predictions || 0}/{latestInsight.applied_simulations || 0} accurate
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-900">
              {latestInsight.total_simulations_analyzed && latestInsight.applied_simulations
                ? ((latestInsight.applied_simulations / latestInsight.total_simulations_analyzed) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-sm text-gray-600">Application Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {latestInsight.applied_simulations || 0} of {latestInsight.total_simulations_analyzed || 0} applied
            </p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${
          latestInsight.recommendation_effectiveness && latestInsight.recommendation_effectiveness.calibration_needed 
            ? 'border-orange-200' 
            : 'border-purple-200'
        }`}>
          <CardContent className="p-4 text-center">
            <Zap className={`w-8 h-8 mx-auto mb-2 ${
              latestInsight.recommendation_effectiveness && latestInsight.recommendation_effectiveness.calibration_needed 
                ? 'text-orange-600' 
                : 'text-purple-600'
            }`} />
            <p className={`text-3xl font-bold ${
              latestInsight.recommendation_effectiveness && latestInsight.recommendation_effectiveness.calibration_needed 
                ? 'text-orange-900' 
                : 'text-purple-900'
            }`}>
              {latestInsight.recommendation_effectiveness && latestInsight.recommendation_effectiveness.strongly_recommend_acceptance_rate
                ? latestInsight.recommendation_effectiveness.strongly_recommend_acceptance_rate.toFixed(0)
                : 'N/A'}%
            </p>
            <p className="text-sm text-gray-600">Strong Rec Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {latestInsight.recommendation_effectiveness && latestInsight.recommendation_effectiveness.calibration_needed ? 'Needs calibration' : 'Well calibrated'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estimation Bias */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={`border-2 ${
          latestInsight.time_estimation_bias && Math.abs(latestInsight.time_estimation_bias.average_error_minutes || 0) > 5 
            ? 'border-orange-200 bg-orange-50' 
            : 'border-green-200 bg-green-50'
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.tends_to_underestimate ? (
                <TrendingDown className="w-4 h-4 text-orange-600" />
              ) : latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.tends_to_overestimate ? (
                <TrendingUp className="w-4 h-4 text-blue-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              Time Estimation Bias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 mb-2">
              {latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.average_error_minutes
                ? `${latestInsight.time_estimation_bias.average_error_minutes > 0 ? '+' : ''}${latestInsight.time_estimation_bias.average_error_minutes.toFixed(1)} min`
                : '0 min'}
            </p>
            <p className="text-sm text-gray-700">
              {latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.tends_to_underestimate 
                ? '⚠️ AI underestimates time - routes take longer than predicted'
                : latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.tends_to_overestimate
                  ? '📉 AI overestimates time - routes complete faster'
                  : '✅ Time predictions are accurate'}
            </p>
            {latestInsight.time_estimation_bias && latestInsight.time_estimation_bias.correction_factor && (
              <Badge className="bg-blue-600 text-white mt-2">
                Correction: ×{latestInsight.time_estimation_bias.correction_factor.toFixed(2)}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className={`border-2 ${
          latestInsight.distance_estimation_bias && Math.abs(latestInsight.distance_estimation_bias.average_error_miles || 0) > 2 
            ? 'border-orange-200 bg-orange-50' 
            : 'border-green-200 bg-green-50'
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {latestInsight.distance_estimation_bias && latestInsight.distance_estimation_bias.tends_to_underestimate ? (
                <TrendingDown className="w-4 h-4 text-orange-600" />
              ) : latestInsight.distance_estimation_bias && latestInsight.distance_estimation_bias.tends_to_overestimate ? (
                <TrendingUp className="w-4 h-4 text-blue-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              Distance Estimation Bias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 mb-2">
              {latestInsight.distance_estimation_bias && latestInsight.distance_estimation_bias.average_error_miles
                ? `${latestInsight.distance_estimation_bias.average_error_miles > 0 ? '+' : ''}${latestInsight.distance_estimation_bias.average_error_miles.toFixed(2)} mi`
                : '0 mi'}
            </p>
            <p className="text-sm text-gray-700">
              {latestInsight.distance_estimation_bias && latestInsight.distance_estimation_bias.tends_to_underestimate 
                ? '⚠️ AI underestimates distance'
                : latestInsight.distance_estimation_bias && latestInsight.distance_estimation_bias.tends_to_overestimate
                  ? '📉 AI overestimates distance'
                  : '✅ Distance predictions are accurate'}
            </p>
            {latestInsight.distance_estimation_bias && latestInsight.distance_estimation_bias.correction_factor && (
              <Badge className="bg-blue-600 text-white mt-2">
                Correction: ×{latestInsight.distance_estimation_bias.correction_factor.toFixed(2)}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Identified Patterns */}
      {latestInsight.patterns_identified && latestInsight.patterns_identified.length > 0 && (
        <Card className="border-2 border-blue-300">
          <CardHeader className="bg-blue-50 border-b border-blue-200">
            <CardTitle className="text-blue-900">📊 Patterns Identified</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {latestInsight.patterns_identified.map((pattern, idx) => (
              <Card key={idx} className="border-2 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-blue-900">{pattern.pattern_type}</p>
                    <Badge className={
                      (pattern.success_rate || 0) >= 80 ? 'bg-green-600' :
                      (pattern.success_rate || 0) >= 60 ? 'bg-blue-600' :
                      'bg-orange-600'
                    }>
                      {pattern.success_rate?.toFixed(0) || 0}% success
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{pattern.description}</p>
                  <p className="text-xs text-gray-600 mb-2">
                    Frequency: {pattern.frequency || 0} occurrences
                  </p>
                  <div className="p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs text-green-900">
                      <Lightbulb className="w-3 h-3 inline mr-1" />
                      <strong>Recommendation:</strong> {pattern.recommendation}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Algorithm Adjustments */}
      {latestInsight.algorithm_adjustments_recommended && latestInsight.algorithm_adjustments_recommended.length > 0 && (
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader className="bg-purple-100 border-b border-purple-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-purple-900 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Recommended Algorithm Adjustments
              </CardTitle>
              {!latestInsight.implemented && (
                <Button
                  onClick={() => {
                    if (confirm('Mark these adjustments as implemented?')) {
                      implementAdjustmentsMutation.mutate(latestInsight.id);
                    }
                  }}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Mark as Implemented
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {latestInsight.algorithm_adjustments_recommended.map((adjustment, idx) => (
              <Card key={idx} className="border-2 border-purple-200 bg-white">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-purple-900">{adjustment.adjustment_type}</p>
                    <Badge className="bg-purple-600 text-white">
                      {adjustment.current_value} → {adjustment.recommended_value}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Reason:</strong> {adjustment.reason}
                  </p>
                  <div className="p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs text-green-900">
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      <strong>Expected Impact:</strong> {adjustment.expected_improvement}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Success vs Failure Characteristics */}
      <div className="grid grid-cols-2 gap-4">
        {/* Successful Characteristics */}
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader className="pb-3 bg-green-100">
            <CardTitle className="text-sm text-green-900">
              ✅ Successful Simulation Traits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestInsight.successful_simulation_characteristics && 
             latestInsight.successful_simulation_characteristics.common_modification_types && 
             latestInsight.successful_simulation_characteristics.common_modification_types.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-900 mb-2">Common Types:</p>
                <div className="flex flex-wrap gap-1">
                  {latestInsight.successful_simulation_characteristics.common_modification_types.map((type, idx) => (
                    <Badge key={idx} className="bg-green-600 text-white text-xs">
                      {type.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-white rounded">
                <p className="text-xs text-gray-600">Avg Time Saved:</p>
                <p className="font-bold text-green-900">
                  {latestInsight.successful_simulation_characteristics && latestInsight.successful_simulation_characteristics.average_time_saved
                    ? latestInsight.successful_simulation_characteristics.average_time_saved.toFixed(1)
                    : 0} min
                </p>
              </div>
              <div className="p-2 bg-white rounded">
                <p className="text-xs text-gray-600">Avg Dist Saved:</p>
                <p className="font-bold text-green-900">
                  {latestInsight.successful_simulation_characteristics && latestInsight.successful_simulation_characteristics.average_distance_saved
                    ? latestInsight.successful_simulation_characteristics.average_distance_saved.toFixed(1)
                    : 0} mi
                </p>
              </div>
            </div>

            {latestInsight.successful_simulation_characteristics && 
             latestInsight.successful_simulation_characteristics.dispatcher_acceptance_factors && 
             latestInsight.successful_simulation_characteristics.dispatcher_acceptance_factors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-900 mb-2">Acceptance Factors:</p>
                <ul className="text-xs text-green-800 space-y-1">
                  {latestInsight.successful_simulation_characteristics.dispatcher_acceptance_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unsuccessful Characteristics */}
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardHeader className="pb-3 bg-orange-100">
            <CardTitle className="text-sm text-orange-900">
              ⚠️ Common Rejection Reasons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestInsight.unsuccessful_simulation_characteristics && 
             latestInsight.unsuccessful_simulation_characteristics.common_rejection_reasons && 
             latestInsight.unsuccessful_simulation_characteristics.common_rejection_reasons.length > 0 && (
              <ul className="text-xs text-orange-800 space-y-1">
                {latestInsight.unsuccessful_simulation_characteristics.common_rejection_reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {reason}
                  </li>
                ))}
              </ul>
            )}

            {latestInsight.unsuccessful_simulation_characteristics && 
             latestInsight.unsuccessful_simulation_characteristics.prediction_errors && 
             latestInsight.unsuccessful_simulation_characteristics.prediction_errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-900 mb-2">Common Errors:</p>
                <ul className="text-xs text-orange-800 space-y-1">
                  {latestInsight.unsuccessful_simulation_characteristics.prediction_errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {latestInsight.unsuccessful_simulation_characteristics && latestInsight.unsuccessful_simulation_characteristics.overestimated_benefits && (
              <Badge className="bg-orange-600 text-white">
                ⚠️ Tends to overestimate benefits
              </Badge>
            )}

            {latestInsight.unsuccessful_simulation_characteristics && latestInsight.unsuccessful_simulation_characteristics.underestimated_risks && (
              <Badge className="bg-red-600 text-white">
                🚨 Tends to underestimate risks
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Key Learnings */}
      {latestInsight.key_learnings && latestInsight.key_learnings.length > 0 && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardHeader className="pb-3 bg-blue-100">
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Key Learnings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {latestInsight.key_learnings.map((learning, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 flex items-start gap-2">
                  <span className="font-bold text-blue-600">{idx + 1}.</span>
                  {learning}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actionable Improvements */}
      {latestInsight.actionable_improvements && latestInsight.actionable_improvements.length > 0 && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader className="pb-3 bg-green-100">
            <CardTitle className="text-green-900 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Actionable Improvements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {latestInsight.actionable_improvements.map((improvement, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg border border-green-200">
                <p className="text-sm text-green-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                  {improvement}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendation Effectiveness */}
      {latestInsight.recommendation_effectiveness && (
        <Card className="border-2 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-900">Recommendation Effectiveness Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-2 bg-white rounded border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1">Strongly Recommend</p>
                <Progress 
                  value={latestInsight.recommendation_effectiveness.strongly_recommend_acceptance_rate || 0} 
                  className="h-2 mb-1" 
                />
                <p className="font-bold text-gray-900">
                  {latestInsight.recommendation_effectiveness.strongly_recommend_acceptance_rate?.toFixed(0) || 0}%
                </p>
              </div>
              <div className="p-2 bg-white rounded border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1">Recommend</p>
                <Progress 
                  value={latestInsight.recommendation_effectiveness.recommend_acceptance_rate || 0} 
                  className="h-2 mb-1" 
                />
                <p className="font-bold text-gray-900">
                  {latestInsight.recommendation_effectiveness.recommend_acceptance_rate?.toFixed(0) || 0}%
                </p>
              </div>
              <div className="p-2 bg-white rounded border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1">Neutral</p>
                <Progress 
                  value={latestInsight.recommendation_effectiveness.neutral_acceptance_rate || 0} 
                  className="h-2 mb-1" 
                />
                <p className="font-bold text-gray-900">
                  {latestInsight.recommendation_effectiveness.neutral_acceptance_rate?.toFixed(0) || 0}%
                </p>
              </div>
            </div>

            {latestInsight.recommendation_effectiveness.calibration_needed && 
             latestInsight.recommendation_effectiveness.suggested_confidence_thresholds && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-900">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  <strong>Calibration Needed:</strong> Recommendation thresholds should be adjusted for better alignment with dispatcher acceptance.
                </p>
                <div className="mt-2 text-xs text-orange-800">
                  <p>Suggested thresholds:</p>
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li>• Strongly Recommend: ≥{latestInsight.recommendation_effectiveness.suggested_confidence_thresholds.strongly_recommend_min}%</li>
                    <li>• Recommend: ≥{latestInsight.recommendation_effectiveness.suggested_confidence_thresholds.recommend_min}%</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historical Trend */}
      {insights.length > 1 && (
        <Card className="border-2 border-gray-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900">Accuracy Trend (Last {insights.length} Analyses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.slice(0, 7).map((insight) => (
                <div key={insight.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <p className="text-sm font-semibold text-gray-900">
                    {format(new Date(insight.insight_date), "MMM d")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Accuracy</p>
                      <Progress value={insight.prediction_accuracy_rate || 0} className="w-24 h-2" />
                    </div>
                    <Badge className={
                      (insight.prediction_accuracy_rate || 0) >= 85 ? 'bg-green-600' :
                      (insight.prediction_accuracy_rate || 0) >= 70 ? 'bg-blue-600' :
                      'bg-orange-600'
                    }>
                      {insight.prediction_accuracy_rate?.toFixed(0) || 0}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Implementation Status */}
      {latestInsight.implemented && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-900 mb-1">✅ Adjustments Implemented</p>
                <p className="text-sm text-green-800">{latestInsight.implementation_notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <p className="text-xs text-blue-900">
            <Brain className="w-4 h-4 inline mr-1" />
            <strong>Continuous Learning:</strong> The AI analyzes every simulation to learn what works and what doesn't. 
            This data drives automatic improvements to prediction accuracy and recommendation quality. The system gets smarter with every route optimization.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}