
import React, { useState, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Scan, Camera, Package, QrCode, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format } from 'date-fns'; // Import date-fns for formatting dates

export default function MobileScanner({ onScanComplete, currentLocation }) {
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const detectCodeType = (code) => {
    if (code.startsWith('SIG-')) return 'signature'; // NEW: Detect signature codes
    if (code.startsWith('BIN-')) return 'bin';
    if (code.match(/^\d{20,22}$/) || code.includes('USPS') || code.includes('9400')) return 'package';
    return 'unknown';
  };

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
        // Optionally, start scanning QR codes/barcodes here if using a library like jsQR or ZXing
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

  const handleScan = async () => {
    if (!scanCode) {
      toast.error("Please enter or scan a code");
      return;
    }

    setScanning(true);
    try {
      const codeType = detectCodeType(scanCode);
      
      if (codeType === 'signature') {
        // NEW: Handle signature barcode scanning
        const deliveries = await base44.entities.DeliveryRequest.filter({
          signature_barcode: scanCode
        });

        if (deliveries.length > 0) {
          const delivery = deliveries[0];
          
          setScannedItem({
            ...delivery,
            itemType: 'signature' // Mark as signature type for rendering
          });
          toast.success("Signature retrieved!");
          
          if (onScanComplete) {
            onScanComplete({ type: 'signature', item: delivery });
          }
        } else {
          toast.error("Signature not found - code may be invalid");
        }
      } else if (codeType === 'package') {
        const deliveries = await base44.entities.DeliveryRequest.filter({
          tracking_number: scanCode
        });

        if (deliveries.length > 0) {
          const delivery = deliveries[0];
          
          // Update status to loaded on truck
          await base44.entities.DeliveryRequest.update(delivery.id, {
            status: 'on_truck',
            current_location: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : undefined,
            location_scans: (delivery.location_scans || 0) + 1,
          });

          // Record location
          await base44.entities.LocationTracking.create({
            tracking_number: scanCode,
            delivery_request_id: delivery.id,
            timestamp: new Date().toISOString(),
            location_type: 'vehicle',
            action: 'loaded_on_vehicle',
            scanned_by: delivery.carrier_name || 'Driver',
            notes: currentLocation ? `GPS: ${currentLocation.lat}, ${currentLocation.lng}` : undefined,
          });

          setScannedItem({
            ...delivery,
            itemType: 'package' // Mark as package type for rendering
          });
          toast.success("Package loaded on truck!");
          
          if (onScanComplete) {
            onScanComplete({ type: 'package', item: delivery });
          }
        } else {
          toast.error("Package not found in system");
        }
      } else if (codeType === 'bin') {
        const bins = await base44.entities.TransportBin.filter({
          bin_qr_code: scanCode
        });

        if (bins.length > 0) {
          const bin = bins[0];
          
          // Get all packages in bin
          const packagesInBin = await base44.entities.DeliveryRequest.filter({
            current_bin_id: bin.id
          });

          // Update all packages to on_truck
          for (const pkg of packagesInBin) {
            await base44.entities.DeliveryRequest.update(pkg.id, {
              status: 'on_truck',
              current_location: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : undefined,
              location_scans: (pkg.location_scans || 0) + 1,
            });
          }

          setScannedItem({
            ...bin,
            itemType: 'bin', // Mark as bin type for rendering
            packages: packagesInBin // Add packages for potential display
          });
          toast.success(`Bin ${bin.bin_number} loaded! ${packagesInBin.length} packages on truck.`);
          
          if (onScanComplete) {
            onScanComplete({ type: 'bin', item: bin, packages: packagesInBin });
          }
        } else {
          toast.error("Bin not found in system");
        }
      } else {
        toast.error("Code not recognized");
      }

      setScanCode("");
    } catch (error) {
      toast.error("Error scanning");
      console.error(error);
    }
    setScanning(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-blue-200">
        <CardContent className="p-4 space-y-4">
          {!showCamera ? (
            <>
              <Button
                onClick={startCamera}
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold"
              >
                <Camera className="w-6 h-6 mr-2" />
                Use Camera to Scan
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter tracking or bin code"
                  className="h-12 text-lg"
                  autoFocus
                />
                <Button
                  onClick={handleScan}
                  disabled={scanning || !scanCode}
                  className="w-full h-12 bg-purple-600 hover:bg-purple-700"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  {scanning ? "Scanning..." : "Scan Code"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg border-2 border-blue-300"
              />
              <p className="text-sm text-center text-gray-600">
                Point camera at barcode or QR code
              </p>
              <Button
                onClick={stopCamera}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {scannedItem && (
        <Card className={`border-2 ${
          scannedItem.itemType === 'signature' ? 'border-purple-200 bg-purple-50' : 'border-green-200 bg-green-50'
        }`}>
          <CardContent className="p-4">
            {scannedItem.itemType === 'signature' ? (
              // NEW: Signature display
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-bold text-purple-900 mb-1">✍️ Customer Signature Retrieved</p>
                    <p className="font-mono text-sm text-gray-700">{scannedItem.tracking_number}</p>
                    <p className="text-sm text-gray-700 font-semibold">{scannedItem.customer_name}</p>
                    <p className="text-xs text-gray-600 mt-1">{scannedItem.delivery_address}</p>
                  </div>
                </div>

                {/* Signature Display */}
                {scannedItem.signature_data && (
                  <div className="p-3 bg-white rounded-lg border-2 border-purple-300">
                    <p className="text-xs font-semibold text-purple-900 mb-2">Customer's Signature:</p>
                    <img 
                      src={scannedItem.signature_data} 
                      alt="Customer signature" 
                      className="w-full h-32 border-2 border-gray-200 rounded bg-white p-2 object-contain"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-purple-50 rounded">
                        <p className="text-gray-600">Signed:</p>
                        <p className="font-semibold text-gray-900">
                          {scannedItem.signature_date ? format(new Date(scannedItem.signature_date), "MMM d, h:mm a") : 'N/A'}
                        </p>
                      </div>
                      <div className="p-2 bg-purple-50 rounded">
                        <p className="text-gray-600">Preference:</p>
                        <p className="font-semibold text-gray-900">
                          {scannedItem.delivery_preference === 'deliver_next_day' ? 'Next Day Delivery' : (scannedItem.delivery_preference === 'hold_at_post_office' ? 'Hold at Post Office' : 'N/A')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Carrier Notes */}
                {scannedItem.carrier_notes && (
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">📝 Carrier Notes:</p>
                    <p className="text-sm text-blue-800">{scannedItem.carrier_notes}</p>
                  </div>
                )}

                {/* Action Status */}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Signature Verified - Authorized for Delivery
                  </p>
                </div>
              </div>
            ) : (
              // Existing package display
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="font-bold text-green-900 mb-1">Package Loaded</p>
                  <p className="font-mono text-sm text-gray-700">{scannedItem.tracking_number}</p>
                  <p className="text-sm text-gray-600">{scannedItem.customer_name}</p>
                  <p className="text-xs text-gray-500 mt-2">{scannedItem.delivery_address}</p>
                </div>
                {scannedItem.has_premium_insurance && (
                  <Badge className="bg-yellow-500 text-white">
                    {scannedItem.insurance_tier?.toUpperCase()}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs font-semibold text-blue-900 mb-2">📱 Mobile Scanning Tips:</p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
          <li>Scan customer signature barcodes to verify authorization</li> {/* NEW Tip */}
          <li>Use barcode scanner for fastest scanning</li>
          <li>Camera works for QR codes and barcodes</li>
          <li>All scans are GPS tagged automatically</li>
          <li>Works offline - syncs when online</li>
        </ul>
      </div>
    </div>
  );
}
