import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  Shield, AlertTriangle, TrendingUp, Award, User, Calendar,
  AlertCircle, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SafetyReportsManager() {
  const [selectedDriver, setSelectedDriver] = useState(null);

  const { data: safetyReports } = useQuery({
    queryKey: ['safetyReports'],
    queryFn: () => base44.entities.DriverSafetyReport.list('-generated_at', 100),
    initialData: [],
  });

  const { data: safetyEvents } = useQuery({
    queryKey: ['safetyEvents'],
    queryFn: () => base44.entities.DriverSafetyEvent.list('-timestamp', 200),
    initialData: [],
  });

  // Get unique drivers from reports
  const driverReports = React.useMemo(() => {
    const driversMap = {};
    
    safetyReports.forEach(report => {
      if (!driversMap[report.driver_email]) {
        driversMap[report.driver_email] = {
          driverEmail: report.driver_email,
          driverName: report.driver_name,
          latestReport: report,
          reports: [report]
        };
      } else {
        driversMap[report.driver_email].reports.push(report);
      }
    });

    return Object.values(driversMap).sort((a, b) => {
      // Sort by risk level, then by safety score
      const riskOrder = { critical_risk: 0, high_risk: 1, moderate_risk: 2, low_risk: 3 };
      const aRisk = riskOrder[a.latestReport.risk_level] || 4;
      const bRisk = riskOrder[b.latestReport.risk_level] || 4;
      
      if (aRisk !== bRisk) return aRisk - bRisk;
      return a.latestReport.overall_safety_score - b.latestReport.overall_safety_score;
    });
  }, [safetyReports]);

  const criticalDrivers = driverReports.filter(d => 
    d.latestReport.risk_level === 'critical_risk'
  );
  const highRiskDrivers = driverReports.filter(d => 
    d.latestReport.risk_level === 'high_risk'
  );

  const averageSafetyScore = driverReports.length > 0 
    ? driverReports.reduce((sum, d) => sum + d.latestReport.overall_safety_score, 0) / driverReports.length
    : 0;

  const totalCriticalEvents = safetyEvents.filter(e => e.severity === 'critical').length;

  const markReportReviewed = async (reportId) => {
    try {
      await base44.entities.DriverSafetyReport.update(reportId, {
        reviewed_by_management: true
      });
      toast.success("Report marked as reviewed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-900">{driverReports.length}</p>
            <p className="text-sm text-gray-600">Active Drivers</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-900">{averageSafetyScore.toFixed(0)}</p>
            <p className="text-sm text-gray-600">Avg Safety Score</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
            <p className="text-3xl font-bold text-red-900">{criticalDrivers.length}</p>
            <p className="text-sm text-gray-600">Critical Risk Drivers</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-orange-900">{totalCriticalEvents}</p>
            <p className="text-sm text-gray-600">Critical Events (30d)</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {criticalDrivers.length > 0 && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardHeader className="bg-red-100 border-b border-red-200">
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              🚨 Critical Risk Drivers - Immediate Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {criticalDrivers.map((driver) => (
              <Card key={driver.driverEmail} className="border-2 border-red-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{driver.driverName}</p>
                      <p className="text-sm text-gray-600">{driver.driverEmail}</p>
                    </div>
                    <Badge className="bg-red-600 text-white text-lg px-4 py-2">
                      Score: {driver.latestReport.overall_safety_score}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                    <div className="text-center p-2 bg-red-100 rounded">
                      <p className="font-bold text-red-900">{driver.latestReport.critical_events}</p>
                      <p className="text-xs text-gray-600">Critical Events</p>
                    </div>
                    <div className="text-center p-2 bg-orange-100 rounded">
                      <p className="font-bold text-orange-900">{driver.latestReport.high_severity_events}</p>
                      <p className="text-xs text-gray-600">High Severity</p>
                    </div>
                    <div className="text-center p-2 bg-yellow-100 rounded">
                      <p className="font-bold text-yellow-900">{driver.latestReport.total_events}</p>
                      <p className="text-xs text-gray-600">Total Events</p>
                    </div>
                  </div>

                  {driver.latestReport.training_recommended && driver.latestReport.training_recommended.length > 0 && (
                    <div className="p-2 bg-white rounded border border-red-200 mb-2">
                      <p className="text-xs font-semibold text-red-900 mb-1">Required Training:</p>
                      <ul className="text-xs text-red-800">
                        {driver.latestReport.training_recommended.map((training, idx) => (
                          <li key={idx}>• {training}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedDriver(driver)}
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      View Full Report
                    </Button>
                    {!driver.latestReport.reviewed_by_management && (
                      <Button
                        onClick={() => markReportReviewed(driver.latestReport.id)}
                        size="sm"
                        variant="outline"
                        className="border-green-300 text-green-700"
                      >
                        Mark Reviewed
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Driver Reports */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Driver Safety Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {driverReports.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No safety reports generated yet</p>
          ) : (
            <div className="space-y-3">
              {driverReports.map((driver) => (
                <Card 
                  key={driver.driverEmail}
                  className={`border-2 ${
                    driver.latestReport.risk_level === 'critical_risk' ? 'border-red-300 bg-red-50' :
                    driver.latestReport.risk_level === 'high_risk' ? 'border-orange-300 bg-orange-50' :
                    driver.latestReport.risk_level === 'moderate_risk' ? 'border-yellow-300 bg-yellow-50' :
                    'border-green-300 bg-green-50'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          driver.latestReport.overall_safety_score >= 90 ? 'bg-green-200' :
                          driver.latestReport.overall_safety_score >= 75 ? 'bg-blue-200' :
                          driver.latestReport.overall_safety_score >= 60 ? 'bg-yellow-200' :
                          'bg-red-200'
                        }`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{driver.driverName}</p>
                          <p className="text-sm text-gray-600">{driver.driverEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={
                          driver.latestReport.risk_level === 'critical_risk' ? 'bg-red-600' :
                          driver.latestReport.risk_level === 'high_risk' ? 'bg-orange-600' :
                          driver.latestReport.risk_level === 'moderate_risk' ? 'bg-yellow-600' :
                          'bg-green-600'
                        }>
                          {driver.latestReport.risk_level.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm mb-3">
                      <div className="text-center p-2 bg-white rounded">
                        <p className="font-bold text-blue-900">{driver.latestReport.overall_safety_score}</p>
                        <p className="text-xs text-gray-600">Safety Score</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="font-bold text-green-900">{driver.latestReport.safe_driving_streak_days}</p>
                        <p className="text-xs text-gray-600">Day Streak</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="font-bold text-purple-900">{driver.latestReport.total_events}</p>
                        <p className="text-xs text-gray-600">Total Events</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="font-bold text-orange-900">{driver.latestReport.high_severity_events}</p>
                        <p className="text-xs text-gray-600">High Severity</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="font-bold text-red-900">{driver.latestReport.critical_events}</p>
                        <p className="text-xs text-gray-600">Critical</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedDriver(driver)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        View Details
                      </Button>
                      {!driver.latestReport.reviewed_by_management && (
                        <Button
                          onClick={() => markReportReviewed(driver.latestReport.id)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Reviewed
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Driver Detail Modal */}
      {selectedDriver && (
        <Card className="border-2 border-blue-300 bg-white fixed inset-4 z-50 overflow-y-auto">
          <CardHeader className="bg-blue-50 border-b border-blue-200 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-900">
                Safety Report: {selectedDriver.driverName}
              </CardTitle>
              <Button
                onClick={() => setSelectedDriver(null)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Report Period:</p>
                <p className="font-semibold">
                  {format(new Date(selectedDriver.latestReport.report_period_start), "MMM d")} - 
                  {format(new Date(selectedDriver.latestReport.report_period_end), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Generated:</p>
                <p className="font-semibold">
                  {format(new Date(selectedDriver.latestReport.generated_at), "MMM d 'at' h:mm a")}
                </p>
              </div>
            </div>

            {selectedDriver.latestReport.strengths && selectedDriver.latestReport.strengths.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-900">✅ Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {selectedDriver.latestReport.strengths.map((strength, idx) => (
                      <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {selectedDriver.latestReport.areas_for_improvement && selectedDriver.latestReport.areas_for_improvement.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-orange-900">⚠️ Areas for Improvement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {selectedDriver.latestReport.areas_for_improvement.map((area, idx) => (
                      <li key={idx} className="text-sm text-orange-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {selectedDriver.latestReport.ai_recommendations && selectedDriver.latestReport.ai_recommendations.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-900">🎯 AI Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {selectedDriver.latestReport.ai_recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                        <span className="font-bold">{idx + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {selectedDriver.latestReport.training_recommended && selectedDriver.latestReport.training_recommended.length > 0 && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-purple-900">📚 Recommended Training</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {selectedDriver.latestReport.training_recommended.map((training, idx) => (
                      <li key={idx} className="text-sm text-purple-800">
                        • {training}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}