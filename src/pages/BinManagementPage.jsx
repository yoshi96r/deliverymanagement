import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, QrCode, Truck, MapPin, Scan, Shield, HandMetal } from "lucide-react";
import BinManagement from "../components/delivery/BinManagement";
import UniversalScanner from "../components/delivery/UniversalScanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BinManagementPage() {
  const [selectedBin, setSelectedBin] = useState(null);
  const [showScanDialog, setShowScanDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: bins, isLoading: binsLoading } = useQuery({
    queryKey: ['transportBins'],
    queryFn: () => base44.entities.TransportBin.list('-created_date'),
    initialData: [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ['deliveryRequests'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date'),
    initialData: [],
  });

  const handleBinCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['transportBins'] });
  };

  const handleItemScanned = () => {
    queryClient.invalidateQueries({ queryKey: ['transportBins'] });
    queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
  };

  const openScanDialog = (bin) => {
    setSelectedBin(bin);
    setShowScanDialog(true);
  };

  const activeBins = bins.filter(b => b.status === 'active');
  const handCarryPackages = deliveries.filter(d => d.hand_carry_only && !['delivered', 'packaging_rejected'].includes(d.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-purple-900 mb-2">
            Universal Scanning & Bin Management
          </h1>
          <p className="text-purple-600">Smart QR scanning - automatically detects packages and bins</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Active Bins</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{activeBins.length}</p>
                </div>
                <QrCode className="w-10 h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Packages in Bins</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    {bins.reduce((sum, b) => sum + (b.package_count || 0), 0)}
                  </p>
                </div>
                <Package className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Insured Packages</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">
                    {bins.reduce((sum, b) => sum + (b.insured_package_count || 0), 0)}
                  </p>
                </div>
                <Shield className="w-10 h-10 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Hand Carry Only</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{handCarryPackages.length}</p>
                </div>
                <HandMetal className="w-10 h-10 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Highlight */}
        <Card className="mb-8 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Scan className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-purple-900 mb-2">🎯 Smart Universal Scanner</h3>
                <p className="text-sm text-purple-800 mb-3">
                  Revolutionary scanning system that automatically detects what you're scanning - no need to specify!
                  Scan packages, bins, or any QR code and the system handles it intelligently.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-purple-900">Auto-detects packages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-purple-900">Recognizes bin codes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-purple-900">Bin-to-bin transfers</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-purple-100">
            <TabsTrigger value="create">Create Bin</TabsTrigger>
            <TabsTrigger value="bins">Active Bins</TabsTrigger>
            <TabsTrigger value="handcarry">Hand Carry Packages</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <BinManagement onBinCreated={handleBinCreated} />
          </TabsContent>

          <TabsContent value="bins">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-purple-900">Active Transport Bins</h2>
              </div>

              {activeBins.length === 0 ? (
                <Card className="border-2 border-dashed border-purple-200">
                  <CardContent className="p-12 text-center">
                    <QrCode className="w-16 h-16 mx-auto text-purple-300 mb-4" />
                    <p className="text-purple-600 text-lg">No active bins</p>
                    <p className="text-purple-500 text-sm">Create your first transport bin</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeBins.map((bin) => (
                    <Card key={bin.id} className="border-2 border-purple-200 hover:shadow-xl transition-all">
                      <CardHeader className="bg-purple-50 border-b-2 border-purple-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-purple-900">{bin.bin_number}</CardTitle>
                            <p className="text-sm text-purple-600 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {bin.facility_name}
                            </p>
                            {bin.facility_zone && (
                              <p className="text-xs text-purple-500">{bin.facility_zone}</p>
                            )}
                          </div>
                          <Badge className="bg-purple-600 text-white">
                            {bin.package_count || 0} pkgs
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Regular:</p>
                            <p className="font-bold">{(bin.package_count || 0) - (bin.insured_package_count || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Insured:</p>
                            <p className="font-bold text-yellow-700">{bin.insured_package_count || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total Value:</p>
                            <p className="font-bold text-green-700">${(bin.total_value || 0).toFixed(2)}</p>
                          </div>
                          {bin.destination_facility && (
                            <div className="col-span-2">
                              <p className="text-gray-600 flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                To:
                              </p>
                              <p className="font-semibold text-sm">{bin.destination_facility}</p>
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => openScanDialog(bin)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Scan className="w-4 h-4 mr-2" />
                          Universal Scanner
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="handcarry">
            <Card className="border-2 border-red-300">
              <CardHeader className="bg-red-50 border-b-2 border-red-200">
                <CardTitle className="text-red-900 flex items-center gap-2">
                  <HandMetal className="w-6 h-6" />
                  Hand Carry Only Packages - NO BINS / NO MECHANICAL SORTING
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {handCarryPackages.length === 0 ? (
                  <p className="text-center text-gray-600 py-8">No hand carry packages at this time</p>
                ) : (
                  <div className="space-y-4">
                    {handCarryPackages.map((pkg) => (
                      <Card key={pkg.id} className="border-2 border-red-200 bg-red-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-red-600 text-white">HAND CARRY</Badge>
                                {pkg.has_premium_insurance && (
                                  <Badge className="bg-yellow-500 text-white">
                                    {pkg.insurance_tier?.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-mono text-sm font-bold">{pkg.tracking_number}</p>
                              <p className="text-sm">{pkg.customer_name}</p>
                              <p className="text-xs text-gray-600 mt-1">{pkg.delivery_address}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Weight:</p>
                              <p className="font-bold">{pkg.package_weight} lbs</p>
                              <p className="text-sm text-gray-600 mt-2">Value:</p>
                              <p className="font-bold text-green-700">${pkg.package_value}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-purple-900">
              Universal Scanner: {selectedBin?.bin_number}
            </DialogTitle>
            <p className="text-sm text-purple-600">Scan any package or bin QR code</p>
          </DialogHeader>
          {selectedBin && (
            <UniversalScanner
              targetBinId={selectedBin.id}
              targetBinQrCode={selectedBin.bin_qr_code}
              onItemScanned={handleItemScanned}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}