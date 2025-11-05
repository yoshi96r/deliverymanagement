import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { 
  GraduationCap, Play, Trophy, Clock, Target, Zap, 
  AlertTriangle, CheckCircle2, XCircle, Brain, Award,
  TrendingUp, Star, MessageSquare, Phone, Route
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, differenceInSeconds } from "date-fns";

export default function DispatcherTrainingSimulator({ dispatcherEmail, dispatcherName }) {
  const [activeScenario, setActiveScenario] = useState(null);
  const [scenarioProgress, setScenarioProgress] = useState(null);
  const [currentDecisionPoint, setCurrentDecisionPoint] = useState(0);
  const [decisions, setDecisions] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [aiRealtimeFeedback, setAiRealtimeFeedback] = useState("");
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const queryClient = useQueryClient();

  const { data: scenarios } = useQuery({
    queryKey: ['trainingScenarios'],
    queryFn: async () => {
      const scenarios = await base44.entities.DispatcherTrainingScenario.filter({
        is_active: true
      });
      return scenarios.sort((a, b) => {
        const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      });
    },
    initialData: [],
  });

  const { data: myProgress } = useQuery({
    queryKey: ['myTrainingProgress', dispatcherEmail],
    queryFn: () => base44.entities.DispatcherTrainingProgress.filter({
      dispatcher_email: dispatcherEmail
    }),
    initialData: [],
  });

  const { data: myBadges } = useQuery({
    queryKey: ['myDispatcherBadges', dispatcherEmail],
    queryFn: () => base44.entities.DispatcherBadge.filter({
      dispatcher_email: dispatcherEmail
    }),
    initialData: [],
  });

  const { data: myPoints } = useQuery({
    queryKey: ['myDispatcherPoints', dispatcherEmail],
    queryFn: async () => {
      const points = await base44.entities.DispatcherPoints.filter({
        dispatcher_email: dispatcherEmail
      });
      return points.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at));
    },
    initialData: [],
  });

  // Timer for scenario
  useEffect(() => {
    if (!startTime || showResults) return;

    const interval = setInterval(() => {
      setTimeElapsed(differenceInSeconds(new Date(), startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, showResults]);

  const startScenario = (scenario) => {
    setActiveScenario(scenario);
    setCurrentDecisionPoint(0);
    setDecisions([]);
    setStartTime(new Date());
    setTimeElapsed(0);
    setShowResults(false);
    setAiRealtimeFeedback("");
  };

  const makeDecision = async (decisionPointId, option) => {
    const decisionTime = differenceInSeconds(new Date(), startTime);
    
    const newDecision = {
      decision_point_id: decisionPointId,
      option_chosen: option.option_id,
      was_optimal: option.is_optimal,
      time_taken_seconds: decisionTime - (decisions.length > 0 ? decisions[decisions.length - 1].time_taken_seconds : 0),
      points_earned: option.points_awarded,
      feedback: option.feedback_if_chosen,
      consequences: option.consequences
    };

    setDecisions([...decisions, newDecision]);

    // Generate real-time AI feedback
    setGeneratingFeedback(true);
    try {
      const feedbackPrompt = `You are a dispatcher training coach providing real-time feedback.

SCENARIO: ${activeScenario.scenario_name}
DECISION POINT: ${activeScenario.decision_points[currentDecisionPoint].description}

DISPATCHER'S CHOICE:
${option.option_text}

RESULT:
- Optimal Choice: ${option.is_optimal ? 'YES' : 'NO'}
- Points Earned: ${option.points_awarded}
- Consequence: ${option.consequences}

Provide brief, encouraging feedback (2-3 sentences) that:
1. Acknowledges their decision
2. Explains why it was good/bad
3. Gives a quick tip if suboptimal
4. Stays positive and coaching-focused

Be concise and supportive.`;

      const feedback = await base44.integrations.Core.InvokeLLM({
        prompt: feedbackPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            feedback_text: { type: "string" },
            tone: { type: "string" }
          }
        }
      });

      setAiRealtimeFeedback(feedback.feedback_text);
    } catch (error) {
      console.error("Failed to generate feedback:", error);
    }
    setGeneratingFeedback(false);

    // Move to next decision point or complete
    if (currentDecisionPoint < activeScenario.decision_points.length - 1) {
      setTimeout(() => {
        setCurrentDecisionPoint(currentDecisionPoint + 1);
        setAiRealtimeFeedback("");
      }, 3000);
    } else {
      // Scenario complete
      setTimeout(() => {
        completeScenario();
      }, 2000);
    }
  };

  const completeScenario = async () => {
    const totalTime = differenceInSeconds(new Date(), startTime) / 60;
    const totalPoints = decisions.reduce((sum, d) => sum + d.points_earned, 0);
    const maxPoints = activeScenario.max_points;
    const score = (totalPoints / maxPoints) * 100;
    const passed = score >= (activeScenario.success_criteria?.minimum_score || 70);

    // Generate comprehensive AI feedback
    const analysisPrompt = `You are an expert dispatcher trainer analyzing a completed training scenario.

SCENARIO: ${activeScenario.scenario_name} (${activeScenario.difficulty})
CATEGORY: ${activeScenario.category}

DISPATCHER PERFORMANCE:
- Name: ${dispatcherName}
- Time Taken: ${totalTime.toFixed(1)} minutes
- Score: ${score.toFixed(1)}%
- Passed: ${passed}
- Total Points: ${totalPoints}/${maxPoints}

DECISIONS MADE:
${decisions.map((d, i) => `
Decision ${i + 1}:
- Optimal: ${d.was_optimal ? 'YES' : 'NO'}
- Time: ${d.time_taken_seconds}s
- Points: ${d.points_earned}
`).join('\n')}

OPTIMAL DECISIONS: ${decisions.filter(d => d.was_optimal).length}/${decisions.length}

Provide comprehensive performance analysis:
1. Strengths demonstrated (2-3 specific strengths)
2. Areas for improvement (2-3 specific areas)
3. Decision quality assessment
4. Speed and efficiency analysis
5. Best practices followed
6. Mistakes made and their impact
7. Specific coaching tips (3-5 actionable tips)
8. Overall feedback (encouraging and constructive)

Be specific, actionable, and balanced between praise and constructive criticism.`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          strengths_demonstrated: {
            type: "array",
            items: { type: "string" }
          },
          areas_for_improvement: {
            type: "array",
            items: { type: "string" }
          },
          performance_breakdown: {
            type: "object",
            properties: {
              decision_quality_score: { type: "number" },
              speed_score: { type: "number" },
              communication_score: { type: "number" },
              prioritization_score: { type: "number" }
            }
          },
          best_practices_followed: {
            type: "array",
            items: { type: "string" }
          },
          mistakes_made: {
            type: "array",
            items: {
              type: "object",
              properties: {
                mistake_type: { type: "string" },
                description: { type: "string" },
                impact: { type: "string" }
              }
            }
          },
          coaching_tips: {
            type: "array",
            items: { type: "string" }
          },
          overall_feedback: { type: "string" }
        }
      }
    });

    // Save progress
    const progress = await base44.entities.DispatcherTrainingProgress.create({
      dispatcher_email: dispatcherEmail,
      dispatcher_name: dispatcherName,
      scenario_id: activeScenario.scenario_id,
      scenario_name: activeScenario.scenario_name,
      attempt_number: myProgress.filter(p => p.scenario_id === activeScenario.scenario_id).length + 1,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
      time_taken_minutes: totalTime,
      status: passed ? 'completed' : 'failed',
      decisions_made: decisions,
      score: score,
      points_earned: totalPoints,
      passed: passed,
      performance_breakdown: analysis.performance_breakdown,
      strengths_demonstrated: analysis.strengths_demonstrated,
      areas_for_improvement: analysis.areas_for_improvement,
      ai_feedback: analysis.overall_feedback,
      coaching_tips: analysis.coaching_tips,
      mistakes_made: analysis.mistakes_made,
      best_practices_followed: analysis.best_practices_followed
    });

    // Award points
    const currentBalance = myPoints.length > 0 ? myPoints[0].current_balance || 0 : 0;
    await base44.entities.DispatcherPoints.create({
      dispatcher_email: dispatcherEmail,
      dispatcher_name: dispatcherName,
      points_earned: totalPoints,
      current_balance: currentBalance + totalPoints,
      source_type: 'scenario_completed',
      source_description: `Completed: ${activeScenario.scenario_name} (${score.toFixed(0)}%)`,
      related_entity_id: progress.id,
      earned_at: new Date().toISOString()
    });

    // Award badge if passed and scenario has one
    if (passed && activeScenario.badge_awarded) {
      const existingBadge = myBadges.find(b => b.badge_id === activeScenario.badge_awarded);
      
      if (!existingBadge) {
        await base44.entities.DispatcherBadge.create({
          dispatcher_email: dispatcherEmail,
          dispatcher_name: dispatcherName,
          badge_id: activeScenario.badge_awarded,
          badge_name: `${activeScenario.scenario_name} Master`,
          badge_category: activeScenario.category === 'exception_handling' ? 'exception_master' : 
                         activeScenario.category === 'route_modification' ? 'route_optimizer' :
                         'training_champion',
          badge_tier: activeScenario.difficulty === 'expert' ? 'diamond' :
                     activeScenario.difficulty === 'advanced' ? 'platinum' :
                     activeScenario.difficulty === 'intermediate' ? 'gold' : 'silver',
          icon_emoji: score >= 95 ? '🏆' : score >= 85 ? '⭐' : '🎖️',
          description: `Completed ${activeScenario.scenario_name} scenario`,
          earned_at: new Date().toISOString(),
          earned_from_scenario: activeScenario.scenario_id,
          points_awarded: 200
        });

        toast.success("🏆 Badge Unlocked! +200 bonus points!");
      }
    }

    setFinalResults({
      passed,
      score,
      totalPoints,
      totalTime,
      analysis
    });
    setShowResults(true);
    queryClient.invalidateQueries({ queryKey: ['myTrainingProgress'] });
    queryClient.invalidateQueries({ queryKey: ['myDispatcherBadges'] });
    queryClient.invalidateQueries({ queryKey: ['myDispatcherPoints'] });
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-600';
      case 'intermediate': return 'bg-blue-600';
      case 'advanced': return 'bg-purple-600';
      case 'expert': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const currentBalance = myPoints.length > 0 ? myPoints[0].current_balance || 0 : 0;
  const completedScenarios = new Set(myProgress.filter(p => p.passed).map(p => p.scenario_id));

  if (!activeScenario) {
    return (
      <div className="space-y-4">
        {/* Stats Overview */}
        <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <Trophy className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
                <p className="text-2xl font-bold text-purple-900">{myBadges.length}</p>
                <p className="text-xs text-gray-600">Badges</p>
              </div>
              <div>
                <Star className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-purple-900">{currentBalance}</p>
                <p className="text-xs text-gray-600">Points</p>
              </div>
              <div>
                <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-2xl font-bold text-purple-900">{completedScenarios.size}</p>
                <p className="text-xs text-gray-600">Completed</p>
              </div>
              <div>
                <Target className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <p className="text-2xl font-bold text-purple-900">
                  {scenarios.length - completedScenarios.size}
                </p>
                <p className="text-xs text-gray-600">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Scenarios */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-purple-600" />
            Training Scenarios
          </h3>

          {scenarios.map((scenario) => {
            const completed = completedScenarios.has(scenario.scenario_id);
            const attempts = myProgress.filter(p => p.scenario_id === scenario.scenario_id);
            const bestScore = attempts.length > 0 
              ? Math.max(...attempts.map(a => a.score || 0))
              : 0;

            return (
              <Card 
                key={scenario.id}
                className={`border-2 ${
                  completed ? 'border-green-300 bg-green-50' : 'border-purple-300'
                }`}
              >
                <CardHeader className={completed ? 'bg-green-100' : 'bg-purple-50'}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-base">{scenario.scenario_name}</CardTitle>
                        <Badge className={getDifficultyColor(scenario.difficulty)}>
                          {scenario.difficulty}
                        </Badge>
                        {completed && (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{scenario.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-gray-800">{scenario.initial_situation}</p>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 bg-white rounded text-center">
                      <Clock className="w-4 h-4 mx-auto text-gray-600 mb-1" />
                      <p className="font-bold">{scenario.estimated_duration_minutes}m</p>
                      <p className="text-xs text-gray-600">Duration</p>
                    </div>
                    <div className="p-2 bg-white rounded text-center">
                      <Trophy className="w-4 h-4 mx-auto text-yellow-600 mb-1" />
                      <p className="font-bold">{scenario.max_points}</p>
                      <p className="text-xs text-gray-600">Max Points</p>
                    </div>
                    <div className="p-2 bg-white rounded text-center">
                      <Target className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                      <p className="font-bold">{scenario.decision_points?.length || 0}</p>
                      <p className="text-xs text-gray-600">Decisions</p>
                    </div>
                  </div>

                  {attempts.length > 0 && (
                    <div className="p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-900">
                        <strong>Best Score:</strong> {bestScore.toFixed(0)}% 
                        <span className="ml-2">({attempts.length} attempt{attempts.length > 1 ? 's' : ''})</span>
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => startScenario(scenario)}
                    className={`w-full font-bold ${
                      completed 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {completed ? 'Practice Again' : 'Start Scenario'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const currentDP = activeScenario?.decision_points[currentDecisionPoint];
  const progress = ((currentDecisionPoint + 1) / activeScenario.decision_points.length) * 100;

  if (showResults && finalResults) {
    return (
      <div className="space-y-4">
        {/* Results Header */}
        <Card className={`border-2 ${
          finalResults.passed 
            ? 'border-green-300 bg-green-50' 
            : 'border-orange-300 bg-orange-50'
        }`}>
          <CardContent className="p-6 text-center">
            {finalResults.passed ? (
              <>
                <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
                <h2 className="text-3xl font-bold text-green-900 mb-2">Scenario Passed! 🎉</h2>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 mx-auto text-orange-600 mb-4" />
                <h2 className="text-3xl font-bold text-orange-900 mb-2">Keep Practicing!</h2>
              </>
            )}
            
            <p className="text-6xl font-bold text-purple-900 mb-2">{finalResults.score.toFixed(0)}%</p>
            <p className="text-gray-600 mb-4">
              {finalResults.totalPoints} points in {finalResults.totalTime.toFixed(1)} minutes
            </p>

            <div className="flex justify-center gap-3">
              <Badge className="bg-purple-600 text-white text-lg px-4 py-2">
                +{finalResults.totalPoints} Points
              </Badge>
              {finalResults.passed && activeScenario.badge_awarded && (
                <Badge className="bg-yellow-600 text-white text-lg px-4 py-2">
                  🏆 Badge Earned!
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Breakdown */}
        <Card className="border-2 border-blue-300">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-blue-900">Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(finalResults.analysis.performance_breakdown).map(([key, value]) => (
                <div key={key} className="p-3 bg-white rounded border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <Progress value={value} className="h-2 mb-1" />
                  <p className="text-lg font-bold text-blue-900">{value}/100</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Strengths */}
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-green-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ✅ Strengths Demonstrated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {finalResults.analysis.strengths_demonstrated.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-green-900">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Areas for Improvement */}
        {finalResults.analysis.areas_for_improvement.length > 0 && (
          <Card className="border-2 border-orange-300 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-orange-900 flex items-center gap-2">
                <Target className="w-4 h-4" />
                📈 Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {finalResults.analysis.areas_for_improvement.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-orange-900">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600" />
                    {area}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Coaching Tips */}
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-900 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              💡 Coaching Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {finalResults.analysis.coaching_tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-purple-900">
                  <span className="font-bold text-purple-600">{idx + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Overall Feedback */}
        <Card className="border-2 border-blue-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-blue-900">AI Coach Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {finalResults.analysis.overall_feedback}
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setActiveScenario(null);
              setShowResults(false);
            }}
            variant="outline"
            className="flex-1"
          >
            Back to Scenarios
          </Button>
          {!finalResults.passed && (
            <Button
              onClick={() => startScenario(activeScenario)}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scenario Header */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-purple-900">{activeScenario.scenario_name}</h2>
              <p className="text-sm text-purple-700">{activeScenario.category.replace(/_/g, ' ')}</p>
            </div>
            <Badge className={getDifficultyColor(activeScenario.difficulty)}>
              {activeScenario.difficulty}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-2 bg-white rounded text-center">
              <Clock className="w-4 h-4 mx-auto text-gray-600 mb-1" />
              <p className="font-bold">{Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}</p>
              <p className="text-xs text-gray-600">Time</p>
            </div>
            <div className="p-2 bg-white rounded text-center">
              <Target className="w-4 h-4 mx-auto text-purple-600 mb-1" />
              <p className="font-bold">{currentDecisionPoint + 1}/{activeScenario.decision_points.length}</p>
              <p className="text-xs text-gray-600">Decision</p>
            </div>
            <div className="p-2 bg-white rounded text-center">
              <Trophy className="w-4 h-4 mx-auto text-yellow-600 mb-1" />
              <p className="font-bold">{decisions.reduce((sum, d) => sum + d.points_earned, 0)}</p>
              <p className="text-xs text-gray-600">Points</p>
            </div>
          </div>

          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Current Decision Point */}
      {currentDP && (
        <Card className="border-2 border-blue-300">
          <CardHeader className="bg-blue-50 border-b border-blue-200">
            <CardTitle className="text-blue-900">
              Decision Point {currentDecisionPoint + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <p className="text-gray-900 font-semibold">{currentDP.description}</p>
            </div>

            {currentDP.time_limit_seconds && (
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <p className="text-xs text-red-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <strong>Time Limit:</strong> {currentDP.time_limit_seconds} seconds per decision
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-900">Choose your action:</p>
              {currentDP.options.map((option, idx) => (
                <Button
                  key={option.option_id}
                  onClick={() => makeDecision(currentDP.point_id, option)}
                  variant="outline"
                  className="w-full text-left justify-start p-4 h-auto border-2 hover:border-purple-400 hover:bg-purple-50"
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-purple-900">{String.fromCharCode(65 + idx)}</span>
                    </div>
                    <span className="text-sm text-gray-900">{option.option_text}</span>
                  </div>
                </Button>
              ))}
            </div>

            {/* Real-time AI Feedback */}
            {aiRealtimeFeedback && (
              <Card className="border-2 border-purple-300 bg-purple-50 animate-fade-in">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Brain className="w-6 h-6 text-purple-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-purple-900 mb-1">AI Coach Feedback:</p>
                      <p className="text-sm text-purple-800">{aiRealtimeFeedback}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {generatingFeedback && (
              <div className="flex items-center justify-center gap-2 text-purple-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                <p className="text-sm">AI coach is analyzing your decision...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decision History */}
      {decisions.length > 0 && (
        <Card className="border-2 border-gray-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-900">Decision History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {decisions.map((decision, idx) => (
              <div 
                key={idx}
                className={`p-2 rounded border-2 ${
                  decision.was_optimal 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-orange-50 border-orange-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Decision {idx + 1}</span>
                  <div className="flex items-center gap-2">
                    {decision.was_optimal ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                    )}
                    <Badge className={decision.was_optimal ? 'bg-green-600' : 'bg-orange-600'}>
                      +{decision.points_earned} pts
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}