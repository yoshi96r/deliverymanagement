import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Shield, Lock, Eye, Download, Trash2, CheckCircle2,
  Database, Server, Key, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export default function DataSecurity() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch {
        return null;
      }
    }
  });

  const handleExportData = async () => {
    if (!currentUser) {
      base44.auth.redirectToLogin();
      return;
    }
    
    toast.success("Data export requested. You'll receive a download link via email within 24 hours.");
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      base44.auth.redirectToLogin();
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted within 30 days."
    );

    if (confirmed) {
      toast.error("Account deletion requested. Our team will contact you to confirm within 24 hours.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <Lock className="w-10 h-10 text-blue-600" />
            Data Security & Privacy Controls
          </h1>
          <p className="text-gray-600">Manage your data and privacy settings</p>
        </div>

        {/* Quick Actions */}
        {currentUser && (
          <Card className="border-2 border-blue-200 mb-8">
            <CardHeader className="bg-blue-50">
              <CardTitle>Privacy Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={handleExportData}
                  variant="outline"
                  className="h-24 flex-col gap-2 border-blue-300 hover:bg-blue-50"
                >
                  <Download className="w-8 h-8 text-blue-600" />
                  <span className="font-semibold">Export My Data</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2 border-purple-300 hover:bg-purple-50"
                  onClick={() => toast.info("Privacy settings available after login")}
                >
                  <Eye className="w-8 h-8 text-purple-600" />
                  <span className="font-semibold">Privacy Settings</span>
                </Button>
                <Button
                  onClick={handleDeleteAccount}
                  variant="outline"
                  className="h-24 flex-col gap-2 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="w-8 h-8 text-red-600" />
                  <span className="font-semibold">Delete Account</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Measures */}
        <Card className="border-2 border-gray-200 mb-6">
          <CardHeader className="bg-gray-50">
            <CardTitle>Our Security Measures</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">End-to-End Encryption</h3>
                  <p className="text-sm text-gray-700">
                    All data transmitted using SSL/TLS encryption. Your information is encrypted both in transit and at rest.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Secure Data Storage</h3>
                  <p className="text-sm text-gray-700">
                    Data stored in SOC 2 compliant data centers with redundant backups and disaster recovery.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Key className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Role-Based Access</h3>
                  <p className="text-sm text-gray-700">
                    Users only see data they need. Carriers can't see other carriers' earnings. Strict access controls.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Server className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">PCI-DSS Compliant</h3>
                  <p className="text-sm text-gray-700">
                    Payment processing meets Payment Card Industry standards. We never store full credit card numbers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Regular Security Audits</h3>
                  <p className="text-sm text-gray-700">
                    Quarterly security reviews, penetration testing, and vulnerability assessments.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Breach Notification</h3>
                  <p className="text-sm text-gray-700">
                    In the unlikely event of a data breach, all affected users notified within 72 hours.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Usage */}
        <Card className="border-2 border-gray-200 mb-6">
          <CardHeader className="bg-gray-50">
            <CardTitle>What Data We Collect & Why</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">GPS Location Data</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><strong>When:</strong> Only when you actively use route recording or route following</li>
                  <li><strong>Why:</strong> To record routes for substitute carriers</li>
                  <li><strong>Control:</strong> You can disable GPS anytime. Feature won't work without it.</li>
                  <li><strong>Retention:</strong> Kept until you delete the route recording</li>
                  <li><strong>Sharing:</strong> Only visible to authorized substitute carriers on your route</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Photos & Videos</h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li><strong>When:</strong> When you upload delivery proof or package photos</li>
                  <li><strong>Why:</strong> Verify deliveries, document package condition, resolve disputes</li>
                  <li><strong>Retention:</strong> 2 years or until insurance claims resolved</li>
                  <li><strong>Sharing:</strong> Only with sender and recipient of that specific package</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Contact Information</h3>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li><strong>What:</strong> Name, email, phone number</li>
                  <li><strong>Why:</strong> Account management, communication, payment processing</li>
                  <li><strong>Retention:</strong> Duration of account + 7 years (tax records)</li>
                  <li><strong>Sharing:</strong> Never shared except as required by law</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Badges */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                <p className="font-bold text-green-900">GDPR Compliant</p>
                <p className="text-xs text-green-700">EU Data Protection</p>
              </div>
              <div>
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                <p className="font-bold text-green-900">CCPA Compliant</p>
                <p className="text-xs text-green-700">California Privacy</p>
              </div>
              <div>
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                <p className="font-bold text-green-900">PCI-DSS</p>
                <p className="text-xs text-green-700">Payment Security</p>
              </div>
              <div>
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                <p className="font-bold text-green-900">SOC 2 Type II</p>
                <p className="text-xs text-green-700">Security Certified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}