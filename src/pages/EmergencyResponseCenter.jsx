
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, Phone, MapPin, User, Truck,
  CheckCircle2, Clock, Shield, Ambulance, Radio
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EmergencyResponseCenter() {
  const [showReportDialog, setShowReportDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: activeIncidents } = useQuery({
    queryKey: ['emergencyIncidents'],
    queryFn: () => base44.entities.EmergencyIncident.filter({ 
      status: ['active', 'responding', 'on_scene']
    }),
    initialData: [],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: allIncidents } = useQuery({
    queryKey: ['allEmergencyIncidents'],
    queryFn: () => base44.entities.EmergencyIncident.list('-reported_at', 50),
    initialData: [],
  });

  const getSeverityColor = (severity) => {
    const colors = {
      life_threatening: "bg-red-600",
      critical: "bg-red-500",
      serious: "bg-orange-600",
      moderate: "bg-yellow-600"
    };
    return colors[severity] || "bg-gray-600";
  };

  const getIncidentIcon = (type) => {
    const icons = {
      medical_emergency: Ambulance,
      vehicle_breakdown: Truck,
      severe_accident: AlertTriangle,
      security_threat: Shield,
      driver_distress: User
    };
    return icons[type] || AlertTriangle;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-red-900 mb-2 flex items-center gap-3">
                <AlertTriangle className="w-10 h-10 animate-pulse" />
                Emergency Response Center
              </h1>
              <p className="text-red-600">Real-time emergency incident management</p>
            </div>
            {activeIncidents.length > 0 && (
              <Badge className="bg-red-600 text-white text-lg px-6 py-3 animate-pulse">
                {activeIncidents.length} ACTIVE INCIDENT{activeIncidents.length !== 1 ? 'S' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Critical Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2 animate-pulse" />
              <p className="text-3xl font-bold text-red-900">{activeIncidents.length}</p>
              <p className="text-sm text-gray-600">Active Incidents</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Ambulance className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">
                {activeIncidents.filter(i => i.severity === 'life_threatening' || i.severity === 'critical').length}
              </p>
              <p className="text-sm text-gray-600">Critical Severity</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-yellow-600 mb-2" />
              <p className="text-3xl font-bold text-yellow-900">
                {activeIncidents.filter(i => i.status === 'responding').length}
              </p>
              <p className="text-sm text-gray-600">Response En Route</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">
                {allIncidents.filter(i => {
                  const today = new Date().toDateString();
                  return i.status === 'resolved' && new Date(i.resolved_at).toDateString() === today;
                }).length}
              </p>
              <p className="text-sm text-gray-600">Resolved Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <Card className="border-2 border-red-300 bg-red-50 mb-8 animate-pulse">
            <CardHeader className="bg-red-600">
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                🚨 ACTIVE EMERGENCY INCIDENTS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {activeIncidents.map((incident) => {
                  const Icon = getIncidentIcon(incident.incident_type);
                  return (
                    <Card key={incident.id} className="border-2 border-red-400 bg-white">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getSeverityColor(incident.severity)}`}>
                            <Icon className="w-8 h-8 text-white" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-xl text-gray-900 mb-1">
                                  {incident.incident_type.replace(/_/g, ' ').toUpperCase()}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {formatDistanceToNow(new Date(incident.reported_at), { addSuffix: true })}
                                </p>
                              </div>
                              <Badge className={`${getSeverityColor(incident.severity)} text-white text-lg px-4 py-2`}>
                                {incident.severity.replace(/_/g, ' ').toUpperCase()}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Driver</p>
                                <p className="font-semibold text-gray-900">{incident.driver_name}</p>
                              </div>
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Vehicle</p>
                                <p className="font-semibold text-gray-900">{incident.vehicle_id}</p>
                              </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg mb-4">
                              <p className="text-sm text-gray-900">{incident.description}</p>
                            </div>

                            {incident.location_address && (
                              <div className="flex items-start gap-2 mb-4">
                                <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">Location</p>
                                  <p className="text-sm text-gray-700">{incident.location_address}</p>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button size="sm" className="bg-red-600">
                                <Phone className="w-4 h-4 mr-1" />
                                Contact Driver
                              </Button>
                              <Button size="sm" variant="outline">
                                <MapPin className="w-4 h-4 mr-1" />
                                View Location
                              </Button>
                              {incident.emergency_services_called && (
                                <Badge className="bg-blue-600 flex items-center gap-1 px-3">
                                  <Ambulance className="w-4 h-4" />
                                  Emergency Services Called
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Incident History */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Recent Incidents</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {allIncidents.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No emergency incidents recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allIncidents.map((incident) => (
                  <Card key={incident.id} className={`border-2 ${
                    incident.status === 'active' ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-900">
                              {incident.incident_type.replace(/_/g, ' ')}
                            </h4>
                            <Badge className={getSeverityColor(incident.severity)}>
                              {incident.severity}
                            </Badge>
                            <Badge variant="outline">{incident.status}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Driver</p>
                              <p className="font-semibold">{incident.driver_name}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Reported</p>
                              <p className="font-semibold">
                                {format(new Date(incident.reported_at), "MMM d, h:mm a")}
                              </p>
                            </div>
                            {incident.resolved_at && (
                              <div>
                                <p className="text-gray-600">Resolved</p>
                                <p className="font-semibold">
                                  {format(new Date(incident.resolved_at), "MMM d, h:mm a")}
                                </p>
                              </div>
                            )}
                          </div>
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
