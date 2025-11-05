import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X, CheckCircle2, XCircle, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PackagingVerificationCapture({ delivery, onApprove, onReject, onCancel }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [boxStrength, setBoxStrength] = useState("");
  const [packagingMeetsRequirements, setPackagingMeetsRequirements] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Could not access camera");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    setUploading(true);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `packaging-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotoUrl(file_url);
        toast.success("Packaging photo captured!");
        stopCamera();
      } catch (error) {
        toast.error("Failed to upload photo");
      }
      setUploading(false);
    }, 'image/jpeg', 0.9);
  };

  const handleApprove = () => {
    if (!photoUrl) {
      toast.error("Please capture a photo of the packaging");
      return;
    }
    if (!boxStrength) {
      toast.error("Please verify the box strength");
      return;
    }
    
    onApprove({
      photoUrl,
      boxStrength,
      notes,
      verifiedBy: delivery.carrier_name,
    });
  };

  const handleReject = () => {
    if (!photoUrl) {
      toast.error("Please capture a photo of the inadequate packaging");
      return;
    }
    if (!rejectionReason) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    
    onReject({
      photoUrl,
      boxStrength,
      rejectionReason,
      notes,
      verifiedBy: delivery.carrier_name,
    });
  };

  return (
    <Card className="border-2 border-orange-300">
      <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600">
        <CardTitle className="text-white">Packaging Verification - MANDATORY CHECK</CardTitle>
        <div className="mt-2">
          <p className="text-orange-100 text-sm">
            {delivery.tracking_number} • {delivery.insurance_tier?.toUpperCase()} Tier
          </p>
          <Badge className="bg-white text-orange-700 mt-2">
            Required: {delivery.required_box_type || "Check packaging requirements"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <Alert className="border-2 border-red-300 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-900 text-sm">
            <strong className="font-bold">CRITICAL VERIFICATION REQUIRED</strong>
            <p className="mt-1">
              This package has {delivery.insurance_tier} insurance. You MUST verify the packaging meets requirements:
            </p>
            <ul className="mt-2 ml-4 space-y-1 list-disc">
              <li>Appropriate box strength for {delivery.package_weight} lbs</li>
              <li>Proper packing materials visible</li>
              <li>Box is in good condition (no tears, crushing, or damage)</li>
              <li>Insurance label clearly visible</li>
            </ul>
            <p className="mt-2 font-bold">
              If packaging is inadequate, REJECT the shipment to protect carrier liability.
            </p>
          </AlertDescription>
        </Alert>

        {/* Package Details */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div>
            <p className="text-xs font-semibold text-blue-600">Package Weight</p>
            <p className="text-lg font-bold text-blue-900">{delivery.package_weight} lbs</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-600">Declared Value</p>
            <p className="text-lg font-bold text-blue-900">${delivery.package_value}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-600">Insurance Tier</p>
            <p className="text-lg font-bold text-blue-900">{delivery.insurance_tier?.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-600">Dimensions</p>
            <p className="text-lg font-bold text-blue-900">{delivery.package_dimensions || "N/A"}</p>
          </div>
        </div>

        {/* Camera View */}
        {showCamera && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg border-2 border-orange-300"
            />
            <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
              <p className="text-sm font-bold text-yellow-900 mb-2">📸 Photo Must Show:</p>
              <ul className="text-xs text-yellow-800 space-y-1 ml-4 list-disc">
                <li>Clear view of box type and condition</li>
                <li>Box strength rating label if visible</li>
                <li>Insurance tier sticker/label</li>
                <li>Any visible damage or concerns</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={capturePhoto}
                disabled={uploading}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                <Camera className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : "Capture Photo"}
              </Button>
              <Button
                variant="outline"
                onClick={stopCamera}
                className="border-red-300 text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Capture Button */}
        {!showCamera && !photoUrl && (
          <Button
            onClick={startCamera}
            className="w-full h-24 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-lg"
          >
            <Camera className="w-8 h-8 mr-3" />
            Start Packaging Verification
          </Button>
        )}

        {/* Photo Preview */}
        {photoUrl && (
          <div className="space-y-3">
            <div className="relative">
              <img src={photoUrl} alt="Packaging" className="w-full rounded-lg border-2 border-green-300" />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={() => {
                  setPhotoUrl(null);
                  setShowCamera(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Verification Form */}
        {photoUrl && (
          <div className="space-y-4 pt-4 border-t-2 border-gray-200">
            <div>
              <Label htmlFor="box_strength">Box Strength Rating</Label>
              <Select value={boxStrength} onValueChange={setBoxStrength}>
                <SelectTrigger className="border-orange-200">
                  <SelectValue placeholder="Select observed box strength" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_wall">Single Wall (Light duty)</SelectItem>
                  <SelectItem value="double_wall">Double Wall (Standard)</SelectItem>
                  <SelectItem value="triple_wall">Triple Wall (Heavy duty)</SelectItem>
                  <SelectItem value="heavy_duty">Heavy Duty / Reinforced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Does Packaging Meet Requirements?</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Button
                  variant={packagingMeetsRequirements === true ? "default" : "outline"}
                  onClick={() => {
                    setPackagingMeetsRequirements(true);
                    setRejectionReason("");
                  }}
                  className={packagingMeetsRequirements === true ? "bg-green-600 hover:bg-green-700" : "border-green-300 text-green-700"}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Approve - Meets Requirements
                </Button>
                <Button
                  variant={packagingMeetsRequirements === false ? "default" : "outline"}
                  onClick={() => setPackagingMeetsRequirements(false)}
                  className={packagingMeetsRequirements === false ? "bg-red-600 hover:bg-red-700" : "border-red-300 text-red-700"}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject - Inadequate
                </Button>
              </div>
            </div>

            {packagingMeetsRequirements === false && (
              <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 space-y-3">
                <Label htmlFor="rejection_reason" className="text-red-900 font-bold">
                  Rejection Reason *
                </Label>
                <Select value={rejectionReason} onValueChange={setRejectionReason}>
                  <SelectTrigger className="border-red-300">
                    <SelectValue placeholder="Select reason for rejection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="box_too_weak">Box strength insufficient for weight</SelectItem>
                    <SelectItem value="damaged_box">Box is damaged/crushed before shipping</SelectItem>
                    <SelectItem value="no_padding">Insufficient packing materials visible</SelectItem>
                    <SelectItem value="wrong_box_type">Wrong box type for insurance tier</SelectItem>
                    <SelectItem value="overpacked">Box appears overfilled/unstable</SelectItem>
                    <SelectItem value="no_reinforcement">Missing required reinforcement</SelectItem>
                  </SelectContent>
                </Select>
                <Alert className="border-red-400">
                  <AlertDescription className="text-red-900 text-xs">
                    ⚠ Rejection will return package to sender for repacking. Insurance will be refunded.
                    Sender will be notified with photo evidence.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional observations about the packaging..."
                rows={3}
                className="border-orange-200"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1 border-gray-300"
              >
                Cancel
              </Button>
              {packagingMeetsRequirements === false ? (
                <Button
                  onClick={handleReject}
                  disabled={!rejectionReason}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Shipment
                </Button>
              ) : (
                <Button
                  onClick={handleApprove}
                  disabled={!boxStrength || packagingMeetsRequirements !== true}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve & Continue
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}