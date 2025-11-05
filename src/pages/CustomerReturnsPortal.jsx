import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  PackageX, ArrowLeft, CheckCircle2, Upload, Download,
  AlertTriangle, Truck, Mail, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CustomerReturnsPortal() {
  const [step, setStep] = useState(1);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnType, setReturnType] = useState("return_to_sender");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [photos, setPhotos] = useState([]);
  const [originalDelivery, setOriginalDelivery] = useState(null);

  const queryClient = useQueryClient();

  const { data: myReturns } = useQuery({
    queryKey: ['myReturns', customerEmail],
    queryFn: () => base44.entities.PackageReturn.filter({ customer_email: customerEmail }),
    initialData: [],
    enabled: !!customerEmail
  });

  const verifyTrackingMutation = useMutation({
    mutationFn: async (tracking) => {
      const deliveries = await base44.entities.DeliveryRequest.filter({ 
        tracking_number: tracking 
      });
      
      if (deliveries.length === 0) {
        throw new Error("Tracking number not found");
      }

      const delivery = deliveries[0];
      
      if (delivery.status !== 'delivered') {
        throw new Error("Package must be delivered before return can be initiated");
      }

      return delivery;
    },
    onSuccess: (delivery) => {
      setOriginalDelivery(delivery);
      setCustomerName(delivery.customer_name);
      setCustomerEmail(delivery.customer_email);
      setStep(2);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const createReturnMutation = useMutation({
    mutationFn: async (returnData) => {
      const returnTrackingNumber = `RET${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      const packageReturn = await base44.entities.PackageReturn.create({
        return_id: `RET-${Date.now()}`,
        original_tracking_number: trackingNumber,
        return_tracking_number: returnTrackingNumber,
        original_delivery_id: originalDelivery.id,
        return_reason: returnReason,
        return_type: returnType,
        initiated_by: "customer",
        customer_name: customerName,
        customer_email: customerEmail,
        return_from_address: originalDelivery.delivery_address,
        return_to_address: returnData.return_to_address,
        status: "initiated",
        initiated_at: new Date().toISOString(),
        driver_notes: additionalDetails,
        customer_notes: additionalDetails,
        photos: photos,
        who_pays_return: returnReason === "wrong_address" || returnReason === "damaged" ? "sender" : "customer"
      });

      // Generate return label
      const label = await base44.entities.ShippingLabel.create({
        label_id: `RET-LBL-${Date.now()}`,
        tracking_number: returnTrackingNumber,
        purchased_by_email: customerEmail,
        purchased_by_name: customerName,
        from_name: customerName,
        from_address: originalDelivery.delivery_address,
        from_zip: originalDelivery.delivery_address.match(/\d{5}/)?.[0] || "00000",
        to_name: originalDelivery.sender_business_name || "Sender",
        to_address: returnData.return_to_address,
        to_zip: returnData.return_to_address.match(/\d{5}/)?.[0] || "00000",
        package_weight: originalDelivery.package_weight || 1,
        service_type: "ground_advantage",
        delivery_speed: "2-5 Business Days",
        total_cost: returnData.return_cost,
        payment_status: returnData.who_pays_return === "customer" ? "pending" : "paid",
        label_format: "pdf_4x6",
        created_at: new Date().toISOString()
      });

      await base44.entities.PackageReturn.update(packageReturn.id, {
        return_label_created: true,
        return_label_url: label.label_file_url,
        return_label_cost: returnData.return_cost,
        status: "label_created"
      });

      return packageReturn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myReturns'] });
      setStep(3);
      toast.success("Return initiated successfully!");
    }
  });

  const handleVerifyTracking = () => {
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }
    verifyTrackingMutation.mutate(trackingNumber.trim());
  };

  const handleCreateReturn = () => {
    if (!returnReason || !customerEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    const returnCost = returnType === "return_to_sender" ? 7.50 : 9.65;
    const whoPays = ["wrong_address", "damaged", "not_as_described"].includes(returnReason) 
      ? "sender" 
      : "customer";

    createReturnMutation.mutate({
      return_to_address: originalDelivery.sender_business_name 
        ? "Sender Business Address" 
        : originalDelivery.delivery_address,
      return_cost: returnCost,
      who_pays_return: whoPays
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const result = await base44.integrations.Core.UploadFile({ file });
        setPhotos([...photos, result.file_url]);
        toast.success("Photo uploaded");
      } catch (error) {
        toast.error("Failed to upload photo");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <PackageX className="w-12 h-12 text-orange-600" />
            Return Your Package
          </h1>
          <p className="text-lg text-gray-600">Easy, hassle-free returns with prepaid labels</p>
        </div>

        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {[
            { num: 1, label: "Find Order" },
            { num: 2, label: "Return Details" },
            { num: 3, label: "Get Label" }
          ].map((s) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center gap-2 ${step >= s.num ? 'text-orange-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s.num ? 'bg-orange-600 text-white' : 'bg-gray-200'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-6 h-6" /> : s.num}
                </div>
                <span className="font-semibold hidden md:block">{s.label}</span>
              </div>
              {s.num < 3 && <div className="w-16 h-1 bg-gray-200 mx-2"></div>}
            </div>
          ))}
        </div>

        {/* Step 1: Find Package */}
        {step === 1 && (
          <Card className="border-2 border-orange-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600">
              <CardTitle className="text-white text-2xl">Step 1: Find Your Package</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div>
                  <Label className="text-lg">Tracking Number *</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter your tracking number"
                    className="mt-2 h-14 text-lg"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Find your tracking number on your delivery confirmation email
                  </p>
                </div>

                <Button
                  onClick={handleVerifyTracking}
                  disabled={verifyTrackingMutation.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 h-14 text-lg font-semibold"
                >
                  {verifyTrackingMutation.isPending ? "Verifying..." : "Find My Package →"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Return Details */}
        {step === 2 && originalDelivery && (
          <div className="space-y-6">
            <Card className="border-2 border-blue-300">
              <CardHeader className="bg-blue-50">
                <CardTitle>Package Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Tracking Number</p>
                    <p className="font-mono font-bold">{originalDelivery.tracking_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Delivered</p>
                    <p className="font-semibold">
                      {format(new Date(originalDelivery.delivery_timestamp), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-300 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600">
                <CardTitle className="text-white text-2xl">Step 2: Return Details</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div>
                  <Label className="text-lg">Why are you returning this? *</Label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wrong_address">Delivered to Wrong Address</SelectItem>
                      <SelectItem value="damaged">Package Damaged</SelectItem>
                      <SelectItem value="not_as_described">Not as Described</SelectItem>
                      <SelectItem value="incorrect_item">Wrong Item Received</SelectItem>
                      <SelectItem value="quality_issue">Quality Issue</SelectItem>
                      <SelectItem value="no_longer_needed">No Longer Needed</SelectItem>
                      <SelectItem value="customer_request">Changed My Mind</SelectItem>
                      <SelectItem value="other">Other Reason</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Additional Details</Label>
                  <Textarea
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    placeholder="Please provide more details about why you're returning this package..."
                    rows={4}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Upload Photos (Optional)</Label>
                  <div className="mt-2">
                    <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 cursor-pointer">
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload photos of package</p>
                        {photos.length > 0 && (
                          <p className="text-xs text-green-600 mt-1">{photos.length} photo(s) uploaded</p>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-bold text-blue-900 mb-2">Return Shipping Cost</h4>
                  <p className="text-sm text-blue-800 mb-3">
                    {["wrong_address", "damaged", "not_as_described"].includes(returnReason)
                      ? "✅ FREE - Sender will cover return shipping costs"
                      : "Return shipping: $7.50 (USPS Ground Advantage)"}
                  </p>
                  {!["wrong_address", "damaged", "not_as_described"].includes(returnReason) && (
                    <p className="text-xs text-gray-600">
                      You'll receive a prepaid return label. Cost will be deducted from your refund.
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={handleCreateReturn}
                    disabled={!returnReason || createReturnMutation.isPending}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 h-12"
                  >
                    {createReturnMutation.isPending ? "Processing..." : "Create Return →"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Return Label */}
        {step === 3 && (
          <Card className="border-2 border-green-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600">
              <CardTitle className="text-white text-2xl text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                Return Initiated Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <p className="text-gray-600 mb-2">Your return tracking number:</p>
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 inline-block">
                  <p className="font-mono text-2xl font-bold text-blue-900">
                    {myReturns[0]?.return_tracking_number}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg">
                  <Download className="w-6 h-6 mr-2" />
                  Download Return Label
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-2 border-gray-300 h-12"
                  onClick={() => window.print()}
                >
                  Print Return Label
                </Button>
              </div>

              <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <p className="font-semibold text-yellow-900 mb-3">📦 Return Instructions:</p>
                <ol className="text-sm text-yellow-800 space-y-2">
                  <li>1. Print the return label and attach it to your package</li>
                  <li>2. Remove or cover the original shipping label</li>
                  <li>3. Drop off at any USPS location</li>
                  <li>4. Keep your receipt for proof of shipment</li>
                  <li>5. Track your return using the tracking number above</li>
                </ol>
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-900 mb-1">✉️ Confirmation Sent</p>
                <p className="text-sm text-green-800">
                  Return label and instructions sent to {customerEmail}
                </p>
              </div>

              <Button
                onClick={() => {
                  setStep(1);
                  setTrackingNumber("");
                  setReturnReason("");
                  setOriginalDelivery(null);
                  setPhotos([]);
                  setAdditionalDetails("");
                }}
                variant="outline"
                className="w-full mt-6 border-2 border-orange-300 text-orange-700"
              >
                Return Another Package
              </Button>
            </CardContent>
          </Card>
        )}

        {/* My Returns */}
        {myReturns.length > 0 && step === 1 && (
          <Card className="border-2 border-gray-200 mt-8">
            <CardHeader className="bg-gray-50">
              <CardTitle>My Recent Returns</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {myReturns.slice(0, 5).map((ret) => (
                  <Card key={ret.id} className="border-2 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-gray-900">{ret.return_tracking_number}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Original: {ret.original_tracking_number}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge>{ret.return_reason.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline" className={
                              ret.status === 'delivered_to_sender' ? 'border-green-600 text-green-900' :
                              ret.status === 'in_transit' ? 'border-blue-600 text-blue-900' :
                              'border-gray-600 text-gray-900'
                            }>
                              {ret.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-1" />
                          Label
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}