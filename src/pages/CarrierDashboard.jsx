import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, Send, Package, CheckCircle2, DollarSign, TrendingUp, Camera, Shield } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DeliveryCard from "../components/delivery/DeliveryCard";
import DeliveryProofCapture from "../components/delivery/DeliveryProofCapture";
import CheckpointCapture from "../components/delivery/CheckpointCapture";
import InsurancePricingCard from "../components/delivery/InsurancePricingCard";
import PackagingVerificationCapture from "../components/delivery/PackagingVerificationCapture";
import PackagingRequirementsCard from "../components/delivery/PackagingRequirementsCard";

export default function CarrierDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [showCheckpointDialog, setShowCheckpointDialog] = useState(false);
  const [showPackagingDialog, setShowPackagingDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedInsuranceTier, setSelectedInsuranceTier] = useState('none');
  const [insuranceCost, setInsuranceCost] = useState(0);
  
  const [formData, setFormData] = useState({
    tracking_number: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    delivery_address: "",
    package_photo_url: "",
    carrier_name: "",
    carrier_email: "",
    carrier_notes: "",
    scheduled_delivery_date: "",
    sender_business_name: "",
    package_value: "",
    package_weight: "",
    package_dimensions: "",
  });

  const queryClient = useQueryClient();

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['deliveryRequests'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date'),
    initialData: [],
  });

  const { data: checkpoints } = useQuery({
    queryKey: ['deliveryCheckpoints'],
    queryFn: () => base44.entities.DeliveryCheckpoint.list('-created_date'),
    initialData: [],
  });

  const { data: earnings } = useQuery({
    queryKey: ['carrierEarnings'],
    queryFn: () => base44.entities.CarrierEarnings.list('-created_date'),
    initialData: [],
  });

  const verifyPackagingMutation = useMutation({
    mutationFn: async ({ deliveryId, verificationData, approved }) => {
      const updateData = {
        packaging_verified: approved,
        packaging_verification_photo: verificationData.photoUrl,
        box_strength: verificationData.boxStrength,
      };

      if (approved) {
        updateData.status = 'at_facility';
        toast.success("Packaging approved! Package can proceed with verification checkpoints.");
      } else {
        updateData.status = 'packaging_rejected';
        updateData.packaging_rejected_reason = verificationData.rejectionReason;
        updateData.payment_status = 'refunded_improper_packaging';
        toast.error("Packaging rejected! Sender will be notified to repack with proper materials.");
      }

      await base44.entities.DeliveryRequest.update(deliveryId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
      setShowPackagingDialog(false);
      setSelectedDelivery(null);
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: (data) => {
      const checkpointsCount = 
        data.insurance_tier === 'platinum' ? 6 :
        data.insurance_tier === 'premium' ? 5 :
        data.insurance_tier === 'basic' ? 3 : 0;

      return base44.entities.DeliveryRequest.create({
        ...data,
        status: 'pending',
        has_premium_insurance: data.insurance_tier !== 'none',
        checkpoints_completed: 0,
        total_checkpoints: checkpointsCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
      toast.success("Delivery request created with insurance coverage!");
      setShowForm(false);
      setSelectedInsuranceTier('none');
      setInsuranceCost(0);
      setFormData({
        tracking_number: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        delivery_address: "",
        package_photo_url: "",
        carrier_name: "",
        carrier_email: "",
        carrier_notes: "",
        scheduled_delivery_date: "",
        sender_business_name: "",
        package_value: "",
        package_weight: "",
        package_dimensions: "",
      });
    },
  });

  const createCheckpointMutation = useMutation({
    mutationFn: async ({ deliveryId, checkpointData, carrierInfo }) => {
      const checkpoint = await base44.entities.DeliveryCheckpoint.create({
        delivery_request_id: deliveryId,
        tracking_number: checkpointData.tracking_number,
        checkpoint_type: checkpointData.checkpointType,
        checkpoint_name: checkpointData.checkpointName,
        carrier_name: carrierInfo.name,
        carrier_email: carrierInfo.email,
        timestamp: new Date().toISOString(),
        photo_urls: checkpointData.photoUrls,
        video_url: checkpointData.videoUrl,
        package_condition: checkpointData.packageCondition,
        damage_detected: checkpointData.damageDetected,
        damage_notes: checkpointData.damageNotes,
        notes: checkpointData.notes,
        scan_verified: true,
        payment_earned: checkpointData.paymentEarned,
      });

      await base44.entities.CarrierEarnings.create({
        carrier_email: carrierInfo.email,
        carrier_name: carrierInfo.name,
        delivery_request_id: deliveryId,
        checkpoint_id: checkpoint.id,
        tracking_number: checkpointData.tracking_number,
        amount_earned: checkpointData.paymentEarned,
        earned_date: new Date().toISOString(),
        earning_type: 'checkpoint',
        insurance_tier: checkpointData.insuranceTier,
        payment_status: 'pending',
      });

      const delivery = deliveries.find(d => d.id === deliveryId);
      const updateData = {
        checkpoints_completed: (delivery.checkpoints_completed || 0) + 1,
        status: checkpointData.checkpointType === 'final_delivery' ? 'delivered' : 'in_transit',
      };

      if (checkpointData.damageDetected && !delivery.damage_reported) {
        updateData.damage_reported = true;
        updateData.damage_stage = checkpointData.checkpointName;
        updateData.damage_description = checkpointData.damageNotes;
        updateData.damage_photos = checkpointData.photoUrls;
        updateData.status = 'damaged';
        
        if (delivery.sender_business_name) {
          toast.error(`DAMAGE REPORTED: ${delivery.sender_business_name} will be notified`);
        }
      }

      await base44.entities.DeliveryRequest.update(deliveryId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
      queryClient.invalidateQueries({ queryKey: ['deliveryCheckpoints'] });
      queryClient.invalidateQueries({ queryKey: ['carrierEarnings'] });
      toast.success("Checkpoint verified! Earnings recorded.");
      setShowCheckpointDialog(false);
      setSelectedDelivery(null);
    },
  });

  const completeDeliveryMutation = useMutation({
    mutationFn: async ({ deliveryId, proofData }) => {
      await base44.entities.DeliveryRequest.update(deliveryId, {
        delivery_proof_photo_url: proofData.photoUrl,
        delivery_proof_video_url: proofData.videoUrl,
        delivery_timestamp: new Date().toISOString(),
        status: 'delivered',
        payment_status: 'charged',
      });

      const delivery = deliveries.find(d => d.id === deliveryId);
      if (delivery) {
        await base44.entities.CarrierEarnings.create({
          carrier_email: delivery.carrier_email,
          carrier_name: delivery.carrier_name,
          delivery_request_id: deliveryId,
          tracking_number: delivery.tracking_number,
          amount_earned: delivery.carrier_payment || 1.50,
          earned_date: new Date().toISOString(),
          payment_status: 'pending',
        });

        if (delivery.sender_business_name) {
          toast.success(`Sender ${delivery.sender_business_name} will be notified!`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
      queryClient.invalidateQueries({ queryKey: ['carrierEarnings'] });
      toast.success("Delivery completed! Earnings recorded.");
      setShowProofDialog(false);
      setSelectedDelivery(null);
    },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, package_photo_url: file_url });
      toast.success("Photo uploaded!");
    } catch (error) {
      toast.error("Failed to upload photo");
    }
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createDeliveryMutation.mutate({
      ...formData,
      insurance_tier: selectedInsuranceTier,
      insurance_cost: insuranceCost,
      requires_special_handling: selectedInsuranceTier !== 'none',
    });
  };

  const startPackagingVerification = (delivery) => {
    setSelectedDelivery(delivery);
    setShowPackagingDialog(true);
  };

  const handlePackagingApprove = (verificationData) => {
    verifyPackagingMutation.mutate({
      deliveryId: selectedDelivery.id,
      verificationData,
      approved: true,
    });
  };

  const handlePackagingReject = (verificationData) => {
    verifyPackagingMutation.mutate({
      deliveryId: selectedDelivery.id,
      verificationData,
      approved: false,
    });
  };

  const startCheckpoint = (delivery) => {
    setSelectedDelivery(delivery);
    setShowCheckpointDialog(true);
  };

  const handleCheckpointComplete = (checkpointData) => {
    createCheckpointMutation.mutate({
      deliveryId: selectedDelivery.id,
      checkpointData: {
        ...checkpointData,
        tracking_number: selectedDelivery.tracking_number,
        insuranceTier: selectedDelivery.insurance_tier,
      },
      carrierInfo: {
        name: selectedDelivery.carrier_name,
        email: selectedDelivery.carrier_email,
      }
    });
  };

  const startDeliveryProof = (delivery) => {
    setSelectedDelivery(delivery);
    setShowProofDialog(true);
  };

  const handleProofComplete = (proofData) => {
    completeDeliveryMutation.mutate({
      deliveryId: selectedDelivery.id,
      proofData
    });
  };

  const pendingCount = deliveries.filter(d => d.status === 'pending').length;
  const signedCount = deliveries.filter(d => d.status === 'signed' || d.status === 'at_facility').length;
  const insuredCount = deliveries.filter(d => d.has_premium_insurance).length;
  const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  const pendingEarnings = earnings.filter(e => e.payment_status === 'pending')
    .reduce((sum, e) => sum + (e.amount_earned || 0), 0);
  const pendingPackagingVerification = deliveries.filter(
    d => d.has_premium_insurance && !d.packaging_verified && d.status !== 'packaging_rejected'
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-2">Carrier Dashboard</h1>
          <p className="text-blue-600">Create signature requests and complete deliveries with verification</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <Card className="border-2 border-blue-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Pending Signatures</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{pendingCount}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Ready to Deliver</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{signedCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Premium Insured</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">{insuredCount}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Total Earnings</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">${totalEarnings.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Pending Payout</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">${pendingEarnings.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Awaiting Packaging Check</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{pendingPackagingVerification}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-900 mb-2">Earn More per Verified Delivery!</h3>
                <p className="text-sm text-green-800">
                  Complete deliveries with photo or video proof showing the house number and delivery location. 
                  Your earnings are tracked automatically and paid out weekly. Premium insured packages pay 1.5x-2.5x more!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {pendingPackagingVerification > 0 && (
          <Alert className="mb-8 border-2 border-orange-300 bg-orange-50">
            <Package className="h-5 w-5 text-orange-600" />
            <AlertDescription className="text-orange-900">
              <strong className="font-bold">{pendingPackagingVerification} Package{pendingPackagingVerification > 1 ? 's' : ''} Awaiting Packaging Verification</strong>
              <p className="mt-1 text-sm">
                Premium insured packages must pass packaging inspection before entering the delivery system.
                Verify packaging meets requirements below.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {!showForm && (
          <Button 
            onClick={() => setShowForm(true)}
            className="mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Signature Request
          </Button>
        )}

        {showForm && (
          <Card className="mb-8 border-2 border-blue-200 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
              <CardTitle className="text-white">Create Delivery Request with Insurance</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <InsurancePricingCard 
                  selectedTier={selectedInsuranceTier}
                  onSelect={(tier, cost) => {
                    setSelectedInsuranceTier(tier);
                    setInsuranceCost(cost);
                  }}
                />
              </div>

              {selectedInsuranceTier !== 'none' && formData.package_weight && (
                <PackagingRequirementsCard 
                  selectedTier={selectedInsuranceTier}
                  packageWeight={parseFloat(formData.package_weight)}
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tracking_number">Tracking Number *</Label>
                    <Input
                      id="tracking_number"
                      value={formData.tracking_number}
                      onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                      required
                      placeholder="9400 1234 5678 9000 0000 00"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sender_business_name">Sender Business Name</Label>
                    <Input
                      id="sender_business_name"
                      value={formData.sender_business_name}
                      onChange={(e) => setFormData({ ...formData, sender_business_name: e.target.value })}
                      placeholder="ABC Company"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      required
                      placeholder="John Doe"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_email">Customer Email</Label>
                    <Input
                      id="customer_email"
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                      placeholder="customer@email.com"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="carrier_name">Your Name (Carrier) *</Label>
                    <Input
                      id="carrier_name"
                      value={formData.carrier_name}
                      onChange={(e) => setFormData({ ...formData, carrier_name: e.target.value })}
                      required
                      placeholder="Jane Smith"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="carrier_email">Your Email (for payments)</Label>
                    <Input
                      id="carrier_email"
                      type="email"
                      value={formData.carrier_email}
                      onChange={(e) => setFormData({ ...formData, carrier_email: e.target.value })}
                      placeholder="carrier@usps.com"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="scheduled_delivery_date">Scheduled Delivery Date</Label>
                    <Input
                      id="scheduled_delivery_date"
                      type="date"
                      value={formData.scheduled_delivery_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_delivery_date: e.target.value })}
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="delivery_address">Delivery Address *</Label>
                  <Input
                    id="delivery_address"
                    value={formData.delivery_address}
                    onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                    required
                    placeholder="123 Main St, City, State 12345"
                    className="border-blue-200 focus:border-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="carrier_notes">Special Instructions / Notes</Label>
                  <Textarea
                    id="carrier_notes"
                    value={formData.carrier_notes}
                    onChange={(e) => setFormData({ ...formData, carrier_notes: e.target.value })}
                    placeholder="e.g., Large package, leave at side door, signature required for medications..."
                    rows={3}
                    className="border-blue-200 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="package_value">Package Value *</Label>
                    <Input
                      id="package_value"
                      type="number"
                      step="0.01"
                      value={formData.package_value}
                      onChange={(e) => setFormData({ ...formData, package_value: e.target.value })}
                      placeholder="150.00"
                      className="border-blue-200 focus:border-blue-500"
                      required={selectedInsuranceTier !== 'none'}
                    />
                  </div>

                  <div>
                    <Label htmlFor="package_weight">Package Weight (lbs) *</Label>
                    <Input
                      id="package_weight"
                      type="number"
                      step="0.1"
                      value={formData.package_weight}
                      onChange={(e) => setFormData({ ...formData, package_weight: e.target.value })}
                      placeholder="5.5"
                      className="border-blue-200 focus:border-blue-500"
                      required={selectedInsuranceTier !== 'none'}
                    />
                  </div>

                  <div>
                    <Label htmlFor="package_dimensions">Dimensions (LxWxH)</Label>
                    <Input
                      id="package_dimensions"
                      value={formData.package_dimensions}
                      onChange={(e) => setFormData({ ...formData, package_dimensions: e.target.value })}
                      placeholder="12x8x6"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="package_photo">Package Photo</Label>
                  <div className="mt-2">
                    <Input
                      id="package_photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                      className="border-blue-200"
                    />
                    {uploading && <p className="text-sm text-blue-600 mt-2">Uploading photo...</p>}
                    {formData.package_photo_url && (
                      <div className="mt-3">
                        <img 
                          src={formData.package_photo_url} 
                          alt="Package preview" 
                          className="h-32 rounded-lg border-2 border-blue-200"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDeliveryMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {createDeliveryMutation.isPending ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {pendingPackagingVerification > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-orange-900 mb-4 flex items-center gap-2">
              <Package className="w-6 h-6" />
              Packages Awaiting Packaging Verification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deliveries
                .filter(d => d.has_premium_insurance && !d.packaging_verified && d.status !== 'packaging_rejected')
                .map((delivery) => (
                  <Card key={delivery.id} className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-white">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <Badge className="bg-orange-500 text-white mb-2">
                            PACKAGING CHECK REQUIRED
                          </Badge>
                          <p className="font-mono text-sm font-bold">{delivery.tracking_number}</p>
                          <p className="font-semibold">{delivery.customer_name}</p>
                        </div>
                        <Package className="w-8 h-8 text-orange-600" />
                      </div>

                      <div className="space-y-2 text-sm mb-4 p-3 bg-white rounded-lg border border-orange-200">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Weight:</span>
                          <span className="font-bold">{delivery.package_weight} lbs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Value:</span>
                          <span className="font-bold">${delivery.package_value}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Insurance:</span>
                          <span className="font-bold">{delivery.insurance_tier?.toUpperCase()}</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => startPackagingVerification(delivery)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Verify Packaging Now
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {insuredCount > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-yellow-900 mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Premium Insured Packages - Special Handling Required
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deliveries
                .filter(d => d.has_premium_insurance && d.status !== 'delivered' && d.packaging_verified)
                .map((delivery) => {
                  const deliveryCheckpoints = checkpoints.filter(
                    c => c.delivery_request_id === delivery.id
                  );
                  
                  return (
                    <Card key={delivery.id} className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-white">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <Badge className="bg-yellow-500 text-white mb-2">
                              {delivery.insurance_tier?.toUpperCase()}
                            </Badge>
                            <p className="font-mono text-sm font-bold">{delivery.tracking_number}</p>
                            <p className="font-semibold">{delivery.customer_name}</p>
                          </div>
                          <Shield className="w-8 h-8 text-yellow-600" />
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Checkpoints:</span>
                            <span className="font-bold">
                              {delivery.checkpoints_completed || 0} / {delivery.total_checkpoints}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Package Value:</span>
                            <span className="font-semibold">${delivery.package_value}</span>
                          </div>
                        </div>

                        <Button
                          onClick={() => startCheckpoint(delivery)}
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Add Verification Checkpoint
                        </Button>
                        
                        {deliveryCheckpoints.length > 0 && (
                          <div className="mt-3 text-xs text-gray-600">
                            Last checkpoint: {deliveryCheckpoints[0]?.checkpoint_name}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Signed & Ready for Delivery</h2>
          {isLoading ? (
            <p className="text-blue-600">Loading deliveries...</p>
          ) : signedCount === 0 ? (
            <Card className="border-2 border-dashed border-blue-200 mb-8">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto text-blue-300 mb-4" />
                <p className="text-blue-600 text-lg">No signed packages ready for delivery</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {deliveries.filter(d => d.status === 'signed' || d.status === 'at_facility').map((delivery) => (
                <Card key={delivery.id} className="border-2 border-green-200">
                  <CardContent className="p-6">
                    <DeliveryCard delivery={delivery} onClick={() => {}} />
                    <Button
                      onClick={() => startDeliveryProof(delivery)}
                      className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >
                      Complete Delivery with Proof
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <h2 className="text-2xl font-bold text-blue-900 mb-4">All Delivery Requests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} onClick={() => {}} />
            ))}
          </div>
        </div>
      </div>

      <Dialog open={showPackagingDialog} onOpenChange={setShowPackagingDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-orange-900">Package Packaging Verification</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <PackagingVerificationCapture
              delivery={selectedDelivery}
              onApprove={handlePackagingApprove}
              onReject={handlePackagingReject}
              onCancel={() => setShowPackagingDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckpointDialog} onOpenChange={setShowCheckpointDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-blue-900">Package Verification Checkpoint</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <CheckpointCapture
              delivery={selectedDelivery}
              onComplete={handleCheckpointComplete}
              onCancel={() => setShowCheckpointDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-blue-900">Complete Delivery Verification</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <DeliveryProofCapture
              delivery={selectedDelivery}
              onComplete={handleProofComplete}
              onCancel={() => setShowProofDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}