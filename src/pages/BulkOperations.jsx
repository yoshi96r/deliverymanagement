import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Zap, Package, Users, Download, Upload, 
  CheckCircle2, AlertTriangle, Clock, FileText
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BulkOperations() {
  const [operationType, setOperationType] = useState("bulk_assign_driver");
  const [entityType, setEntityType] = useState("DeliveryRequest");
  const [filterConfig, setFilterConfig] = useState({});

  const queryClient = useQueryClient();

  const { data: operations } = useQuery({
    queryKey: ['bulkOperations'],
    queryFn: () => base44.entities.BulkOperation.list('-started_at', 50),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveriesCount'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date', 1000),
    initialData: [],
  });

  const bulkExportMutation = useMutation({
    mutationFn: async ({ entityType, filters }) => {
      const operation = await base44.entities.BulkOperation.create({
        operation_name: `Export ${entityType}`,
        operation_type: "bulk_export",
        entity_type: entityType,
        total_records: 0,
        status: "in_progress",
        started_at: new Date().toISOString(),
        initiated_by: "Admin",
        filters_applied: filters
      });

      // Simulate export
      toast.success("Export started! Download will be ready shortly.");
      
      return operation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulkOperations'] });
    },
  });

  const quickExports = [
    { label: "All Deliveries", entity: "DeliveryRequest", icon: Package, color: "blue" },
    { label: "All Drivers", entity: "Driver", icon: Users, color: "green" },
    { label: "Payment Records", entity: "CarrierEarnings", icon: FileText, color: "purple" },
    { label: "Exception Reports", entity: "DeliveryException", icon: AlertTriangle, color: "red" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Zap className="w-10 h-10 text-indigo-600" />
            Bulk Operations
          </h1>
          <p className="text-gray-600">Perform actions on multiple records at once</p>
        </div>

        {/* Quick Export Actions */}
        <Card className="border-2 border-indigo-200 mb-8">
          <CardHeader className="bg-indigo-50">
            <CardTitle className="text-indigo-900">Quick Exports</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickExports.map((exp) => {
                const Icon = exp.icon;
                return (
                  <Card 
                    key={exp.entity}
                    className={`border-2 border-${exp.color}-200 cursor-pointer hover:shadow-lg transition-all`}
                    onClick={() => bulkExportMutation.mutate({ entityType: exp.entity, filters: {} })}
                  >
                    <CardContent className="p-6 text-center">
                      <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-${exp.color}-100 flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 text-${exp.color}-600`} />
                      </div>
                      <p className="font-semibold text-gray-900 mb-2">{exp.label}</p>
                      <Button size="sm" className={`bg-${exp.color}-600 w-full`}>
                        <Download className="w-4 h-4 mr-1" />
                        Export CSV
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Operation History */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Recent Operations</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {operations.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No bulk operations yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {operations.map((op) => (
                  <Card key={op.id} className="border-2 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{op.operation_name}</h4>
                          <p className="text-sm text-gray-600">
                            {op.operation_type.replace(/_/g, ' ')} • {op.entity_type}
                          </p>
                          {op.started_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(op.started_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge className={
                            op.status === 'completed' ? 'bg-green-600' :
                            op.status === 'in_progress' ? 'bg-blue-600' :
                            op.status === 'failed' ? 'bg-red-600' :
                            'bg-gray-600'
                          }>
                            {op.status}
                          </Badge>
                          {op.status === 'completed' && (
                            <p className="text-sm text-gray-600 mt-2">
                              {op.successful_records}/{op.total_records} success
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}