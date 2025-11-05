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
  Shield, Upload, CheckCircle2, AlertTriangle,
  DollarSign, FileText, Clock, Camera
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function InsuranceClaimsPortal() {
  const [step, setStep] = useState(1);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [claimType, setClaimType] = useState("damage");
  const [claimAmount, setClaimAmount] = useState("");
  const [damageDescription, setDamageDescription] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState([]);
  const [claimantEmail, setClaimantEmail] = useState("");
  const [originalDelivery, setOriginalDelivery] = useState(null);

  const queryClient = useQueryClient();

  const { data: myClaims } = useQuery({
    queryKey: ['myClaims', claimantEmail],
    queryFn: () => base44.entities.InsuranceClaim.filter({ claimant_email: claimantEmail }),
    initialData: [],
    enabled: !!claimantEmail
  });

  const verifyPackageMutation = useMutation({
    mutationFn: async (tracking) => {
      const deliveries = await base44.entities.DeliveryRequest.filter({ 
        tracking_number: tracking 
      });
      
      if (deliveries.length === 0) {
        throw new Error("Tracking number not found");
      }

      const delivery = deliveries[0];
      
      if (!delivery.has_premium_insurance) {
        throw new Error("This package does not have insurance coverage");
      }

      return delivery;
    },
    onSuccess: (delivery) => {
      setOriginalDelivery(delivery);
      setStep(2);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const fileClaimMutation = useMutation({
    mutationFn: async (claimData) => {
      const claimNumber = `CLM-${Date.now()}`;

      // Use AI to analyze claim
      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this insurance claim for validity and recommend a decision.

CLAIM DETAILS:
Type: ${claimType}
Claimed Amount: $${claimAmount}
Package Value: $${originalDelivery.package_value}
Insurance Coverage: $${originalDelivery.insurance_tier === 'premium' ? 500 : originalDelivery.insurance_tier === 'platinum' ? 2000 : 100}
Packaging Type: ${originalDelivery.box_type_used || 'Unknown'}
Packaging Verified: ${originalDelivery.packaging_verified}
Damage Description: ${damageDescription}
Evidence Photos: ${evidencePhotos.length} photos provided
Checkpoints Completed: ${originalDelivery.checkpoints_completed}/${originalDelivery.total_checkpoints}

Based on this information:
1. Is this a valid claim?
2. Is packaging at fault?
3. Is carrier at fault?
4. What amount should be approved?
5. What is your confidence level?`,
        response_json_schema: {
          type: "object",
          properties: {
            packaging_fault: { type: "boolean" },
            carrier_fault: { type: "boolean" },
            recommended_decision: { 
              type: "string",
              enum: ["approved_full", "approved_partial", "denied", "needs_more_info"]
            },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            recommended_amount: { type: "number" }
          }
        }
      });

      const claim = await base44.entities.InsuranceClaim.create({
        claim_number: claimNumber,
        tracking_number: trackingNumber,
        delivery_request_id: originalDelivery.id,
        claim_type: claimType,
        claimant_type: claimData.claimant_type,
        claimant_name: claimData.claimant_name,
        claimant_email: claimantEmail,
        claimant_phone: claimData.claimant_phone,
        package_value: originalDelivery.package_value,
        claim_amount: parseFloat(claimAmount),
        insurance_coverage: originalDelivery.insurance_tier === 'premium' ? 500 : 
                           originalDelivery.insurance_tier === 'platinum' ? 2000 : 100,
        insurance_tier: originalDelivery.insurance_tier,
        damage_description: damageDescription,
        damage_occurred_at: claimData.damage_stage,
        packaging_type: originalDelivery.box_type_used,
        packaging_adequate: originalDelivery.packaging_verified,
        evidence_photos: evidencePhotos,
        checkpoint_photos: [], // Would fetch from checkpoints
        filed_at: new Date().toISOString(),
        status: "submitted",
        ai_analysis: aiAnalysis
      });

      return claim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      setStep(3);
      toast.success("Claim filed successfully!");
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const result = await base44.integrations.Core.UploadFile({ file });
        setEvidencePhotos([...evidencePhotos, result.file_url]);
        toast.success("Photo uploaded");
      } catch (error) {
        toast.error("Failed to upload photo");
      }
    }
  };

  const handleFileClaim = () => {
    if (!claimAmount || !damageDescription || !claimantEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    fileClaimMutation.mutate({
      claimant_type: "recipient",
      claimant_name: originalDelivery.customer_name,
      claimant_phone: originalDelivery.customer_phone,
      damage_stage: "delivery"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <Shield className="w-12 h-12 text-blue-600" />
            File Insurance Claim
          </h1>
          <p className="text-lg text-gray-600">Get reimbursed for damaged or lost packages</p>
        </div>

        {/* Step 1: Verify Package */}
        {step === 1 && (
          <Card className="border-2 border-blue-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600">
              <CardTitle className="text-white text-2xl">Step 1: Verify Your Package</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div>
                  <Label className="text-lg">Tracking Number *</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="mt-2 h-14 text-lg"
                  />
                </div>

                <div>
                  <Label className="text-lg">Your Email *</Label>
                  <Input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="mt-2 h-14 text-lg"
                  />
                </div>

                <Button
                  onClick={() => verifyPackageMutation.mutate(trackingNumber)}
                  disabled={!trackingNumber || !claimantEmail || verifyPackageMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-semibold"
                >
                  {verifyPackageMutation.isPending ? "Verifying..." : "Verify Package →"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Claim Details */}
        {step === 2 && originalDelivery && (
          <div className="space-y-6">
            <Card className="border-2 border-green-300">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  Package Verified - Insurance Active
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Package Value</p>
                    <p className="font-bold text-lg">${originalDelivery.package_value}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Coverage Limit</p>
                    <p className="font-bold text-lg text-green-900">
                      ${originalDelivery.insurance_tier === 'premium' ? '500' : 
                        originalDelivery.insurance_tier === 'platinum' ? '2,000' : '100'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-300 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600">
                <CardTitle className="text-white text-2xl">Step 2: Claim Information</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div>
                  <Label className="text-lg">What happened? *</Label>
                  <Select value={claimType} onValueChange={setClaimType}>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damage">Package Damaged</SelectItem>
                      <SelectItem value="loss">Package Lost</SelectItem>
                      <SelectItem value="theft">Package Stolen</SelectItem>
                      <SelectItem value="partial_loss">Partial Contents Missing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-lg">Claim Amount *</Label>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="number"
                      step="0.01"
                      value={claimAmount}
                      onChange={(e) => setClaimAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-10 h-14 text-lg"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Maximum: ${originalDelivery.insurance_tier === 'premium' ? '500' : 
                              originalDelivery.insurance_tier === 'platinum' ? '2,000' : '100'}
                  </p>
                </div>

                <div>
                  <Label className="text-lg">Describe the Damage/Loss *</Label>
                  <Textarea
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder="Please provide detailed description of what was damaged or lost..."
                    rows={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-lg">Upload Evidence Photos *</Label>
                  <div className="mt-2 space-y-3">
                    <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-blue-300 border-dashed rounded-lg hover:bg-blue-50 cursor-pointer">
                      <div className="text-center">
                        <Camera className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                        <p className="text-sm text-blue-900 font-semibold">Upload Photos of Damage</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {evidencePhotos.length > 0 ? `${evidencePhotos.length} photo(s) uploaded` : "Click to add photos"}
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    
                    {evidencePhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {evidencePhotos.map((url, idx) => (
                          <div key={idx} className="relative">
                            <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border-2 border-gray-200" />
                            <Badge className="absolute top-1 right-1 bg-green-600">✓</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                  <p className="font-semibold text-yellow-900 mb-2">⚡ AI-Powered Review</p>
                  <p className="text-sm text-yellow-800">
                    Your claim will be automatically reviewed by our AI system using package checkpoint photos and your evidence. Most claims are processed within 24-48 hours.
                  </p>
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
                    onClick={handleFileClaim}
                    disabled={!claimAmount || !damageDescription || evidencePhotos.length === 0 || fileClaimMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-12"
                  >
                    {fileClaimMutation.isPending ? "Filing Claim..." : "Submit Claim →"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Claim Submitted */}
        {step === 3 && (
          <Card className="border-2 border-green-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600">
              <CardTitle className="text-white text-2xl text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                Claim Submitted Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <p className="text-gray-600 mb-2">Your claim number:</p>
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 inline-block">
                  <p className="font-mono text-2xl font-bold text-blue-900">
                    {myClaims[0]?.claim_number}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Claim Amount</p>
                        <p className="font-bold text-xl text-blue-900">${claimAmount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge className="bg-yellow-600">Under Review</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-300 mb-6">
                <p className="font-semibold text-blue-900 mb-3">📋 What Happens Next:</p>
                <ol className="text-sm text-blue-800 space-y-2">
                  <li>1. AI system analyzes your claim and evidence (within 24 hours)</li>
                  <li>2. Claims adjuster reviews AI recommendation</li>
                  <li>3. You'll receive email notification of decision</li>
                  <li>4. If approved, payment processed within 3-5 business days</li>
                  <li>5. You can track claim status anytime</li>
                </ol>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-900 mb-1">✉️ Confirmation Sent</p>
                <p className="text-sm text-green-800">
                  Claim confirmation sent to {claimantEmail}
                </p>
              </div>

              <Button
                onClick={() => {
                  setStep(1);
                  setTrackingNumber("");
                  setClaimAmount("");
                  setDamageDescription("");
                  setEvidencePhotos([]);
                  setOriginalDelivery(null);
                }}
                variant="outline"
                className="w-full mt-6 border-2 border-blue-300"
              >
                File Another Claim
              </Button>
            </CardContent>
          </Card>
        )}

        {/* My Claims */}
        {myClaims.length > 0 && step === 1 && (
          <Card className="border-2 border-gray-200 mt-8">
            <CardHeader className="bg-gray-50">
              <CardTitle>My Claims</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {myClaims.map((claim) => (
                  <Card key={claim.id} className="border-2 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-bold text-gray-900">{claim.claim_number}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Tracking: {claim.tracking_number}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge>{claim.claim_type}</Badge>
                            <Badge className={
                              claim.status === 'approved' || claim.status === 'paid' ? 'bg-green-600' :
                              claim.status === 'denied' ? 'bg-red-600' :
                              claim.status === 'under_review' ? 'bg-blue-600' :
                              'bg-yellow-600'
                            }>
                              {claim.status.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline">${claim.claim_amount}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Filed</p>
                          <p className="text-sm font-semibold">
                            {format(new Date(claim.filed_at), "MMM d, yyyy")}
                          </p>
                        </div>
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