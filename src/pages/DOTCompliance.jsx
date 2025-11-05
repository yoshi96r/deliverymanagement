import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, AlertTriangle, CheckCircle2, FileText,
  Calendar, Truck, User, ClipboardCheck
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

export default function DOTCompliance() {
  const queryClient = useQueryClient();

  const { data: complianceRecords } = useQuery({
    queryKey: ['dotCompliance'],
    queryFn: () => base44.entities.DOTCompliance.list('-expiration_date'),
    initialData: [],
  });

  const { data: inspections } = useQuery({
    queryKey: ['dotInspections'],
    queryFn: () => base44.entities.DOTInspection.list('-inspection_date', 100),
    initialData: [],
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
    initialData: [],
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.DriverVehicle.list(),
    initialData: [],
  });

  // Calculate compliance status
  const complianceStats = useMemo(() => {
    const total = complianceRecords.length;
    const compliant = complianceRecords.filter(r => r.status === 'compliant').length;
    const expiringSoon = complianceRecords.filter(r => 
      r.status === 'expiring_soon' && r.days_until_expiration <= 30
    ).length;
    const expired = complianceRecords.filter(r => r.status === 'expired').length;
    const notCompliant = complianceRecords.filter(r => r.status === 'not_compliant').length;

    return { total, compliant, expiringSoon, expired, notCompliant };
  }, [complianceRecords]);

  const recentInspections = useMemo(() => {
    return inspections.slice(0, 10);
  }, [inspections]);

  const failedInspections = inspections.filter(i => 
    i.overall_result === 'failed' || i.overall_result === 'out_of_service'
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-red-600" />
            DOT Compliance & Safety
          </h1>
          <p className="text-gray-600">Federal compliance tracking and management</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Compliant</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{complianceStats.compliant}</p>
                </div>
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Expiring Soon</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{complianceStats.expiringSoon}</p>
                </div>
                <Calendar className="w-12 h-12 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Expired</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{complianceStats.expired}</p>
                </div>
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Inspections</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{inspections.length}</p>
                </div>
                <ClipboardCheck className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Failed</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{failedInspections}</p>
                </div>
                <FileText className="w-12 h-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="compliance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-md">
            <TabsTrigger value="compliance">
              <Shield className="w-4 h-4 mr-2" />
              Compliance Items
            </TabsTrigger>
            <TabsTrigger value="inspections">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Inspections
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compliance" className="space-y-4">
            {complianceRecords.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No compliance records found</p>
                </CardContent>
              </Card>
            ) : (
              complianceRecords.map((record) => (
                <Card key={record.id} className={`border-2 ${
                  record.status === 'expired' ? 'border-red-300 bg-red-50' :
                  record.status === 'expiring_soon' ? 'border-orange-300 bg-orange-50' :
                  record.status === 'compliant' ? 'border-green-200' :
                  'border-gray-200'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{record.entity_name}</h3>
                        <p className="text-sm text-gray-600">{record.compliance_item}</p>
                      </div>
                      <Badge className={
                        record.status === 'compliant' ? 'bg-green-600' :
                        record.status === 'expiring_soon' ? 'bg-orange-600' :
                        record.status === 'expired' ? 'bg-red-600' :
                        'bg-gray-600'
                      }>
                        {record.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Type</p>
                        <p className="font-semibold text-gray-900">{record.requirement_type.replace(/_/g, ' ')}</p>
                      </div>
                      {record.expiration_date && (
                        <div>
                          <p className="text-gray-600">Expires</p>
                          <p className="font-semibold text-gray-900">
                            {format(new Date(record.expiration_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                      {record.certificate_number && (
                        <div>
                          <p className="text-gray-600">Certificate #</p>
                          <p className="font-semibold text-gray-900">{record.certificate_number}</p>
                        </div>
                      )}
                      {record.issuing_authority && (
                        <div>
                          <p className="text-gray-600">Issued By</p>
                          <p className="font-semibold text-gray-900">{record.issuing_authority}</p>
                        </div>
                      )}
                    </div>

                    {record.status === 'expiring_soon' && record.days_until_expiration && (
                      <div className="mt-3 p-2 bg-orange-100 rounded border border-orange-300">
                        <p className="text-sm font-semibold text-orange-900">
                          ⚠️ Expires in {record.days_until_expiration} days - renewal required
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="inspections">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-900">Recent DOT Inspections</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {recentInspections.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No inspections recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentInspections.map((inspection) => (
                      <Card key={inspection.id} className={`border-2 ${
                        inspection.overall_result === 'failed' || inspection.overall_result === 'out_of_service'
                          ? 'border-red-300 bg-red-50'
                          : inspection.overall_result === 'passed'
                          ? 'border-green-200'
                          : 'border-gray-200'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900">
                                {inspection.inspection_type.replace(/_/g, ' ')} - {inspection.vehicle_number}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {format(new Date(inspection.inspection_date), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                              <p className="text-sm text-gray-600">Inspector: {inspection.inspector_name}</p>
                            </div>
                            <Badge className={
                              inspection.overall_result === 'passed' ? 'bg-green-600' :
                              inspection.overall_result === 'failed' ? 'bg-red-600' :
                              inspection.overall_result === 'out_of_service' ? 'bg-red-800' :
                              'bg-orange-600'
                            }>
                              {inspection.overall_result.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          {inspection.violations_found && inspection.violations_found.length > 0 && (
                            <div className="mt-3 p-2 bg-red-100 rounded border border-red-200">
                              <p className="text-sm font-semibold text-red-900 mb-1">
                                {inspection.violations_found.length} Violation(s) Found:
                              </p>
                              <ul className="text-sm text-red-800 space-y-1">
                                {inspection.violations_found.map((v, idx) => (
                                  <li key={idx}>• {v.violation_description}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {inspection.out_of_service_order && (
                            <div className="mt-2 p-2 bg-red-200 rounded border border-red-400">
                              <p className="text-sm font-bold text-red-900">
                                🚫 OUT OF SERVICE ORDER
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card className="border-2 border-red-200">
              <CardHeader className="bg-red-50">
                <CardTitle className="text-red-900">Compliance Alerts</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {complianceRecords
                    .filter(r => r.status === 'expired' || r.status === 'expiring_soon')
                    .map((record) => (
                      <Card key={record.id} className="border-2 border-orange-300 bg-orange-50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900">{record.entity_name}</h4>
                              <p className="text-sm text-gray-700 mt-1">
                                {record.compliance_item} - {record.requirement_type.replace(/_/g, ' ')}
                              </p>
                              {record.expiration_date && (
                                <p className="text-sm text-orange-900 mt-2 font-semibold">
                                  {record.status === 'expired' 
                                    ? `Expired ${differenceInDays(new Date(), new Date(record.expiration_date))} days ago`
                                    : `Expires in ${record.days_until_expiration} days`
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}