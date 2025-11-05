import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Video, Upload, CheckCircle2, X, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const checkpointTypes = [
  { value: "facility_received", label: "Facility Received", payment: 2.00 },
  { value: "sorting_center", label: "At Sorting Center", payment: 2.50 },
  { value: "loaded_on_truck", label: "Loaded on Truck", payment: 3.00 },
  { value: "out_for_delivery", label: "Out for Delivery", payment: 3.50 },
  { value: "at_customer_location", label: "At Customer Location", payment: 4.00 },
  { value: "final_delivery", label: "Final Delivery", payment: 5.00 },
];

export default function CheckpointCapture({ delivery, onComplete, onCancel }) {
  const [checkpointType, setCheckpointType] = useState("facility_received");
  const [photoUrls, setPhotoUrls] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [captureMode, setCaptureMode] = useState(null);
  const [packageCondition, setPackageCondition] = useState("good");
  const [damageDetected, setDamageDetected] = useState(false);
  const [notes, setNotes] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const selectedCheckpoint = checkpointTypes.find(c => c.value === checkpointType);
  const insuranceMultiplier = delivery.insurance_tier === 'platinum' ? 2.5 : 
                              delivery.insurance_tier === 'premium' ? 2.0 :
                              delivery.insurance_tier === 'basic' ? 1.5 : 1.0;
  const paymentAmount = (selectedCheckpoint?.payment || 0) * insuranceMultiplier;

  const startCamera = async (mode) => {
    setCaptureMode(mode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: mode === 'video'
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
    setCaptureMode(null);
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
      const file = new File([blob], `checkpoint-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotoUrls([...photoUrls, file_url]);
        toast.success("Checkpoint photo captured!");
      } catch (error) {
        toast.error("Failed to upload photo");
      }
      setUploading(false);
    }, 'image/jpeg', 0.9);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (type === 'photo') {
        setPhotoUrls([...photoUrls, file_url]);
        toast.success("Photo uploaded!");
      } else {
        setVideoUrl(file_url);
        toast.success("Video uploaded!");
      }
    } catch (error) {
      toast.error(`Failed to upload ${type}`);
    }
    setUploading(false);
  };

  const removePhoto = (index) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (photoUrls.length === 0) {
      toast.error("Please capture at least one photo of the package");
      return;
    }
    
    if (damageDetected && !damageNotes) {
      toast.error("Please describe the damage detected");
      return;
    }

    onComplete({
      checkpointType,
      checkpointName: selectedCheckpoint.label,
      photoUrls,
      videoUrl,
      packageCondition: damageDetected ? 'damaged' : packageCondition,
      damageDetected,
      damageNotes,
      notes,
      paymentEarned: paymentAmount,
    });
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
        <CardTitle className="text-white">Package Verification Checkpoint</CardTitle>
        <div className="flex items-center justify-between mt-2">
          <p className="text-blue-100 text-sm">
            {delivery.tracking_number} • {delivery.customer_name}
          </p>
          {delivery.has_premium_insurance && (
            <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              ⭐ {delivery.insurance_tier?.toUpperCase()} INSURED
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Alert for Premium Insurance */}
        {delivery.has_premium_insurance && (
          <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
            <div className="flex items-start gap-3">
              <Package className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-yellow-900 mb-1">
                  PREMIUM INSURED PACKAGE - SPECIAL HANDLING REQUIRED
                </p>
                <ul className="text-xs text-yellow-800 space-y-1 ml-4 list-disc">
                  <li>Handle separately from regular mail</li>
                  <li>Document package condition with photos at EVERY stage</li>
                  <li>Scan and verify at each checkpoint</li>
                  <li>Report any damage immediately</li>
                  <li>Earn ${paymentAmount.toFixed(2)} for this verification (${insuranceMultiplier}x bonus!)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Checkpoint Type Selection */}
        <div>
          <Label htmlFor="checkpoint_type">Checkpoint Stage</Label>
          <Select value={checkpointType} onValueChange={setCheckpointType}>
            <SelectTrigger className="border-blue-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {checkpointTypes.map((checkpoint) => (
                <SelectItem key={checkpoint.value} value={checkpoint.value}>
                  {checkpoint.label} - ${(checkpoint.payment * insuranceMultiplier).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Camera View */}
        {captureMode === 'photo' && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg border-2 border-blue-300"
            />
            <div className="flex gap-2 mt-3">
              <Button
                onClick={capturePhoto}
                disabled={uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
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

        {/* Capture Options */}
        {!captureMode && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => startCamera('photo')}
              variant="outline"
              className="h-20 flex-col gap-2 border-blue-300 hover:bg-blue-50"
            >
              <Camera className="w-6 h-6 text-blue-600" />
              <span className="text-sm font-semibold">Take Photo</span>
            </Button>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'photo')}
                className="hidden"
                id="photo-upload"
                multiple
              />
              <label htmlFor="photo-upload" className="block">
                <Button
                  variant="outline"
                  className="w-full h-20 flex-col gap-2 border-blue-300 hover:bg-blue-50"
                  asChild
                >
                  <span>
                    <Upload className="w-6 h-6 text-blue-600" />
                    <span className="text-sm font-semibold">Upload Photo</span>
                  </span>
                </Button>
              </label>
            </div>
          </div>
        )}

        {/* Photo Preview */}
        {photoUrls.length > 0 && (
          <div className="space-y-2">
            <Label>Captured Photos ({photoUrls.length})</Label>
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img src={url} alt={`Checkpoint ${index + 1}`} className="w-full h-24 object-cover rounded-lg border-2 border-green-300" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Package Condition */}
        <div>
          <Label htmlFor="package_condition">Package Condition</Label>
          <Select value={packageCondition} onValueChange={setPackageCondition}>
            <SelectTrigger className="border-blue-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">✓ Excellent - Perfect condition</SelectItem>
              <SelectItem value="good">✓ Good - Normal condition</SelectItem>
              <SelectItem value="fair">⚠ Fair - Minor wear</SelectItem>
              <SelectItem value="damaged">✗ Damaged - Report required</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Damage Detection */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="damage_detected"
            checked={damageDetected}
            onChange={(e) => setDamageDetected(e.target.checked)}
            className="w-5 h-5 text-red-600 border-2 border-red-300 rounded focus:ring-red-500"
          />
          <label htmlFor="damage_detected" className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Damage Detected at This Stage
          </label>
        </div>

        {/* Damage Notes */}
        {damageDetected && (
          <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 space-y-3">
            <Label htmlFor="damage_notes" className="text-red-900 font-bold">Damage Description *</Label>
            <Textarea
              id="damage_notes"
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Describe the damage: crushed corner, torn packaging, dent, etc..."
              rows={3}
              className="border-red-300"
            />
            <p className="text-xs text-red-700">
              ⚠ This damage report will be documented and sender will be notified immediately.
            </p>
          </div>
        )}

        {/* Additional Notes */}
        <div>
          <Label htmlFor="notes">Additional Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional observations or notes about handling..."
            rows={2}
            className="border-blue-200"
          />
        </div>

        {/* Payment Info */}
        <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-900">Verification Payment</p>
              <p className="text-xs text-green-700">For completing this checkpoint</p>
            </div>
            <p className="text-2xl font-bold text-green-700">${paymentAmount.toFixed(2)}</p>
          </div>
          {insuranceMultiplier > 1 && (
            <p className="text-xs text-green-700 mt-2 font-semibold">
              🎉 {insuranceMultiplier}x bonus for premium insured package!
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={photoUrls.length === 0 || uploading || (damageDetected && !damageNotes)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Checkpoint
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}