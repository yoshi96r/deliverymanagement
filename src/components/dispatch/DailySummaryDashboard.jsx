import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Calendar, TrendingUp, TrendingDown, Award, AlertTriangle,
  CheckCircle2, Navigation, Star, Shield, Brain, Download, Mail
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { AIOperationsMonitor } from "./AIOperationsMonitor";

export default function DailySummaryDashboard() {
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dispatcherNotes, setDispatcherNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: summaries, refetch } = useQuery({
    queryKey: ['dailySummaries'],
    queryFn: async () => {
      const summaries = await base44.entities.DailyOperationsSummary.list('-summary_date', 30);
      return summaries;
    },
    initialData: [],
  });

  const todaySummary = summaries.find(s => s.summary_date === selectedDate);

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const date = new Date(selectedDate);
      const summary = await AIOperationsMonitor.generateDailySummary(date);
      return summary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySummaries'] });
      toast.success("Daily summary generated successfully!");
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async () => {
      if (!todaySummary) return;
      await base44.entities.DailyOperationsSummary.update(todaySummary.id, {
        dispatcher_notes: dispatcherNotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySummaries'] });
      toast.success("Notes saved!");
    },
  });

  const emailSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!todaySummary) return;

      const emailBody = `DAILY OPERATIONS SUMMARY
${format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Deliveries: ${todaySummary.total_deliveries}
Successful: ${todaySummary.successful_deliveries} (${((todaySummary.successful_deliveries / todaySummary.total_deliveries) * 100).toFixed(1)}%)
Active Drivers: ${todaySummary.active_drivers}
Routes Optimized: ${todaySummary.routes_optimized}
Average Route Efficiency: ${todaySummary.average_route_efficiency?.toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXCEPTIONS & ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Exceptions: ${todaySummary.total_exceptions}
Critical: ${todaySummary.critical_exceptions}
Escalated: ${todaySummary.escalated_exceptions}

Exception Patterns:
${todaySummary.exception_patterns?.map(p => `- ${p.exception_type.replace(/_/g, ' ')}: ${p.count} (${p.trend})`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI ASSISTANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recommendations Generated: ${todaySummary.ai_recommendations_generated}
Recommendations Actioned: ${todaySummary.ai_recommendations_actioned}
Actioned Rate: ${((todaySummary.ai_recommendations_actioned / todaySummary.ai_recommendations_generated) * 100).toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMER & SAFETY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customer Satisfaction: ${todaySummary.customer_satisfaction_average?.toFixed(1)}/100
Safety Events: ${todaySummary.safety_events}
Critical Safety Events: ${todaySummary.critical_safety_events}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${todaySummary.top_performing_drivers?.map((d, i) => `${i + 1}. ${d.driver_name} - ${d.deliveries_completed} deliveries, Score: ${d.performance_score}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRIVERS NEEDING SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${todaySummary.drivers_needing_support?.length > 0 ? todaySummary.drivers_needing_support.map(d => `- ${d.driver_name}: ${d.issue}`).join('\n') : 'None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI KEY INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${todaySummary.key_insights?.map((insight, i) => `${i + 1}. ${insight}`).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOMORROW'S OUTLOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Potential Issues:
${todaySummary.potential_issues_tomorrow?.map(issue => `⚠️ ${issue}`).join('\n')}

Recommended Actions:
${todaySummary.recommended_actions?.map((action, i) => `${i + 1}. [${action.priority}] ${action.action}\n   Reason: ${action.reason}`).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEATHER & TRAFFIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Weather: ${todaySummary.weather_impact_summary}
Traffic: ${todaySummary.traffic_impact_summary}

${todaySummary.dispatcher_notes ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISPATCHER NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${todaySummary.dispatcher_notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by AI Operations Monitor
${format(new Date(todaySummary.generated_at), "MMM d, yyyy 'at' h:mm a")}`;

      await base44.integrations.Core.SendEmail({
        to: 'dispatch-management@usps.com',
        subject: `📊 Daily Operations Summary - ${format(new Date(selectedDate), "MMM d, yyyy")}`,
        body: emailBody,
        from_name: 'AI Operations Monitor'
      });
    },
    onSuccess: () => {
      toast.success("Summary emailed to management!");
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-purple-900">Daily Operations Summary</CardTitle>
                <p className="text-sm text-purple-700">AI-powered operational insights</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border-2 border-purple-300 rounded-lg"
              />
              <Button
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generateSummaryMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!todaySummary ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 text-lg mb-2">No summary for this date</p>
            <p className="text-sm text-gray-500 mb-4">Click "Generate Summary" to create AI analysis</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2 border-green-200">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-3xl font-bold text-green-900">
                  {((todaySummary.successful_deliveries / todaySummary.total_deliveries) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-xs text-gray-500 mt-1">
                  {todaySummary.successful_deliveries}/{todaySummary.total_deliveries}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200">
              <CardContent className="p-4 text-center">
                <Navigation className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <p className="text-3xl font-bold text-blue-900">
                  {todaySummary.average_route_efficiency?.toFixed(0)}%
                </p>
                <p className="text-sm text-gray-600">Route Efficiency</p>
                <p className="text-xs text-gray-500 mt-1">
                  {todaySummary.routes_optimized} routes
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200">
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                <p className="text-3xl font-bold text-purple-900">
                  {todaySummary.customer_satisfaction_average?.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600">Customer Score</p>
                <p className="text-xs text-gray-500 mt-1">Out of 100</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                <p className="text-3xl font-bold text-orange-900">
                  {todaySummary.total_exceptions}
                </p>
                <p className="text-sm text-gray-600">Exceptions</p>
                <p className="text-xs text-gray-500 mt-1">
                  {todaySummary.escalated_exceptions} escalated
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI Key Insights */}
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardHeader className="bg-blue-100 border-b border-blue-200">
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {todaySummary.key_insights?.map((insight, idx) => (
                <div key={idx} className="p-3 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 flex items-start gap-2">
                    <span className="font-bold text-blue-600">{idx + 1}.</span>
                    {insight}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Performers */}
          {todaySummary.top_performing_drivers?.length > 0 && (
            <Card className="border-2 border-green-300 bg-green-50">
              <CardHeader className="bg-green-100 border-b border-green-200">
                <CardTitle className="text-green-900 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  🏆 Top Performing Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {todaySummary.top_performing_drivers.map((driver, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-500' : 'bg-green-600'
                        } text-white font-bold`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{driver.driver_name}</p>
                          <p className="text-xs text-gray-600">{driver.deliveries_completed} deliveries</p>
                        </div>
                      </div>
                      <Badge className="bg-green-600 text-white">
                        Score: {driver.performance_score}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drivers Needing Support */}
          {todaySummary.drivers_needing_support?.length > 0 && (
            <Card className="border-2 border-orange-300 bg-orange-50">
              <CardHeader className="bg-orange-100 border-b border-orange-200">
                <CardTitle className="text-orange-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Drivers Needing Support
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {todaySummary.drivers_needing_support.map((driver, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{driver.driver_name}</p>
                        <p className="text-sm text-orange-800">{driver.issue}</p>
                      </div>
                      <Badge className="bg-orange-600">
                        {driver.exception_count} exceptions
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tomorrow's Outlook */}
          <Card className="border-2 border-yellow-300 bg-yellow-50">
            <CardHeader className="bg-yellow-100 border-b border-yellow-200">
              <CardTitle className="text-yellow-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tomorrow's Outlook & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Potential Issues */}
              {todaySummary.potential_issues_tomorrow?.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-yellow-900 mb-2">⚠️ Potential Issues:</p>
                  <div className="space-y-2">
                    {todaySummary.potential_issues_tomorrow.map((issue, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border border-yellow-200">
                        <p className="text-sm text-yellow-900">{issue}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {todaySummary.recommended_actions?.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-yellow-900 mb-2">💡 Recommended Actions:</p>
                  <div className="space-y-2">
                    {todaySummary.recommended_actions.map((action, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <Badge className={
                            action.priority === 'high' ? 'bg-red-600' :
                            action.priority === 'medium' ? 'bg-orange-600' :
                            'bg-blue-600'
                          }>
                            {action.priority}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm">{action.action}</p>
                            <p className="text-xs text-gray-600 mt-1">{action.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weather & Traffic Impact */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-2 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-blue-900">🌤️ Weather Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-800">{todaySummary.weather_impact_summary}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-purple-900">🚦 Traffic Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-800">{todaySummary.traffic_impact_summary}</p>
              </CardContent>
            </Card>
          </div>

          {/* Dispatcher Notes */}
          <Card className="border-2 border-gray-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-900">Dispatcher Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={dispatcherNotes || todaySummary.dispatcher_notes || ""}
                onChange={(e) => setDispatcherNotes(e.target.value)}
                placeholder="Add your observations, decisions made, or notes for future reference..."
                rows={4}
              />
              <Button
                onClick={() => updateNotesMutation.mutate()}
                disabled={updateNotesMutation.isPending}
                className="w-full"
              >
                Save Notes
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => emailSummaryMutation.mutate()}
              disabled={emailSummaryMutation.isPending}
              variant="outline"
              className="flex-1 border-blue-300 text-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email to Management
            </Button>
            <Button
              onClick={() => {
                // Create downloadable text version
                const text = document.querySelector('.summary-content')?.innerText || 'Summary';
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `operations-summary-${selectedDate}.txt`;
                a.click();
                toast.success("Summary downloaded!");
              }}
              variant="outline"
              className="flex-1 border-purple-300 text-purple-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>

          {/* Summary Trends */}
          {summaries.length > 1 && (
            <Card className="border-2 border-gray-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-gray-900">7-Day Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summaries.slice(0, 7).map((summary, idx) => {
                    const prevSummary = summaries[idx + 1];
                    const successRate = (summary.successful_deliveries / summary.total_deliveries) * 100;
                    const prevSuccessRate = prevSummary 
                      ? (prevSummary.successful_deliveries / prevSummary.total_deliveries) * 100
                      : successRate;
                    const improving = successRate >= prevSuccessRate;

                    return (
                      <div key={summary.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {format(new Date(summary.summary_date), "EEE, MMM d")}
                            </p>
                            <p className="text-xs text-gray-600">
                              {summary.total_deliveries} deliveries • {summary.total_exceptions} exceptions
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              {improving ? (
                                <TrendingUp className="w-4 h-4 text-green-600" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-600" />
                              )}
                              <span className={`font-bold ${improving ? 'text-green-600' : 'text-red-600'}`}>
                                {successRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}