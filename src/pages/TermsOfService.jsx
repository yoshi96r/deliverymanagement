import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, AlertTriangle } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <FileText className="w-10 h-10 text-blue-600" />
            Terms of Service
          </h1>
          <p className="text-gray-600">Last Updated: November 4, 2025</p>
        </div>

        <Card className="border-2 border-gray-200 mb-6">
          <CardContent className="p-8 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700">
                By accessing CarrierConnect, you agree to these Terms of Service. If you disagree with any part, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Service Description</h2>
              <p className="text-gray-700 mb-3">CarrierConnect provides:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Digital signature verification platform for package deliveries</li>
                <li>GPS route recording and playback for substitute carriers</li>
                <li>Customer-carrier communication tools</li>
                <li>Package tracking and insurance management</li>
                <li>Earnings tracking for carriers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>You must be 18+ to create an account</li>
                <li>Provide accurate, current information during registration</li>
                <li>Maintain security of your password</li>
                <li>Notify us immediately of unauthorized access</li>
                <li>You are responsible for all activity under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Carrier Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Provide accurate delivery information and status updates</li>
                <li>Upload clear, truthful photos/videos of deliveries</li>
                <li>Protect customer privacy and handle data responsibly</li>
                <li>Follow USPS regulations and guidelines</li>
                <li>Not misrepresent delivery completion or damage</li>
                <li>Ensure GPS route recordings are accurate and current</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Customer Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Provide accurate delivery address and contact information</li>
                <li>Sign for packages only if you accept delivery</li>
                <li>Report damaged packages promptly with photos</li>
                <li>Not abuse the signature verification system</li>
                <li>Respect carrier communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Payment Terms</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">For Carriers</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>CarrierConnect is <strong>100% FREE</strong> for USPS carriers</li>
                <li>Earnings from delivery verifications paid weekly via direct deposit</li>
                <li>Minimum $25 for payout (rolls over if below threshold)</li>
                <li>Disputes must be reported within 30 days</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mt-4 mb-3">For Business Senders</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Charged per shipment + optional monthly subscription</li>
                <li>All fees shown before purchase confirmation</li>
                <li>Refunds available for unused shipping labels (within 24 hours)</li>
                <li>Insurance claims subject to verification and approval</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Insurance & Liability</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Insurance coverage limited to amount purchased and paid for</li>
                <li>Claims require photo/video evidence and verification</li>
                <li>Improper packaging may void insurance coverage</li>
                <li>Carriers not liable for damage if packaging was inadequate</li>
                <li>CarrierConnect facilitates insurance but is not the insurer</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Prohibited Uses</h2>
              <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900 mb-2">You may NOT:</p>
                    <ul className="text-sm text-red-800 space-y-1">
                      <li>• Upload false or fraudulent delivery proofs</li>
                      <li>• Share access credentials with others</li>
                      <li>• Attempt to hack, reverse engineer, or compromise the system</li>
                      <li>• Harass other users through messaging features</li>
                      <li>• Use the platform for illegal activities</li>
                      <li>• Collect or harvest user data without permission</li>
                      <li>• Interfere with platform operation or other users' access</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Intellectual Property</h2>
              <p className="text-gray-700">
                CarrierConnect and all related software, designs, and content are owned by CarrierConnect. 
                You may not copy, modify, or distribute our platform without written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Termination</h2>
              <p className="text-gray-700 mb-3">We may suspend or terminate accounts for:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Violation of these Terms</li>
                <li>Fraudulent activity or false information</li>
                <li>Non-payment (for business accounts)</li>
                <li>Prolonged inactivity</li>
                <li>At our discretion with or without notice</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Disclaimers</h2>
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                <p className="text-sm text-gray-700">
                  CarrierConnect is provided "AS IS" without warranties of any kind. We do not guarantee uninterrupted service, 
                  accuracy of GPS data, or specific delivery outcomes. We are not responsible for USPS operations, policies, 
                  or employment matters. This platform is a tool to assist carriers - not a replacement for USPS systems.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Limitation of Liability</h2>
              <p className="text-gray-700">
                CarrierConnect's liability is limited to the amount you paid us in the 12 months prior to the claim. 
                We are not liable for indirect, incidental, or consequential damages.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Dispute Resolution</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Disputes resolved through binding arbitration (not court)</li>
                <li>Arbitration in your state of residence</li>
                <li>No class action lawsuits</li>
                <li>Small claims court option available</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Contact Information</h2>
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                <p className="text-gray-900 mb-3"><strong>Legal & Terms Questions:</strong></p>
                <p className="text-gray-700">Email: <strong>legal@carrierconnect.com</strong></p>
                <p className="text-gray-700">Support: <strong>support@carrierconnect.com</strong></p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}