import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function PrivacyPolicy() {
  const handleDataExport = () => {
    base44.auth.redirectToLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-blue-600" />
            Privacy Policy
          </h1>
          <p className="text-gray-600">Last Updated: November 4, 2025</p>
        </div>

        <Card className="border-2 border-blue-200 mb-6">
          <CardHeader className="bg-blue-50">
            <CardTitle>Your Privacy Rights</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <Eye className="w-6 h-6 text-green-600 mb-2" />
                <h3 className="font-bold text-green-900 mb-1">Access Your Data</h3>
                <p className="text-sm text-green-800">Request a copy of all data we have about you</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Download className="w-6 h-6 text-blue-600 mb-2" />
                <h3 className="font-bold text-blue-900 mb-1">Export Your Data</h3>
                <p className="text-sm text-blue-800">Download all your information in portable format</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <Lock className="w-6 h-6 text-purple-600 mb-2" />
                <h3 className="font-bold text-purple-900 mb-1">Opt-Out Options</h3>
                <p className="text-sm text-purple-800">Control what data is collected and how it's used</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <Trash2 className="w-6 h-6 text-red-600 mb-2" />
                <h3 className="font-bold text-red-900 mb-1">Delete Your Account</h3>
                <p className="text-sm text-red-800">Request complete deletion of your information</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="prose prose-lg max-w-none space-y-6">
          <Card className="border-2 border-gray-200">
            <CardContent className="p-8 space-y-6">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3">For Carriers (USPS Employees)</h3>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Contact Information:</strong> Name, email, phone number</li>
                  <li><strong>Route Data:</strong> GPS coordinates, route recordings, stop locations (for route recording feature)</li>
                  <li><strong>Earnings Data:</strong> Payment amounts, delivery completion data</li>
                  <li><strong>Photos/Videos:</strong> Delivery proof images and videos you upload</li>
                  <li><strong>Location Data:</strong> Real-time GPS when using route following (only with your permission)</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">For Customers</h3>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Contact Information:</strong> Name, email, phone, delivery address</li>
                  <li><strong>Signature Data:</strong> Digital signatures for package acceptance</li>
                  <li><strong>Delivery Preferences:</strong> Preferred delivery times, special instructions</li>
                  <li><strong>Photos:</strong> Delivery proof photos (house number, package location)</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">For Businesses</h3>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Business Information:</strong> Company name, tax ID, address</li>
                  <li><strong>Payment Information:</strong> Credit card (last 4 digits only) or bank account info</li>
                  <li><strong>Shipping Data:</strong> Package details, tracking numbers, shipment history</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Facilitate signature verification and package delivery</li>
                  <li>Enable GPS route recording and playback for substitute carriers</li>
                  <li>Process payments to carriers for verified deliveries</li>
                  <li>Send delivery notifications to customers</li>
                  <li>Provide customer support and resolve delivery issues</li>
                  <li>Improve our services through analytics (anonymized data only)</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Data Sharing & Disclosure</h2>
                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200 mb-4">
                  <p className="font-bold text-green-900 mb-2">✓ WE NEVER SELL YOUR DATA</p>
                  <p className="text-sm text-green-800">
                    Your information is yours. We will never sell, rent, or trade your personal data to third parties for marketing purposes.
                  </p>
                </div>

                <p className="text-gray-700 mb-3">We only share data when:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>With Carriers:</strong> Customer delivery addresses and signatures (necessary for delivery)</li>
                  <li><strong>With Customers:</strong> Carrier name and delivery proof photos</li>
                  <li><strong>With Payment Processors:</strong> Minimal payment info to process transactions (PCI-compliant)</li>
                  <li><strong>Legal Requirements:</strong> When required by law enforcement or court order</li>
                  <li><strong>Service Providers:</strong> Cloud hosting, SMS providers (under strict confidentiality agreements)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. GPS & Location Data</h2>
                <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200 mb-4">
                  <p className="font-bold text-yellow-900 mb-2">📍 Location Tracking Transparency</p>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• GPS tracking is <strong>OPTIONAL</strong> and requires your explicit permission</li>
                    <li>• Used only for route recording and route following features</li>
                    <li>• You can disable GPS tracking anytime in settings</li>
                    <li>• Location data is encrypted and never shared with advertisers</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Encryption:</strong> All data transmitted using SSL/TLS encryption</li>
                  <li><strong>Secure Storage:</strong> Data stored in encrypted databases</li>
                  <li><strong>Access Controls:</strong> Role-based access - users only see what they need</li>
                  <li><strong>Payment Security:</strong> We never store full credit card numbers (PCI-DSS compliant)</li>
                  <li><strong>Regular Audits:</strong> Security reviews and vulnerability testing</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Retention</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Delivery Records:</strong> Kept for 7 years (IRS requirement for business records)</li>
                  <li><strong>Photos/Videos:</strong> Retained for 2 years or until insurance claims resolved</li>
                  <li><strong>GPS Route Data:</strong> Kept until carrier deletes or marks inactive</li>
                  <li><strong>Payment Records:</strong> Kept for 7 years (tax compliance)</li>
                  <li><strong>Deleted Accounts:</strong> All personal data deleted within 30 days of account closure</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights (GDPR & CCPA)</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Right to Access:</strong> Request what data we have about you</li>
                  <li><strong>Right to Portability:</strong> Download your data in machine-readable format</li>
                  <li><strong>Right to Correction:</strong> Update incorrect information</li>
                  <li><strong>Right to Deletion:</strong> Request complete account and data deletion</li>
                  <li><strong>Right to Opt-Out:</strong> Decline GPS tracking, marketing emails, etc.</li>
                  <li><strong>Right to Non-Discrimination:</strong> Same service regardless of privacy choices</li>
                </ul>
                <p className="text-sm text-gray-600 mt-4">
                  To exercise any of these rights, email <strong>privacy@carrierconnect.com</strong> or use the data management tools in your account settings.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cookies & Tracking</h2>
                <p className="text-gray-700 mb-3">We use minimal cookies for:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Essential:</strong> Login sessions, security</li>
                  <li><strong>Functional:</strong> Remember your preferences</li>
                  <li><strong>Analytics:</strong> Understand how features are used (anonymized)</li>
                </ul>
                <p className="text-sm text-gray-600 mt-3">
                  We DO NOT use third-party advertising cookies. We DO NOT track you across other websites.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Children's Privacy</h2>
                <p className="text-gray-700">
                  CarrierConnect is not intended for use by anyone under 18. We do not knowingly collect information from children.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Changes to This Policy</h2>
                <p className="text-gray-700">
                  We may update this policy periodically. We'll notify you via email of any material changes. Continued use after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
                <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                  <p className="text-gray-900 mb-3"><strong>Privacy Questions or Requests:</strong></p>
                  <p className="text-gray-700">Email: <strong>privacy@carrierconnect.com</strong></p>
                  <p className="text-gray-700">Response time: Within 48 hours</p>
                  <p className="text-gray-700 mt-4">Mailing Address:<br />
                  CarrierConnect Privacy Team<br />
                  [Address TBD]<br />
                  United States</p>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button
            onClick={handleDataExport}
            variant="outline"
            className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Login to Manage Your Privacy Settings
          </Button>
        </div>
      </div>
    </div>
  );
}