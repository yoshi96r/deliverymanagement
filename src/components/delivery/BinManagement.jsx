import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, QrCode, Truck, MapPin, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function BinManagement({ onBinCreated }) {
  const [binNumber, setBinNumber] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [facilityZone, setFacilityZone] = useState("");
  const [destinationFacility, setDestinationFacility] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdBin, setCreatedBin] = useState(null);

  const generateBinQR = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BIN-${binNumber}-${timestamp}-${random}`;
  };

  const handleCreateBin = async () => {
    if (!binNumber || !facilityName) {
      toast.error("Please enter bin number and facility name");
      return;
    }

    setCreating(true);
    try {
      const qrCode = generateBinQR();
      const bin = await base44.entities.TransportBin.create({
        bin_qr_code: qrCode,
        bin_number: binNumber,
        current_location: facilityName,
        location_type: "facility",
        facility_name: facilityName,
        facility_zone: facilityZone,
        destination_facility: destinationFacility,
        status: "active",
        package_count: 0,
        insured_package_count: 0,
        total_value: 0,
      });

      setCreatedBin(bin);
      toast.success("Transport bin created with QR code!");
      
      if (onBinCreated) {
        onBinCreated(bin);
      }

      setBinNumber("");
      setFacilityZone("");
      setDestinationFacility("");
    } catch (error) {
      toast.error("Failed to create bin");
      console.error(error);
    }
    setCreating(false);
  };

  const handlePrintQR = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
          <CardTitle className="text-white flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            Create Transport Bin QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bin_number">Bin Number *</Label>
              <Input
                id="bin_number"
                value={binNumber}
                onChange={(e) => setBinNumber(e.target.value)}
                placeholder="BIN-001"
                className="border-blue-200"
              />
            </div>

            <div>
              <Label htmlFor="facility_name">Current Facility *</Label>
              <Input
                id="facility_name"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Main Sorting Center"
                className="border-blue-200"
              />
            </div>

            <div>
              <Label htmlFor="facility_zone">Facility Zone/Area</Label>
              <Input
                id="facility_zone"
                value={facilityZone}
                onChange={(e) => setFacilityZone(e.target.value)}
                placeholder="Zone A, Dock 3"
                className="border-blue-200"
              />
            </div>

            <div>
              <Label htmlFor="destination_facility">Destination Facility</Label>
              <Input
                id="destination_facility"
                value={destinationFacility}
                onChange={(e) => setDestinationFacility(e.target.value)}
                placeholder="Regional Distribution Center"
                className="border-blue-200"
              />
            </div>
          </div>

          <Button
            onClick={handleCreateBin}
            disabled={creating || !binNumber || !facilityName}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Creating..." : "Generate Bin QR Code"}
          </Button>
        </CardContent>
      </Card>

      {createdBin && (
        <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="bg-green-100 border-b-2 border-green-300">
            <div className="flex items-center justify-between">
              <CardTitle className="text-green-900 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                Bin Created Successfully!
              </CardTitle>
              <Badge className="bg-green-600 text-white">
                {createdBin.bin_number}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border-2 border-green-200 qr-print-area">
                <div className="mb-4 p-8 bg-gray-100 rounded-lg border-2 border-gray-300">
                  <QrCode className="w-32 h-32 text-gray-600" />
                </div>
                <div className="text-center mb-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">QR CODE ID:</p>
                  <p className="text-sm font-mono text-gray-900 break-all px-4 py-2 bg-gray-50 rounded border border-gray-300">
                    {createdBin.bin_qr_code}
                  </p>
                </div>
                <Button
                  onClick={handlePrintQR}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  Print Bin Label
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Attach this code to bin for scanning
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-xs font-semibold text-green-600 mb-1">BIN NUMBER</p>
                  <p className="text-lg font-bold text-green-900">{createdBin.bin_number}</p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    CURRENT LOCATION
                  </p>
                  <p className="font-semibold text-green-900">{createdBin.facility_name}</p>
                  {createdBin.facility_zone && (
                    <p className="text-sm text-green-700">{createdBin.facility_zone}</p>
                  )}
                </div>

                {createdBin.destination_facility && (
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      DESTINATION
                    </p>
                    <p className="font-semibold text-green-900">{createdBin.destination_facility}</p>
                  </div>
                )}

                <div className="p-4 bg-green-100 rounded-lg border-2 border-green-300">
                  <p className="text-xs font-bold text-green-900 mb-2">INSTRUCTIONS:</p>
                  <ul className="text-xs text-green-800 space-y-1 list-disc ml-4">
                    <li>Print and attach code to bin</li>
                    <li>Scan packages into bin throughout the day</li>
                    <li>Scan bin code when loading onto truck</li>
                    <li>All packages in bin tracked together</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}