import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Package, Truck, Zap, Shield, Clock, Download,
  CreditCard, CheckCircle2, ArrowRight, Info
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CreateShippingLabel() {
  const [step, setStep] = useState(1);
  const [fromData, setFromData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: ""
  });
  const [toData, setToData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: ""
  });
  const [packageData, setPackageData] = useState({
    weight: "",
    length: "",
    width: "",
    height: ""
  });
  const [selectedService, setSelectedService] = useState(null);
  const [insuranceAmount, setInsuranceAmount] = useState(0);
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [adultSignature, setAdultSignature] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [availableRates, setAvailableRates] = useState([]);

  const queryClient = useQueryClient();

  const { data: myLabels } = useQuery({
    queryKey: ['myShippingLabels', userEmail],
    queryFn: () => base44.entities.ShippingLabel.filter({ purchased_by_email: userEmail }),
    initialData: [],
    enabled: !!userEmail
  });

  const serviceOptions = [
    {
      type: "priority_mail_express",
      name: "Priority Mail Express",
      speed: "1-2 Business Days",
      icon: Zap,
      color: "red",
      basePrice: 28.75,
      description: "Fastest domestic service"
    },
    {
      type: "priority_mail",
      name: "Priority Mail",
      speed: "2-3 Business Days",
      icon: Truck,
      color: "blue",
      basePrice: 9.65,
      description: "Fast & affordable"
    },
    {
      type: "ground_advantage",
      name: "USPS Ground Advantage",
      speed: "2-5 Business Days",
      icon: Package,
      color: "green",
      basePrice: 7.50,
      description: "Economical ground shipping"
    },
    {
      type: "first_class",
      name: "First-Class Package",
      speed: "3-5 Business Days",
      icon: Package,
      color: "purple",
      basePrice: 5.20,
      description: "Lightweight packages",
      maxWeight: 15.999
    }
  ];

  const calculateShipping = () => {
    setCalculating(true);
    
    // Simple calculation based on weight and service
    const weight = parseFloat(packageData.weight) || 1;
    const length = parseFloat(packageData.length) || 1;
    const width = parseFloat(packageData.width) || 1;
    const height = parseFloat(packageData.height) || 1;
    
    // Calculate dimensional weight
    const dimWeight = (length * width * height) / 166;
    const billableWeight = Math.max(weight, dimWeight);
    
    const rates = serviceOptions.map(service => {
      if (service.maxWeight && weight > service.maxWeight) {
        return null;
      }
      
      let cost = service.basePrice;
      if (billableWeight > 1) {
        cost += (billableWeight - 1) * 0.85; // $0.85 per additional pound
      }
      
      return {
        ...service,
        cost: parseFloat(cost.toFixed(2)),
        billableWeight: billableWeight.toFixed(2)
      };
    }).filter(Boolean);
    
    setAvailableRates(rates);
    setCalculating(false);
    setStep(2);
  };

  const calculateTotalCost = () => {
    if (!selectedService) return 0;
    
    let total = selectedService.cost;
    
    // Insurance cost: $2.95 per $100
    if (insuranceAmount > 0) {
      total += Math.ceil(insuranceAmount / 100) * 2.95;
    }
    
    // Signature fees
    if (adultSignature) {
      total += 6.95;
    } else if (signatureRequired) {
      total += 3.25;
    }
    
    return parseFloat(total.toFixed(2));
  };

  const createLabelMutation = useMutation({
    mutationFn: async (labelData) => {
      // Generate tracking number
      const trackingNumber = `9400${Date.now()}${Math.floor(Math.random() * 10000)}`;
      
      // Create label record
      const label = await base44.entities.ShippingLabel.create({
        label_id: `LBL-${Date.now()}`,
        tracking_number: trackingNumber,
        purchased_by_email: userEmail,
        purchased_by_name: labelData.purchased_by_name,
        from_name: fromData.name,
        from_address: fromData.address,
        from_city: fromData.city,
        from_state: fromData.state,
        from_zip: fromData.zip,
        to_name: toData.name,
        to_address: toData.address,
        to_city: toData.city,
        to_state: toData.state,
        to_zip: toData.zip,
        package_weight: parseFloat(packageData.weight),
        package_length: parseFloat(packageData.length),
        package_width: parseFloat(packageData.width),
        package_height: parseFloat(packageData.height),
        service_type: selectedService.type,
        delivery_speed: selectedService.speed,
        insurance_coverage: insuranceAmount,
        signature_required: signatureRequired,
        adult_signature_required: adultSignature,
        shipping_cost: selectedService.cost,
        insurance_cost: insuranceAmount > 0 ? Math.ceil(insuranceAmount / 100) * 2.95 : 0,
        signature_cost: adultSignature ? 6.95 : signatureRequired ? 3.25 : 0,
        total_cost: labelData.total_cost,
        payment_status: "paid",
        payment_method: "credit_card",
        label_format: "pdf_4x6",
        created_at: new Date().toISOString(),
        purchased_at: new Date().toISOString(),
        estimated_delivery_date: new Date(Date.now() + parseInt(selectedService.speed.split('-')[1]) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        barcode_data: trackingNumber,
        delivery_status: "label_created"
      });

      // Also create a delivery request for tracking
      await base44.entities.DeliveryRequest.create({
        tracking_number: trackingNumber,
        customer_name: toData.name,
        customer_email: userEmail,
        delivery_address: `${toData.address}, ${toData.city}, ${toData.state} ${toData.zip}`,
        carrier_name: "USPS",
        status: "pending",
        package_weight: parseFloat(packageData.weight),
        package_value: insuranceAmount,
        has_premium_insurance: insuranceAmount > 0,
        sender_business_name: fromData.name
      });

      return label;
    },
    onSuccess: (label) => {
      queryClient.invalidateQueries({ queryKey: ['myShippingLabels'] });
      toast.success(`Label created! Tracking: ${label.tracking_number}`);
      setStep(4);
    },
  });

  const handlePurchase = () => {
    if (!userEmail) {
      toast.error("Please enter your email address");
      return;
    }

    const totalCost = calculateTotalCost();
    
    createLabelMutation.mutate({
      total_cost: totalCost,
      purchased_by_name: fromData.name
    });
  };

  const resetForm = () => {
    setStep(1);
    setFromData({ name: "", address: "", city: "", state: "", zip: "" });
    setToData({ name: "", address: "", city: "", state: "", zip: "" });
    setPackageData({ weight: "", length: "", width: "", height: "" });
    setSelectedService(null);
    setInsuranceAmount(0);
    setSignatureRequired(false);
    setAdultSignature(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3">
            Create Shipping Label
          </h1>
          <p className="text-lg text-gray-600">Fast, easy, and affordable USPS shipping</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            {[
              { num: 1, label: "Addresses" },
              { num: 2, label: "Service" },
              { num: 3, label: "Payment" },
              { num: 4, label: "Download" }
            ].map((s) => (
              <div key={s.num} className="flex items-center">
                <div className={`flex items-center gap-2 ${step >= s.num ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base ${
                    step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}>
                    {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                  </div>
                  <span className="font-semibold hidden md:block">{s.label}</span>
                </div>
                {s.num < 4 && <ArrowRight className="w-5 h-5 text-gray-300 mx-2 md:mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Address Information */}
        {step === 1 && (
          <Card className="border-2 border-blue-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600">
              <CardTitle className="text-white text-2xl">Step 1: Enter Addresses</CardTitle>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* From */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-600" />
                    From (Your Address)
                  </h3>
                  <div>
                    <Label>Your Name *</Label>
                    <Input
                      value={fromData.name}
                      onChange={(e) => setFromData({...fromData, name: e.target.value})}
                      placeholder="John Smith"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Street Address *</Label>
                    <Input
                      value={fromData.address}
                      onChange={(e) => setFromData({...fromData, address: e.target.value})}
                      placeholder="123 Main Street"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>City *</Label>
                      <Input
                        value={fromData.city}
                        onChange={(e) => setFromData({...fromData, city: e.target.value})}
                        placeholder="Sacramento"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>State *</Label>
                      <Input
                        value={fromData.state}
                        onChange={(e) => setFromData({...fromData, state: e.target.value})}
                        placeholder="CA"
                        maxLength={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>ZIP Code *</Label>
                    <Input
                      value={fromData.zip}
                      onChange={(e) => setFromData({...fromData, zip: e.target.value})}
                      placeholder="95814"
                      maxLength={5}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* To */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Truck className="w-6 h-6 text-purple-600" />
                    To (Recipient Address)
                  </h3>
                  <div>
                    <Label>Recipient Name *</Label>
                    <Input
                      value={toData.name}
                      onChange={(e) => setToData({...toData, name: e.target.value})}
                      placeholder="Jane Doe"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Street Address *</Label>
                    <Input
                      value={toData.address}
                      onChange={(e) => setToData({...toData, address: e.target.value})}
                      placeholder="456 Oak Avenue"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>City *</Label>
                      <Input
                        value={toData.city}
                        onChange={(e) => setToData({...toData, city: e.target.value})}
                        placeholder="New York"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>State *</Label>
                      <Input
                        value={toData.state}
                        onChange={(e) => setToData({...toData, state: e.target.value})}
                        placeholder="NY"
                        maxLength={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>ZIP Code *</Label>
                    <Input
                      value={toData.zip}
                      onChange={(e) => setToData({...toData, zip: e.target.value})}
                      placeholder="10001"
                      maxLength={5}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Package Details */}
              <div className="mt-8 pt-8 border-t-2 border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-6 h-6 text-green-600" />
                  Package Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Weight (lbs) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={packageData.weight}
                      onChange={(e) => setPackageData({...packageData, weight: e.target.value})}
                      placeholder="5.5"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Length (in)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={packageData.length}
                      onChange={(e) => setPackageData({...packageData, length: e.target.value})}
                      placeholder="12"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Width (in)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={packageData.width}
                      onChange={(e) => setPackageData({...packageData, width: e.target.value})}
                      placeholder="8"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Height (in)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={packageData.height}
                      onChange={(e) => setPackageData({...packageData, height: e.target.value})}
                      placeholder="6"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Label>Your Email (for label delivery) *</Label>
                <Input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={calculateShipping}
                disabled={!fromData.name || !fromData.zip || !toData.name || !toData.zip || !packageData.weight || !userEmail || calculating}
                className="w-full mt-8 bg-blue-600 hover:bg-blue-700 h-14 text-lg font-semibold"
              >
                {calculating ? "Calculating..." : "Calculate Shipping Rates →"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Service */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="border-2 border-purple-300 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600">
                <CardTitle className="text-white text-2xl">Step 2: Choose Shipping Service</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableRates.map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedService?.type === service.type;
                    
                    return (
                      <Card
                        key={service.type}
                        className={`cursor-pointer transition-all border-2 ${
                          isSelected 
                            ? `border-${service.color}-500 bg-${service.color}-50 shadow-lg scale-105` 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                        onClick={() => setSelectedService(service)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full bg-${service.color}-100 flex items-center justify-center`}>
                                <Icon className={`w-6 h-6 text-${service.color}-600`} />
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900">{service.name}</h4>
                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {service.speed}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-900">${service.cost}</p>
                              <p className="text-xs text-gray-500">{service.billableWeight} lbs</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600">{service.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {selectedService && (
                  <div className="mt-6 space-y-4">
                    <Card className="border-2 border-green-200 bg-green-50">
                      <CardContent className="p-6">
                        <h4 className="font-bold text-green-900 mb-4">Optional Add-ons</h4>
                        
                        <div className="space-y-4">
                          <div>
                            <Label>Insurance Coverage (package value)</Label>
                            <div className="flex gap-3 mt-2">
                              <Input
                                type="number"
                                value={insuranceAmount}
                                onChange={(e) => setInsuranceAmount(parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="flex-1"
                              />
                              <Badge className="bg-green-600 h-10 flex items-center px-4">
                                +${insuranceAmount > 0 ? (Math.ceil(insuranceAmount / 100) * 2.95).toFixed(2) : '0.00'}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">$2.95 per $100 of coverage</p>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-white rounded border">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={signatureRequired}
                                onCheckedChange={setSignatureRequired}
                                disabled={adultSignature}
                              />
                              <div>
                                <Label className="font-semibold">Signature Confirmation</Label>
                                <p className="text-xs text-gray-600">Requires recipient signature</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-600">+$3.25</Badge>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-white rounded border">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={adultSignature}
                                onCheckedChange={(checked) => {
                                  setAdultSignature(checked);
                                  if (checked) setSignatureRequired(false);
                                }}
                              />
                              <div>
                                <Label className="font-semibold">Adult Signature (21+)</Label>
                                <p className="text-xs text-gray-600">Requires adult signature with ID</p>
                              </div>
                            </div>
                            <Badge className="bg-purple-600">+$6.95</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Button
                      onClick={() => setStep(3)}
                      className="w-full bg-purple-600 hover:bg-purple-700 h-14 text-lg font-semibold"
                    >
                      Continue to Payment →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={() => setStep(1)}
              variant="outline"
              className="w-full border-2 border-gray-300"
            >
              ← Back to Addresses
            </Button>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && selectedService && (
          <div className="space-y-6">
            <Card className="border-2 border-green-300 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600">
                <CardTitle className="text-white text-2xl">Step 3: Review & Purchase</CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-gray-900 mb-4 text-lg">Order Summary</h4>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-gray-700">
                      <span>{selectedService.name}</span>
                      <span className="font-semibold">${selectedService.cost.toFixed(2)}</span>
                    </div>
                    {insuranceAmount > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Insurance (${insuranceAmount})</span>
                        <span className="font-semibold">
                          +${(Math.ceil(insuranceAmount / 100) * 2.95).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {adultSignature && (
                      <div className="flex justify-between text-gray-700">
                        <span>Adult Signature</span>
                        <span className="font-semibold">+$6.95</span>
                      </div>
                    )}
                    {signatureRequired && !adultSignature && (
                      <div className="flex justify-between text-gray-700">
                        <span>Signature Confirmation</span>
                        <span className="font-semibold">+$3.25</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t-2 border-gray-300 flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-900">Total</span>
                    <span className="text-3xl font-bold text-green-600">
                      ${calculateTotalCost().toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="text-sm text-blue-700">From</p>
                    <p className="font-semibold text-blue-900">{fromData.name}</p>
                    <p className="text-sm text-blue-800">{fromData.city}, {fromData.state} {fromData.zip}</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-700">To</p>
                    <p className="font-semibold text-purple-900">{toData.name}</p>
                    <p className="text-sm text-purple-800">{toData.city}, {toData.state} {toData.zip}</p>
                  </div>
                </div>

                {/* Mock Payment */}
                <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg text-white mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CreditCard className="w-8 h-8" />
                    <h4 className="font-bold text-xl">Payment Method</h4>
                  </div>
                  <p className="text-gray-300 text-sm">
                    💳 Demo Mode: Label will be created without actual payment
                  </p>
                </div>

                <Button
                  onClick={handlePurchase}
                  disabled={createLabelMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg font-semibold"
                >
                  {createLabelMutation.isPending ? (
                    "Creating Label..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6 mr-2" />
                      Purchase Label - ${calculateTotalCost().toFixed(2)}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Button
              onClick={() => setStep(2)}
              variant="outline"
              className="w-full border-2 border-gray-300"
            >
              ← Back to Service Selection
            </Button>
          </div>
        )}

        {/* Step 4: Download Label */}
        {step === 4 && (
          <Card className="border-2 border-green-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600">
              <CardTitle className="text-white text-2xl text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                Label Created Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <p className="text-gray-600 mb-2">Your tracking number:</p>
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 inline-block">
                  <p className="font-mono text-2xl font-bold text-blue-900">
                    {myLabels[0]?.tracking_number}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Service</p>
                    <p className="font-bold text-gray-900">{selectedService?.name}</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-purple-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Estimated Delivery</p>
                    <p className="font-bold text-gray-900">
                      {myLabels[0]?.estimated_delivery_date && 
                        format(new Date(myLabels[0].estimated_delivery_date), "MMM d, yyyy")}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg">
                  <Download className="w-6 h-6 mr-2" />
                  Download Label (PDF)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-2 border-gray-300 h-12"
                  onClick={() => window.print()}
                >
                  Print Label
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="w-full border-2 border-green-300 text-green-700 h-12"
                >
                  Create Another Label
                </Button>
              </div>

              <div className="mt-8 p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <p className="font-semibold text-yellow-900 mb-2">📬 Next Steps:</p>
                <ol className="text-sm text-yellow-800 text-left space-y-1">
                  <li>1. Print and attach label securely to your package</li>
                  <li>2. Drop off at any USPS location or schedule pickup</li>
                  <li>3. Track your package using the tracking number above</li>
                  <li>4. Label sent to {userEmail}</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Labels */}
        {myLabels.length > 0 && step !== 4 && (
          <Card className="border-2 border-gray-200 mt-8">
            <CardHeader className="bg-gray-50">
              <CardTitle>My Recent Labels</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {myLabels.slice(0, 5).map((label) => (
                  <Card key={label.id} className="border-2 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-bold text-gray-900 mb-1">{label.tracking_number}</p>
                          <p className="text-sm text-gray-600">
                            {label.to_name} • {label.to_city}, {label.to_state}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge>{label.service_type.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline">${label.total_cost}</Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}