
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, Shield, FileText, Clock,
  CheckCircle2, Package
} from "lucide-react";
import { format } from "date-fns";

export default function IncidentManagement() {
  const { data: incidents } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.IncidentReport.list('-incident_date', 100),
    initialData: [],
  });

  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;
  const openIncidents = incidents.filter(i => i.status !== 'closed').length;
  const withInjuries = incidents.filter(i => i.injuries_reported).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <AlertTriangle className="w-10 h-10 text-red-600" />
            Incident Management
          </h1>
          <p className="text-gray-600">Track accidents, injuries, and safety incidents</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
              <p className="text-3xl font-bold text-red-900">{incidents.length}</p>
              <p className="text-sm text-gray-600">Total Incidents</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{openIncidents}</p>
              <p className="text-sm text-gray-600">Under Investigation</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Shield className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">{criticalIncidents}</p>
              <p className="text-sm text-gray-600">Critical</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <FileText className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{withInjuries}</p>
              <p className="text-sm text-gray-600">With Injuries</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Incident Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {incidents.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
                <p className="text-gray-600">No incidents reported</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <Card key={incident.id} className={`border-2 ${
                    incident.severity === 'critical' ? 'border-red-400 bg-red-50' :
                    incident.severity === 'serious' ? 'border-orange-300 bg-orange-50' :
                    'border-gray-200'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-gray-900">{incident.incident_number}</h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(incident.incident_date), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={
                            incident.severity === 'critical' ? 'bg-red-600' :
                            incident.severity === 'serious' ? 'bg-orange-600' :
                            incident.severity === 'moderate' ? 'bg-yellow-600' :
                            'bg-blue-600'
                          }>
                            {incident.severity}
                          </Badge>
                          <Badge variant="outline">{incident.incident_type.replace(/_/g, ' ')}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                        <div>
                          <p className="text-gray-600">Driver</p>
                          <p className="font-semibold">{incident.driver_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Location</p>
                          <p className="font-semibold">{incident.location}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Status</p>
                          <Badge className={
                            incident.status === 'closed' ? 'bg-green-600' :
                            'bg-orange-600'
                          }>
                            {incident.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-sm text-gray-800 mb-2">{incident.description}</p>

                      {incident.injuries_reported && (
                        <div className="p-2 bg-red-100 rounded border border-red-300">
                          <p className="text-sm font-bold text-red-900">⚠️ Injuries Reported</p>
                        </div>
                      )}

                      {incident.police_report_filed && (
                        <div className="mt-2 p-2 bg-blue-100 rounded border border-blue-300">
                          <p className="text-xs font-semibold text-blue-900">
                            Police Report: {incident.police_report_number}
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
      </div>
    </div>
  );
}
