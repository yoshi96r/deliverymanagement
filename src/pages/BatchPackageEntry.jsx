import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, Camera, Scan, Upload, CheckCircle2, 
  XCircle, Trash2, Plus, Download 
} from "lucide-react";
import { toast } from "sonner";

export default function BatchPackageEntry() {
  const [packages, setPackages] = useState([]);
  const [currentScan, setCurrentScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const queryClient = useQueryClient();

  const addPackageMutation = useMutation({
    mutationFn: async (packageData) => {
      return await base44.entities.DeliveryRequest.create({
        ...packageData,
        status: 'at_facility',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (packagesData) => {
      const results = [];
      for (const pkg of packagesData) {
        try {
          const result = await base44.entities.DeliveryRequest.create({
            tracking_number: pkg.tracking_number,
            customer_name: pkg.customer_name || 'Customer',
            delivery_address: pkg.delivery_address || 'To be assigned',
            carrier_name: pkg.carrier_name || 'Carrier',
            carrier_email: pkg.carrier_email || 'carrier@example.com',
            status: 'at_facility',
            package_weight: pkg.package_weight || 0,
          });
          results.push({ success: true, tracking: pkg.tracking_number, result });
        } catch (error) {
          results.push({ success: false, tracking: pkg.tracking_number, error: error.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      queryClient.invalidateQueries({ queryKey: ['deliveryRequests'] });
      
      if (failCount === 0) {
        toast.success(`All ${successCount} packages added successfully!`);
        setPackages([]);
      } else {
        toast.warning(`${successCount} packages added, ${failCount} failed.`);
      }
    },
  });

  const handleScan = () => {
    if (!currentScan.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    // Check if already scanned
    if (packages.find(p => p.tracking_number === currentScan)) {
      toast.error("Package already scanned!");
      setCurrentScan("");
      return;
    }

    // Add to list
    const newPackage = {
      tracking_number: currentScan,
      customer_name: '',
      delivery_address: '',
      carrier_name: '',
      carrier_email: '',
      package_weight: 0,
      scanned_at: new Date().toISOString(),
    };

    setPackages([...packages, newPackage]);
    setCurrentScan("");
    toast.success(`Package ${currentScan} added to batch`);
    
    // Auto-focus input for next scan
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const removePackage = (tracking) => {
    setPackages(packages.filter(p => p.tracking_number !== tracking));
    toast.info("Package removed from batch");
  };

  const updatePackage = (tracking, field, value) => {
    setPackages(packages.map(p => 
      p.tracking_number === tracking 
        ? { ...p, [field]: value }
        : p
    ));
  };

  const handleBulkAdd = () => {
    if (packages.length === 0) {
      toast.error("No packages to add");
      return;
    }

    bulkAddMutation.mutate(packages);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      const newPackages = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          tracking_number: parts[0] || '',
          customer_name: parts[1] || '',
          delivery_address: parts[2] || '',
          carrier_name: parts[3] || '',
          carrier_email: parts[4] || '',
          package_weight: parseFloat(parts[5]) || 0,
          scanned_at: new Date().toISOString(),
        };
      }).filter(p => p.tracking_number);

      setPackages([...packages, ...newPackages]);
      toast.success(`${newPackages.length} packages loaded from file`);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = "tracking_number,customer_name,delivery_address,carrier_name,carrier_email,package_weight\n" +
                "9400123456789000001,John Doe,123 Main St,Driver Name,driver@company.com,5.5\n" +
                "9400123456789000002,Jane Smith,456 Oak Ave,Driver Name,driver@company.com,3.2";
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'package-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Batch Package Entry
          </h1>
          <p className="text-gray-600">Scan or import multiple packages at once</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Scanned</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{packages.length}</p>
                </div>
                <Package className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Ready to Add</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">
                    {packages.filter(p => p.customer_name).length}
                  </p>
                </div>
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Needs Info</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">
                    {packages.filter(p => !p.customer_name).length}
                  </p>
                </div>
                <XCircle className="w-12 h-12 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scanning Section */}
        <Card className="border-2 border-blue-300 mb-8">
          <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
            <CardTitle className="text-blue-900">Quick Scan Entry</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {!showCamera ? (
                <>
                  {/* Manual Entry */}
                  <div className="flex gap-3">
                    <Input
                      ref={inputRef}
                      value={currentScan}
                      onChange={(e) => setCurrentScan(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Scan or type tracking number..."
                      className="flex-1 h-14 text-lg"
                      autoFocus
                    />
                    <Button
                      onClick={handleScan}
                      disabled={!currentScan}
                      className="bg-blue-600 hover:bg-blue-700 h-14 px-8"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Add
                    </Button>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      onClick={startCamera}
                      variant="outline"
                      className="border-2 border-blue-300"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Use Camera
                    </Button>
                    
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-2 border-green-300"
                        onClick={() => document.getElementById('file-upload').click()}
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        Import CSV
                      </Button>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <Button
                      onClick={downloadTemplate}
                      variant="outline"
                      className="border-2 border-purple-300"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download Template
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
            </div>
          </CardContent>
        </Card>

        {/* Package List */}
        {packages.length > 0 && (
          <Card className="border-2 border-gray-200 mb-8">
            <CardHeader className="bg-gray-50 border-b-2 border-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-900">
                  Scanned Packages ({packages.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPackages([])}
                    variant="outline"
                    className="border-red-300 text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                  <Button
                    onClick={handleBulkAdd}
                    disabled={bulkAddMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {bulkAddMutation.isPending ? 'Adding...' : `Add ${packages.length} Packages`}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {packages.map((pkg, index) => (
                  <Card key={pkg.tracking_number} className="border-2 border-blue-100">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          {/* Tracking Number */}
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Tracking Number</p>
                            <p className="font-mono font-bold text-gray-900">{pkg.tracking_number}</p>
                          </div>

                          {/* Editable Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              value={pkg.customer_name}
                              onChange={(e) => updatePackage(pkg.tracking_number, 'customer_name', e.target.value)}
                              placeholder="Customer Name"
                              className="text-sm"
                            />
                            <Input
                              value={pkg.delivery_address}
                              onChange={(e) => updatePackage(pkg.tracking_number, 'delivery_address', e.target.value)}
                              placeholder="Delivery Address"
                              className="text-sm"
                            />
                            <Input
                              value={pkg.carrier_name}
                              onChange={(e) => updatePackage(pkg.tracking_number, 'carrier_name', e.target.value)}
                              placeholder="Carrier Name"
                              className="text-sm"
                            />
                            <Input
                              value={pkg.carrier_email}
                              onChange={(e) => updatePackage(pkg.tracking_number, 'carrier_email', e.target.value)}
                              placeholder="Carrier Email"
                              type="email"
                              className="text-sm"
                            />
                            <Input
                              value={pkg.package_weight}
                              onChange={(e) => updatePackage(pkg.tracking_number, 'package_weight', e.target.value)}
                              placeholder="Weight (lbs)"
                              type="number"
                              step="0.1"
                              className="text-sm"
                            />
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center justify-between">
                            {pkg.customer_name ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Ready
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                Needs Info
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={() => removePackage(pkg.tracking_number)}
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {packages.length === 0 && (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-12 text-center">
              <Scan className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 text-lg mb-2">No packages scanned yet</p>
              <p className="text-sm text-gray-500">
                Start scanning tracking numbers or import a CSV file to begin
              </p>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="border-2 border-purple-200 bg-purple-50 mt-8">
          <CardContent className="p-6">
            <h3 className="font-bold text-purple-900 mb-3">💡 Quick Tips</h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li>• Use a barcode scanner for fastest entry - just scan and press Enter</li>
              <li>• Import CSV files with bulk package data (download template above)</li>
              <li>• Fill in customer details later if needed - packages will be saved</li>
              <li>• Camera scanning works for QR codes and barcodes</li>
              <li>• All packages are added to the system with "At Facility" status</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}