import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Video, Upload, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function DeliveryProofCapture({ delivery, onComplete, onCancel }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [captureMode, setCaptureMode] = useState(null); // 'photo' or 'video'
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

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
      const file = new File([blob], `delivery-proof-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotoUrl(file_url);
        toast.success("Delivery photo captured!");
        stopCamera();
      } catch (error) {
        toast.error("Failed to upload photo");
      }
      setUploading(false);
    }, 'image/jpeg', 0.8);
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;

    recordedChunksRef.current = [];
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm'
    });

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      setUploading(true);
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `delivery-video-${Date.now()}.webm`, { type: 'video/webm' });
      
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setVideoUrl(file_url);
        toast.success("Delivery video uploaded!");
        stopCamera();
      } catch (error) {
        toast.error("Failed to upload video");
      }
      setUploading(false);
    };

    mediaRecorderRef.current.start();
    toast.success("Recording started - walk up to delivery location");
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (type === 'photo') {
        setPhotoUrl(file_url);
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

  const handleSubmit = () => {
    if (!photoUrl && !videoUrl) {
      toast.error("Please capture at least a photo or video proof");
      return;
    }
    onComplete({ photoUrl, videoUrl });
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
        <CardTitle className="text-white">Delivery Proof Verification</CardTitle>
        <p className="text-blue-100 text-sm">
          Package: {delivery.tracking_number} • {delivery.customer_name}
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">📸 Verification Instructions:</p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
            <li>Take a clear photo showing house number and delivery location</li>
            <li>For mailbox delivery: Show package in/near mailbox</li>
            <li>For door delivery: Show package at door with visible address</li>
            <li>Optional: Record video walking up to delivery point</li>
            <li>Earn ${delivery.carrier_payment?.toFixed(2) || '1.50'} for verified delivery!</li>
          </ul>
        </div>

        {/* Camera View */}
        {captureMode && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={captureMode === 'photo'}
              className="w-full rounded-lg border-2 border-blue-300"
            />
            <div className="flex gap-2 mt-3">
              {captureMode === 'photo' ? (
                <>
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
                </>
              ) : (
                <>
                  <Button
                    onClick={startVideoRecording}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                  <Button
                    onClick={stopVideoRecording}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Stop & Upload
                  </Button>
                  <Button
                    variant="outline"
                    onClick={stopCamera}
                    className="border-red-300 text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Capture Options */}
        {!captureMode && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => startCamera('photo')}
              variant="outline"
              className="h-24 flex-col gap-2 border-blue-300 hover:bg-blue-50"
            >
              <Camera className="w-8 h-8 text-blue-600" />
              <span className="text-sm font-semibold">Take Photo</span>
            </Button>
            <Button
              onClick={() => startCamera('video')}
              variant="outline"
              className="h-24 flex-col gap-2 border-blue-300 hover:bg-blue-50"
            >
              <Video className="w-8 h-8 text-blue-600" />
              <span className="text-sm font-semibold">Record Video</span>
            </Button>
          </div>
        )}

        {/* Upload Options */}
        {!captureMode && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'photo')}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload">
                <Button
                  variant="outline"
                  className="w-full border-blue-300 hover:bg-blue-50"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </span>
                </Button>
              </label>
            </div>
            <div>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileUpload(e, 'video')}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload">
                <Button
                  variant="outline"
                  className="w-full border-blue-300 hover:bg-blue-50"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Video
                  </span>
                </Button>
              </label>
            </div>
          </div>
        )}

        {/* Preview */}
        {(photoUrl || videoUrl) && (
          <div className="space-y-3 p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Delivery Proof Captured
            </p>
            {photoUrl && (
              <div>
                <p className="text-xs text-green-800 mb-2">Photo:</p>
                <img src={photoUrl} alt="Delivery proof" className="w-full rounded-lg border-2 border-green-300" />
              </div>
            )}
            {videoUrl && (
              <div>
                <p className="text-xs text-green-800 mb-2">Video:</p>
                <video src={videoUrl} controls className="w-full rounded-lg border-2 border-green-300" />
              </div>
            )}
          </div>
        )}

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
            disabled={(!photoUrl && !videoUrl) || uploading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Delivery
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}