import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle2, XCircle, Clock, AlertTriangle, FileSignature, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import SignaturePad from "../components/signature/SignaturePad";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CustomerSignaturePortal() {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [deliveryPreference, setDeliveryPreference] = useState("deliver_next_day");

  const queryClient = useQueryClient();

  const { data: pendingDeliveries, isLoading } = useQuery({
    queryKey: ['customerPendingSignatures', searchEmail],
    queryFn: async () => {
      if (!searchEmail) return [];
      const deliveries = await base44.entities.DeliveryRequest.filter({
        customer_email: searchEmail,
        status: 'pending'
      }, '-created_date');
      return deliveries;
    },
    enabled: !!searchEmail,
    initialData: [],
  });

  const signDeliveryMutation = useMutation({
    mutationFn: async ({ deliveryId, signatureData, preference }) => {
      const delivery = pendingDeliveries.find(d => d.id === deliveryId);
      
      const updateData = {
        signature_data: signatureData,
        signature_date: new Date().toISOString(),
        signature_barcode: `SIG-${delivery.tracking_number}-${Date.now()}`,
        status: 'signed',
        delivery_preference: preference,
      };

      if (preference === 'deliver_next_day') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        updateData.scheduled_delivery_date = tomorrow.toISOString().split('T')[0];
        updateData.status = 'signed';
      } else {
        updateData.status = 'held_at_post_office';
      }

      await base44.entities.DeliveryRequest.update(deliveryId, updateData);

      // Send notification to carrier
      if (delivery.carrier_email) {
        await base44.integrations.Core.SendEmail({
          to: delivery.carrier_email,
          subject: `Customer Signature Received - ${delivery.tracking_number}`,
          body: `
            Customer ${delivery.customer_name} has signed for package ${delivery.tracking_number}.
            
            Preference: ${preference === 'deliver_next_day' ? 'Deliver Next Day' : 'Hold at Post Office'}
            
            ${preference === 'deliver_next_day' ? 
              `Scheduled for delivery: ${format(new Date(updateData.scheduled_delivery_date), 'MMMM d, yyyy')}` :
              'Package will be held at post office for customer pickup.'
            }
            
            Signature barcode: ${updateData.signature_barcode}
          `
        });
      }

      // Notify sender if applicable
      if (delivery.sender_business_name && delivery.customer_email) {
        await base44.integrations.Core.SendEmail({
          to: delivery.customer_email,
          from_name: delivery.sender_business_name,
          subject: `Signature Confirmation - ${delivery.tracking_number}`,
          body: `
            Thank you for signing for your package!
            
            Tracking Number: ${delivery.tracking_number}
            
            Your preference: ${preference === 'deliver_next_day' ? 
              `Delivery scheduled for ${format(new Date(updateData.scheduled_delivery_date), 'MMMM d, yyyy')}` :
              'Package will be held at post office for pickup'
            }
            
            You can track your package at any time.
          `
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerPendingSignatures'] });
      setShowSignatureDialog(false);
      setSelectedDelivery(null);
    },
  });

  const handleSignature = (signatureData) => {
    signDeliveryMutation.mutate({
      deliveryId: selectedDelivery.id,
      signatureData,
      preference: deliveryPreference,
    });
  };

  const startSignature = (delivery) => {
    setSelectedDelivery(delivery);
    setShowSignatureDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-2">
            Package Signature Portal
          </h1>
          <p className="text-blue-600">Sign for your packages before delivery - avoid missed deliveries!</p>
        </div>

        <Card className="mb-8 border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
            <CardTitle className="text-blue-900">Find Your Packages</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Enter your email address
                </label>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="flex-1 px-4 py-3 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <Button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['customerPendingSignatures'] })}
                    disabled={!searchEmail || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 px-8"
                  >
                    Search
                  </Button>
                </div>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-900 text-sm">
                  💡 <strong>How it works:</strong> Enter your email to see packages awaiting your signature. 
                  Sign electronically to authorize delivery or hold at post office.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Searching for your packages...</p>
          </div>
        )}

        {!isLoading && searchEmail && pendingDeliveries.length === 0 && (
          <Card className="border-2 border-gray-200">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">No Packages Found</p>
              <p className="text-gray-600">No packages awaiting signature for {searchEmail}</p>
            </CardContent>
          </Card>
        )}

        {pendingDeliveries.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              <FileSignature className="w-6 h-6" />
              Packages Awaiting Your Signature ({pendingDeliveries.length})
            </h2>

            {pendingDeliveries.map((delivery) => (
              <Card key={delivery.id} className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Badge className="bg-orange-500 text-white mb-2">
                        SIGNATURE REQUIRED
                      </Badge>
                      <p className="font-mono text-sm font-bold text-gray-900">
                        {delivery.tracking_number}
                      </p>
                      {delivery.sender_business_name && (
                        <p className="text-sm text-gray-600">From: {delivery.sender_business_name}</p>
                      )}
                    </div>
                    <Package className="w-10 h-10 text-orange-600" />
                  </div>

                  {delivery.package_photo_url && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Package Photo:</p>
                      <img 
                        src={delivery.package_photo_url} 
                        alt="Package" 
                        className="w-full max-w-md rounded-lg border-2 border-gray-200"
                      />
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{delivery.delivery_address}</span>
                    </div>
                    {delivery.scheduled_delivery_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-700">
                          Scheduled: {format(new Date(delivery.scheduled_delivery_date), "MMMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>

                  {delivery.carrier_notes && (
                    <Alert className="mb-4 border-blue-200 bg-blue-50">
                      <AlertDescription className="text-blue-900 text-sm">
                        <strong>Carrier Notes:</strong> {delivery.carrier_notes}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="border-t-2 border-gray-200 pt-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">Choose Your Delivery Preference:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => setDeliveryPreference("deliver_next_day")}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          deliveryPreference === "deliver_next_day"
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:border-green-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className={`w-5 h-5 ${
                            deliveryPreference === "deliver_next_day" ? "text-green-600" : "text-gray-400"
                          }`} />
                          <span className="font-semibold">Deliver Next Day</span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Sign now and carrier will deliver tomorrow to your address
                        </p>
                      </button>

                      <button
                        onClick={() => setDeliveryPreference("hold_at_post_office")}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          deliveryPreference === "hold_at_post_office"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className={`w-5 h-5 ${
                            deliveryPreference === "hold_at_post_office" ? "text-blue-600" : "text-gray-400"
                          }`} />
                          <span className="font-semibold">Hold at Post Office</span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Sign now and pick up at post office when convenient
                        </p>
                      </button>
                    </div>

                    <Button
                      onClick={() => startSignature(delivery)}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 text-lg"
                    >
                      <FileSignature className="w-5 h-5 mr-2" />
                      Sign for This Package
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-blue-900">Electronic Signature</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-900 text-sm">
                  <strong>Package:</strong> {selectedDelivery.tracking_number}<br />
                  <strong>Your Choice:</strong> {
                    deliveryPreference === "deliver_next_day" 
                      ? "✓ Authorize delivery to my address tomorrow" 
                      : "✓ Hold at post office for pickup"
                  }
                </AlertDescription>
              </Alert>

              <SignaturePad
                onSignatureComplete={handleSignature}
                onCancel={() => setShowSignatureDialog(false)}
              />

              <p className="text-xs text-gray-600 text-center">
                By signing, you authorize the carrier to deliver or hold this package according to your preference.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}