import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, Download, Calendar, BarChart3, 
  TrendingUp, Users, Package, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ReportsHub() {
  const [reportType, setReportType] = useState("delivery_summary");
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);

  const queryClient = useQueryClient();

  const { data: reports } = useQuery({
    queryKey: ['analyticsReports'],
    queryFn: () => base44.entities.AnalyticsReport.list('-generated_at', 50),
    initialData: [],
  });

  const generateReportMutation = useMutation({
    mutationFn: async ({ type, start, end }) => {
      setGenerating(true);

      // Fetch relevant data based on report type
      let reportData = {};
      
      if (type === 'delivery_summary') {
        const deliveries = await base44.entities.DeliveryRequest.list('-created_date', 1000);
        const periodDeliveries = deliveries.filter(d => {
          const date = new Date(d.created_date);
          return date >= new Date(start) && date <= new Date(end);
        });

        reportData = {
          total_deliveries: periodDeliveries.length,
          completed: periodDeliveries.filter(d => d.status === 'delivered').length,
          exceptions: periodDeliveries.filter(d => d.has_active_exception).length,
          average_value: periodDeliveries.reduce((sum, d) => sum + (d.package_value || 0), 0) / periodDeliveries.length
        };
      } else if (type === 'driver_performance') {
        const metrics = await base44.entities.DriverPerformanceMetrics.list();
        reportData = {
          total_drivers: metrics.length,
          avg_performance: metrics.reduce((sum, m) => sum + (m.overall_performance_score || 0), 0) / metrics.length,
          top_performers: metrics.slice(0, 5)
        };
      } else if (type === 'financial') {
        const earnings = await base44.entities.CarrierEarnings.list();
        const periodEarnings = earnings.filter(e => {
          const date = new Date(e.earned_date);
          return date >= new Date(start) && date <= new Date(end);
        });

        reportData = {
          total_earnings: periodEarnings.reduce((sum, e) => sum + e.amount_earned, 0),
          total_payments: periodEarnings.length,
          avg_per_delivery: periodEarnings.reduce((sum, e) => sum + e.amount_earned, 0) / periodEarnings.length
        };
      }

      const report = await base44.entities.AnalyticsReport.create({
        report_name: `${type.replace(/_/g, ' ')} - ${format(new Date(start), 'MMM d')} to ${format(new Date(end), 'MMM d')}`,
        report_type: type,
        period_start: start,
        period_end: end,
        data_summary: reportData,
        export_format: "pdf",
        generated_by: "Admin",
        generated_at: new Date().toISOString()
      });

      setGenerating(false);
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyticsReports'] });
      toast.success("Report generated!");
    },
  });

  const handleGenerate = () => {
    generateReportMutation.mutate({
      type: reportType,
      start: startDate,
      end: endDate
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-blue-600" />
            Reports & Analytics Hub
          </h1>
          <p className="text-gray-600">Generate and export comprehensive reports</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Generator */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-900">Generate New Report</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery_summary">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Delivery Summary
                        </div>
                      </SelectItem>
                      <SelectItem value="driver_performance">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Driver Performance
                        </div>
                      </SelectItem>
                      <SelectItem value="financial">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Financial Report
                        </div>
                      </SelectItem>
                      <SelectItem value="compliance">DOT Compliance</SelectItem>
                      <SelectItem value="safety">Safety Analysis</SelectItem>
                      <SelectItem value="customer_satisfaction">Customer Satisfaction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Reports */}
          <div>
            <Card className="border-2 border-gray-200">
              <CardHeader className="bg-gray-50">
                <CardTitle>Recent Reports</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {reports.map((report) => (
                    <Card key={report.id} className="border">
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm text-gray-900 mb-1">
                          {report.report_name}
                        </p>
                        <p className="text-xs text-gray-600 mb-2">
                          {format(new Date(report.generated_at), "MMM d, h:mm a")}
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}