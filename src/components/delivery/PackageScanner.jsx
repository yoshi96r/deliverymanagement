import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scan, Package, AlertTriangle, CheckCircle2, HandMetal } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PackageScanner({ binId, binQrCode, onPackageScanned }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedPackage, setScannedPackage] = useState(null);

  const handleScanPackage = async () => {
    if (!trackingNumber) {
      toast.error("Please enter tracking number");
      return;
    }

    setScanning(true);
    try {
      // Find the delivery request
      const deliveries = await base44.entities.DeliveryRequest.filter({
        tracking_number: trackingNumber
      });

      if (deliveries.length === 0) {
        toast.error("Package not found");
        setScanning(false);
        return;
      }

      const delivery = deliveries[0];

      // Check if hand carry only
      if (delivery.hand_carry_only) {
        toast.error("⚠ HAND CARRY ONLY - Cannot place in bin!");
        setScanning(false);
        return;
      }

      // Update package location
      await base44.entities.DeliveryRequest.update(delivery.id, {
        current_bin_id: binId,
        current_bin_qr: binQrCode,
        status: 'in_bin',
      });

      // Record location tracking
      await base44.entities.LocationTracking.create({
        tracking_number: trackingNumber,
        delivery_request_id: delivery.id,
        timestamp: new Date().toISOString(),
        location_type: 'bin',
        bin_id: binId,
        bin_qr_code: binQrCode,
        action: 'placed_in_bin',
        scanned_by: delivery.carrier_name,
      });

      // Update bin counts
      const bin = await base44.entities.TransportBin.filter({ id: binId });
      if (bin.length > 0) {
        await base44.entities.TransportBin.update(binId, {
          package_count: (bin[0].package_count || 0) + 1,
          insured_package_count: delivery.has_premium_insurance ? 
            (bin[0].insured_package_count || 0) + 1 : bin[0].insured_package_count,
          total_value: (bin[0].total_value || 0) + (delivery.package_value || 0),
        });
      }

      setScannedPackage(delivery);
      toast.success("Package added to bin!");
      
      if (onPackageScanned) {
        onPackageScanned(delivery);
      }

      setTrackingNumber("");
    } catch (error) {
      toast.error("Error scanning package");
      console.error(error);
    }
    setScanning(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScanPackage();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700">
          <CardTitle className="text-white flex items-center gap-2">
            <Scan className="w-6 h-6" />
            Scan Packages Into Bin
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="tracking_number">Tracking Number / Barcode Scan</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="tracking_number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Scan or enter tracking number"
                className="border-purple-200 flex-1"
                autoFocus
              />
              <Button
                onClick={handleScanPackage}
                disabled={scanning || !trackingNumber}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Scan className="w-4 h-4 mr-2" />
                Scan
              </Button>
            </div>
          </div>

          <Alert className="border-2 border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-900 text-sm">
              <strong className="font-bold">Quick Scanning:</strong>
              <ul className="mt-1 ml-4 space-y-1 list-disc">
                <li>Use barcode scanner for fast scanning</li>
                <li>System automatically adds package to bin</li>
                <li>HAND CARRY packages cannot be binned</li>
                <li>Press Enter or click Scan button</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {scannedPackage && (
        <Card className={`border-2 ${scannedPackage.has_premium_insurance ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="font-bold text-lg">Package Added to Bin</p>
                </div>
                <p className="font-mono text-sm">{scannedPackage.tracking_number}</p>
                <p className="text-sm text-gray-700">{scannedPackage.customer_name}</p>
              </div>
              {scannedPackage.has_premium_insurance && (
                <Badge className="bg-yellow-500 text-white">
                  {scannedPackage.insurance_tier?.toUpperCase()} INSURED
                </Badge>
              )}
            </div>

            {scannedPackage.hand_carry_only && (
              <Alert className="border-2 border-red-400 bg-red-50">
                <HandMetal className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-900 font-bold">
                  ⚠ HAND CARRY ONLY - KEEP SEPARATE
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              <div>
                <p className="text-gray-600">Weight:</p>
                <p className="font-semibold">{scannedPackage.package_weight} lbs</p>
              </div>
              <div>
                <p className="text-gray-600">Value:</p>
                <p className="font-semibold">${scannedPackage.package_value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}