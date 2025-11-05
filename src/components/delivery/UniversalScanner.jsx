import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scan, Package, QrCode, CheckCircle2, ArrowRight, Layers } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UniversalScanner({ targetBinId, targetBinQrCode, onItemScanned }) {
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const [itemType, setItemType] = useState(null);

  const detectQRType = (code) => {
    // Auto-detect what type of QR code this is
    if (code.startsWith('BIN-')) {
      return 'bin';
    } else if (code.match(/^\d{20,22}$/)) {
      // Standard USPS tracking number format
      return 'package';
    } else if (code.includes('USPS') || code.includes('9400')) {
      return 'package';
    } else {
      // Try to find in database
      return 'unknown';
    }
  };

  const handleScan = async () => {
    if (!scanCode) {
      toast.error("Please enter or scan a code");
      return;
    }

    setScanning(true);
    try {
      const codeType = detectQRType(scanCode);
      
      if (codeType === 'bin') {
        await handleBinScan(scanCode);
      } else if (codeType === 'package') {
        await handlePackageScan(scanCode);
      } else {
        // Try both - check packages first, then bins
        const packageResult = await tryPackageScan(scanCode);
        if (!packageResult) {
          const binResult = await tryBinScan(scanCode);
          if (!binResult) {
            toast.error("Code not recognized. Please verify the QR code.");
            setScanning(false);
            return;
          }
        }
      }

      setScanCode("");
    } catch (error) {
      toast.error("Error processing scan");
      console.error(error);
    }
    setScanning(false);
  };

  const tryPackageScan = async (code) => {
    try {
      const deliveries = await base44.entities.DeliveryRequest.filter({
        tracking_number: code
      });

      if (deliveries.length > 0) {
        await handlePackageScan(code, deliveries[0]);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const tryBinScan = async (code) => {
    try {
      const bins = await base44.entities.TransportBin.filter({
        bin_qr_code: code
      });

      if (bins.length > 0) {
        await handleBinScan(code, bins[0]);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handlePackageScan = async (trackingNumber, deliveryData = null) => {
    const delivery = deliveryData || (await base44.entities.DeliveryRequest.filter({
      tracking_number: trackingNumber
    }))[0];

    if (!delivery) {
      toast.error("Package not found in system");
      return;
    }

    // Check if hand carry only
    if (delivery.hand_carry_only) {
      setScannedItem(delivery);
      setItemType('hand_carry');
      toast.error("⚠ HAND CARRY ONLY - Cannot place in bin!");
      return;
    }

    // Update package location to target bin
    await base44.entities.DeliveryRequest.update(delivery.id, {
      current_bin_id: targetBinId,
      current_bin_qr: targetBinQrCode,
      status: 'in_bin',
      location_scans: (delivery.location_scans || 0) + 1,
    });

    // Record location tracking
    await base44.entities.LocationTracking.create({
      tracking_number: trackingNumber,
      delivery_request_id: delivery.id,
      timestamp: new Date().toISOString(),
      location_type: 'bin',
      bin_id: targetBinId,
      bin_qr_code: targetBinQrCode,
      action: 'placed_in_bin',
      scanned_by: delivery.carrier_name || 'Clerk',
    });

    // Update target bin counts
    if (targetBinId) {
      const bin = await base44.entities.TransportBin.filter({ id: targetBinId });
      if (bin.length > 0) {
        await base44.entities.TransportBin.update(targetBinId, {
          package_count: (bin[0].package_count || 0) + 1,
          insured_package_count: delivery.has_premium_insurance ? 
            (bin[0].insured_package_count || 0) + 1 : bin[0].insured_package_count,
          total_value: (bin[0].total_value || 0) + (delivery.package_value || 0),
        });
      }
    }

    setScannedItem(delivery);
    setItemType('package');
    toast.success(`Package scanned into bin!`);
    
    if (onItemScanned) {
      onItemScanned({ type: 'package', item: delivery });
    }
  };

  const handleBinScan = async (binQrCode, binData = null) => {
    const sourceBin = binData || (await base44.entities.TransportBin.filter({
      bin_qr_code: binQrCode
    }))[0];

    if (!sourceBin) {
      toast.error("Bin not found in system");
      return;
    }

    if (sourceBin.id === targetBinId) {
      toast.error("Cannot scan a bin into itself");
      return;
    }

    // Get all packages in the source bin
    const packagesInBin = await base44.entities.DeliveryRequest.filter({
      current_bin_id: sourceBin.id
    });

    // Transfer all packages from source bin to target bin
    for (const pkg of packagesInBin) {
      await base44.entities.DeliveryRequest.update(pkg.id, {
        current_bin_id: targetBinId,
        current_bin_qr: targetBinQrCode,
        location_scans: (pkg.location_scans || 0) + 1,
      });

      // Record location tracking
      await base44.entities.LocationTracking.create({
        tracking_number: pkg.tracking_number,
        delivery_request_id: pkg.id,
        timestamp: new Date().toISOString(),
        location_type: 'bin',
        bin_id: targetBinId,
        bin_qr_code: targetBinQrCode,
        action: 'transferred_to_vehicle',
        scanned_by: 'Clerk',
        notes: `Transferred from bin ${sourceBin.bin_number}`,
      });
    }

    // Update target bin with consolidated counts
    if (targetBinId) {
      const targetBin = await base44.entities.TransportBin.filter({ id: targetBinId });
      if (targetBin.length > 0) {
        await base44.entities.TransportBin.update(targetBinId, {
          package_count: (targetBin[0].package_count || 0) + (sourceBin.package_count || 0),
          insured_package_count: (targetBin[0].insured_package_count || 0) + (sourceBin.insured_package_count || 0),
          total_value: (targetBin[0].total_value || 0) + (sourceBin.total_value || 0),
        });
      }
    }

    // Mark source bin as sealed/completed
    await base44.entities.TransportBin.update(sourceBin.id, {
      status: 'sealed',
      sealed_timestamp: new Date().toISOString(),
      package_count: 0,
      insured_package_count: 0,
      total_value: 0,
    });

    setScannedItem({ ...sourceBin, packagesTransferred: packagesInBin.length });
    setItemType('bin');
    toast.success(`Bin ${sourceBin.bin_number} consolidated! ${packagesInBin.length} packages transferred.`);
    
    if (onItemScanned) {
      onItemScanned({ type: 'bin', item: sourceBin, packagesTransferred: packagesInBin.length });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700">
          <CardTitle className="text-white flex items-center gap-2">
            <Scan className="w-6 h-6" />
            Universal Scanner - Auto-Detect QR Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="scan_code">Scan Any QR Code (Package or Bin)</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="scan_code"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Scan barcode or QR code here..."
                className="border-purple-200 flex-1 text-lg"
                autoFocus
              />
              <Button
                onClick={handleScan}
                disabled={scanning || !scanCode}
                className="bg-purple-600 hover:bg-purple-700 px-8"
              >
                <Scan className="w-4 h-4 mr-2" />
                Scan
              </Button>
            </div>
          </div>

          <Alert className="border-2 border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-900 text-sm">
              <strong className="font-bold">Smart Scanning System:</strong>
              <ul className="mt-1 ml-4 space-y-1 list-disc">
                <li>Automatically detects package tracking numbers</li>
                <li>Recognizes bin QR codes (BIN-xxxxx)</li>
                <li>Scan bin-to-bin for bulk consolidation</li>
                <li>All items tracked with location history</li>
                <li>Press Enter or click Scan button</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {scannedItem && (
        <Card className={`border-2 ${
          itemType === 'hand_carry' ? 'border-red-300 bg-red-50' :
          itemType === 'bin' ? 'border-purple-300 bg-purple-50' :
          scannedItem.has_premium_insurance ? 'border-yellow-300 bg-yellow-50' : 
          'border-green-300 bg-green-50'
        }`}>
          <CardContent className="p-6">
            {itemType === 'package' && (
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="font-bold text-lg">Package Added to Bin</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Package className="w-4 h-4" />
                    <span className="font-mono">{scannedItem.tracking_number}</span>
                  </div>
                  <p className="text-sm text-gray-700">{scannedItem.customer_name}</p>
                  <p className="text-xs text-gray-600">{scannedItem.delivery_address}</p>
                </div>
                {scannedItem.has_premium_insurance && (
                  <Badge className="bg-yellow-500 text-white">
                    {scannedItem.insurance_tier?.toUpperCase()}
                  </Badge>
                )}
              </div>
            )}

            {itemType === 'bin' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-6 h-6 text-purple-600" />
                  <p className="font-bold text-lg">Bin Consolidated</p>
                </div>
                <div className="flex items-center gap-3 text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-purple-600" />
                    <span className="font-mono font-bold">{scannedItem.bin_number}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-700">Target Bin</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg border border-purple-300">
                  <p className="text-sm font-bold text-purple-900">
                    ✓ {scannedItem.packagesTransferred} packages transferred
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    All items now consolidated in target bin for bulk transport
                  </p>
                </div>
              </div>
            )}

            {itemType === 'hand_carry' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="font-bold text-lg text-red-900">HAND CARRY ONLY</p>
                </div>
                <p className="text-sm text-red-800 mb-2">This package requires manual handling</p>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-red-600" />
                  <span className="font-mono">{scannedItem.tracking_number}</span>
                </div>
                <p className="text-sm text-red-700 mt-2">{scannedItem.customer_name}</p>
              </div>
            )}

            {(itemType === 'package' || itemType === 'hand_carry') && (
              <div className="grid grid-cols-3 gap-3 text-sm mt-4 pt-3 border-t">
                <div>
                  <p className="text-gray-600">Weight:</p>
                  <p className="font-semibold">{scannedItem.package_weight} lbs</p>
                </div>
                <div>
                  <p className="text-gray-600">Value:</p>
                  <p className="font-semibold">${scannedItem.package_value}</p>
                </div>
                <div>
                  <p className="text-gray-600">Scans:</p>
                  <p className="font-semibold">{(scannedItem.location_scans || 0) + 1}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}