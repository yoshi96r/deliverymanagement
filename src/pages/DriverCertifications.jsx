import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Award, Plus, Upload, CheckCircle2, AlertTriangle,
  Clock, FileText, Calendar, Shield
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DriverCertifications() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [newCert, setNewCert] = useState({
    certification_type: "defensive_driving",
    issue_date: new Date().toISOString().split('T')[0],
    expiration_date: ""
  });

  const queryClient = useQueryClient();

  const { data: certifications } = useQuery({
    queryKey: ['driverCertifications'],
    queryFn: () => base44.entities.DriverCertification.list('-issue_date'),
    initialData: [],
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
    initialData: [],
  });

  const addCertMutation = useMutation({
    mutationFn: async (certData) => {
      const expirationDate = new Date(certData.expiration_date);
      const daysUntil = differenceInDays(expirationDate, new Date());
      
      let status = "active";
      if (daysUntil < 0) status = "expired";
      else if (daysUntil <= 30) status = "expiring_soon";

      return await base44.entities.DriverCertification.create({
        ...certData,
        days_until_expiration: daysUntil,
        status: status,
        certificate_number: `CERT-${Date.now()}`,
        verification_status: "pending"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverCertifications'] });
      setShowAddDialog(false);
      setNewCert({
        certification_type: "defensive_driving",
        issue_date: new Date().toISOString().split('T')[0],
        expiration_date: ""
      });
      toast.success("Certification added!");
    },
  });

  const filteredCerts = certifications.filter(cert => {
    if (filterStatus === "all") return true;
    return cert.status === filterStatus;
  });

  const expiringCount = certifications.filter(c => c.status === "expiring_soon").length;
  const expiredCount = certifications.filter(c => c.status === "expired").length;
  const activeCount = certifications.filter(c => c.status === "active").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Award className="w-10 h-10 text-blue-600" />
              Driver Certifications
            </h1>
            <p className="text-gray-600 mt-1">Track and manage driver certifications & training</p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 h-12"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Certification
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">{activeCount}</p>
              <p className="text-sm text-gray-600">Active & Valid</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-yellow-600 mb-2" />
              <p className="text-3xl font-bold text-yellow-900">{expiringCount}</p>
              <p className="text-sm text-gray-600">Expiring Soon (30 days)</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
              <p className="text-3xl font-bold text-red-900">{expiredCount}</p>
              <p className="text-sm text-gray-600">Expired - Action Needed</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <Award className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{certifications.length}</p>
              <p className="text-sm text-gray-600">Total Certifications</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="border-2 border-gray-200 mb-6">
          <CardContent className="p-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Certifications</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Certifications List */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Certifications ({filteredCerts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredCerts.length === 0 ? (
              <div className="text-center py-12">
                <Award className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No certifications found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCerts.map((cert) => (
                  <Card key={cert.id} className={`border-2 ${
                    cert.status === 'expired' ? 'border-red-300 bg-red-50' :
                    cert.status === 'expiring_soon' ? 'border-yellow-300 bg-yellow-50' :
                    'border-gray-200'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-900 text-lg">
                              {cert.certification_type.replace(/_/g, ' ')}
                            </h4>
                            <Badge className={
                              cert.status === 'active' ? 'bg-green-600' :
                              cert.status === 'expiring_soon' ? 'bg-yellow-600' :
                              cert.status === 'expired' ? 'bg-red-600' :
                              'bg-gray-600'
                            }>
                              {cert.status.replace(/_/g, ' ')}
                            </Badge>
                            {cert.required_for_job && (
                              <Badge variant="outline" className="border-red-300 text-red-700">
                                Required
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Driver</p>
                              <p className="font-semibold">{cert.driver_name}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Issued</p>
                              <p className="font-semibold">
                                {format(new Date(cert.issue_date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Expires</p>
                              <p className={`font-semibold ${
                                cert.status === 'expired' ? 'text-red-900' :
                                cert.status === 'expiring_soon' ? 'text-yellow-900' :
                                'text-gray-900'
                              }`}>
                                {cert.expiration_date 
                                  ? format(new Date(cert.expiration_date), "MMM d, yyyy")
                                  : "No expiration"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Days Until Expiration</p>
                              <p className={`font-bold ${
                                cert.days_until_expiration < 0 ? 'text-red-900' :
                                cert.days_until_expiration <= 30 ? 'text-yellow-900' :
                                'text-green-900'
                              }`}>
                                {cert.days_until_expiration < 0 
                                  ? `EXPIRED ${Math.abs(cert.days_until_expiration)} days ago`
                                  : `${cert.days_until_expiration} days`}
                              </p>
                            </div>
                          </div>

                          {cert.status === 'expiring_soon' && (
                            <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                              <p className="text-sm font-semibold text-yellow-900">
                                ⚠️ Renewal required within {cert.days_until_expiration} days
                              </p>
                            </div>
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

        {/* Add Certification Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Certification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Driver *</Label>
                <Select
                  value={newCert.driver_email}
                  onValueChange={(v) => {
                    const driver = drivers.find(d => d.email === v);
                    setNewCert({
                      ...newCert, 
                      driver_email: v,
                      driver_name: driver?.full_name
                    });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.email}>
                        {driver.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Certification Type *</Label>
                <Select
                  value={newCert.certification_type}
                  onValueChange={(v) => setNewCert({...newCert, certification_type: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defensive_driving">Defensive Driving</SelectItem>
                    <SelectItem value="hazmat">Hazmat Handling</SelectItem>
                    <SelectItem value="first_aid_cpr">First Aid & CPR</SelectItem>
                    <SelectItem value="forklift">Forklift Operation</SelectItem>
                    <SelectItem value="customer_service">Customer Service</SelectItem>
                    <SelectItem value="winter_driving">Winter Driving</SelectItem>
                    <SelectItem value="dot_compliance">DOT Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Issue Date *</Label>
                  <Input
                    type="date"
                    value={newCert.issue_date}
                    onChange={(e) => setNewCert({...newCert, issue_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Expiration Date *</Label>
                  <Input
                    type="date"
                    value={newCert.expiration_date}
                    onChange={(e) => setNewCert({...newCert, expiration_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Upload Certificate</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={() => addCertMutation.mutate(newCert)}
                disabled={!newCert.driver_email || !newCert.expiration_date || addCertMutation.isPending}
                className="w-full bg-blue-600"
              >
                {addCertMutation.isPending ? "Adding..." : "Add Certification"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}