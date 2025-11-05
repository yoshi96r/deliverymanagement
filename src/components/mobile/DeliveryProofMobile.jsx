
import React, { useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { AutomatedCommunicationEngine } from "../customer/AutomatedCommunicationEngine";

export default function DeliveryProofMobile({ delivery, location, onComplete, onCancel }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
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
      setShowCamera(false);
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

    // Add GPS overlay
    if (location) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, canvas.height - 60, canvas.width - 20, 50);
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.fillText(`GPS: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`, 20, canvas.height - 35);
      ctx.fillText(`Time: ${new Date().toLocaleString()}`, 20, canvas.height - 15);
    }

    setUploading(true);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `delivery-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotoUrl(file_url);
        toast.success("Photo captured with GPS!");
        stopCamera();
      } catch (error) {
        toast.error("Failed to upload photo");
      }
      setUploading(false);
    }, 'image/jpeg', 0.9);
  };

  const handleSubmit = async () => {
    // Note: videoUrl is not currently managed by state in this component.
    // Its presence in the check below implies a potential future feature.
    const videoUrl = undefined; // Placeholder as video capture is not implemented yet.

    if (!photoUrl && !videoUrl) {
      toast.error("Please capture at least a photo or video proof");
      return;
    }

    // Send to parent
    onComplete({ photoUrl, videoUrl });

    // Send automated delivery confirmation - NEW
    try {
      await AutomatedCommunicationEngine.sendDeliveryConfirmation(delivery);
    } catch (error) {
      console.error("Failed to send delivery confirmation:", error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Package Info */}
      <Card className="border-blue-200">
        <CardContent className="p-4">
          <p className="font-bold text-gray-900 mb-1">{delivery.customer_name}</p>
          <p className="font-mono text-xs text-gray-600 mb-2">{delivery.tracking_number}</p>
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p>{delivery.delivery_address}</p>
          </div>
        </CardContent>
      </Card>

      {/* GPS Info */}
      {location && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs font-semibold text-green-900 mb-1">📍 GPS Location Active</p>
          <p className="text-xs text-green-700 font-mono">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      )}

      {/* Camera */}
      {!showCamera && !photoUrl && (
        <Button
          onClick={startCamera}
          className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold"
        >
          <Camera className="w-6 h-6 mr-2" />
          Take Delivery Photo
        </Button>
      )}

      {showCamera && (
        <div className="space-y-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg border-2 border-blue-300"
          />
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xs font-semibold text-yellow-900 mb-1">📸 Photo Must Show:</p>
            <ul className="text-xs text-yellow-800 space-y-1 ml-4 list-disc">
              <li>Package at delivery location</li>
              <li>House number or mailbox visible</li>
              <li>GPS will be embedded automatically</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={stopCamera}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={capturePhoto}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Camera className="w-4 h-4 mr-2" />
              {uploading ? "Saving..." : "Capture"}
            </Button>
          </div>
        </div>
      )}

      {photoUrl && (
        <div className="space-y-3">
          <img
            src={photoUrl}
            alt="Delivery proof"
            className="w-full rounded-lg border-2 border-green-300"
          />
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-bold text-green-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Photo Captured with GPS
            </p>
            <p className="text-xs text-green-700 mt-1">
              Location and timestamp embedded in photo
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setPhotoUrl(null);
                startCamera();
              }}
              variant="outline"
            >
              Retake
            </Button>
            <Button
              onClick={handleSubmit} // Changed from handleComplete to handleSubmit
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Delivery
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={onCancel}
        variant="outline"
        className="w-full"
      >
        Cancel
      </Button>
    </div>
  );
}
