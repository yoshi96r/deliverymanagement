
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Building2, CreditCard, CheckCircle2, ArrowRight,
  Shield, Package, TrendingUp, Zap, Star
} from "lucide-react";
import { toast } from "sonner";

export default function BusinessRegistration() {
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState("professional");
  
  const [formData, setFormData] = useState({
    business_name: "",
    dba_name: "",
    business_type: "llc",
    tax_id: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    business_address: "",
    city: "",
    state: "",
    zip: "",
    website: "",
    industry: "ecommerce",
    estimated_monthly_volume: "",
    payment_method: "credit_card",
    credit_card_number: "",
    credit_card_exp: "",
    credit_card_cvv: "",
    bank_routing: "",
    bank_account: "",
  });

  const pricingTiers = [
    {
      tier: "starter",
      name: "Starter",
      price: 0,
      monthlyFee: 0,
      features: [
        "Up to 100 shipments/month",
        "Basic tracking",
        "Email support",
        "Basic insurance ($1.99-$9.99)",
        "Carrier earns $0.25-$1.50 per delivery"
      ],
      perShipmentRate: "$2.99",
      color: "blue"
    },
    {
      tier: "professional",
      name: "Professional",
      price: 29,
      monthlyFee: 29,
      popular: true,
      features: [
        "Up to 1,000 shipments/month",
        "Advanced tracking & analytics",
        "Priority support",
        "Volume discounts",
        "Custom branding",
        "API access",
        "Batch operations",
        "10% shipping discount"
      ],
      perShipmentRate: "$2.69",
      color: "purple"
    },
    {
      tier: "enterprise",
      name: "Enterprise",
      price: 99,
      monthlyFee: 99,
      features: [
        "Unlimited shipments",
        "Real-time GPS tracking",
        "24/7 dedicated support",
        "Custom integrations",
        "Advanced API & webhooks",
        "Dedicated account manager",
        "20% shipping discount",
        "Custom workflows",
        "White-label option"
      ],
      perShipmentRate: "$2.39",
      color: "orange"
    }
  ];

  const registerBusinessMutation = useMutation({
    mutationFn: async (data) => {
      const selectedPlan = pricingTiers.find(t => t.tier === selectedTier);
      
      const businessAccount = await base44.entities.BusinessAccount.create({
        business_name: data.business_name,
        dba_name: data.dba_name,
        business_type: data.business_type,
        tax_id: data.tax_id,
        owner_name: data.owner_name,
        owner_email: data.owner_email,
        owner_phone: data.owner_phone,
        business_address: data.business_address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        website: data.website,
        industry: data.industry,
        estimated_monthly_volume: parseInt(data.estimated_monthly_volume),
        account_tier: selectedTier,
        monthly_fee: selectedPlan.monthlyFee,
        payment_method: data.payment_method,
        credit_card_last4: data.payment_method === 'credit_card' ? data.credit_card_number.slice(-4) : null,
        bank_account_last4: data.payment_method === 'ach_bank_account' ? data.bank_account.slice(-4) : null,
        registration_status: "payment_setup_required",
        registered_at: new Date().toISOString()
      });

      // Would normally integrate with payment processor here
      // For demo, we'll mark as active
      await base44.entities.BusinessAccount.update(businessAccount.id, {
        registration_status: "active",
        payment_status: "active"
      });

      // Send welcome email
      await base44.integrations.Core.SendEmail({
        to: data.owner_email,
        subject: "Welcome to CarrierConnect Business!",
        body: `Hello ${data.owner_name},

Welcome to CarrierConnect! Your ${selectedPlan.name} account is now active.

Account Details:
- Business: ${data.business_name}
- Monthly Fee: $${selectedPlan.monthlyFee}
- Per-Shipment Rate: ${selectedPlan.perShipmentRate}

CarrierConnect helps you ship packages with confidence:
✓ Direct communication with rural carriers
✓ Photo/video proof of every delivery
✓ Support local carriers (they earn extra for premium service)
✓ Real-time package tracking
✓ Insurance claims processed in 24-48 hours

Login to get started: ${window.location.origin}

Questions? Contact support@carrierconnect.com

Thank you for choosing CarrierConnect!

P.S. Every premium delivery helps rural carriers earn more income.`
      });

      return businessAccount;
    },
    onSuccess: () => {
      setStep(4);
      toast.success("Business account created successfully!");
    },
    onError: (error) => {
      toast.error("Registration failed. Please try again.");
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (step === 1) {
      if (!formData.business_name || !formData.owner_name || !formData.owner_email) {
        toast.error("Please fill in all required fields");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      registerBusinessMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <Building2 className="w-12 h-12 text-purple-600" />
            Business Registration
          </h1>
          <p className="text-lg text-gray-600">Start shipping smarter with DeliveryPro</p>
        </div>

        {/* Progress Steps */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`w-12 h-1 ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Business Information */}
        {step === 1 && (
          <Card className="border-2 border-purple-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600">
              <CardTitle className="text-white text-2xl">Step 1: Business Information</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Legal Business Name *</Label>
                    <Input
                      value={formData.business_name}
                      onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                      placeholder="ABC Corporation"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>DBA Name (if different)</Label>
                    <Input
                      value={formData.dba_name}
                      onChange={(e) => setFormData({...formData, dba_name: e.target.value})}
                      placeholder="Doing Business As"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Business Type *</Label>
                    <Select
                      value={formData.business_type}
                      onValueChange={(v) => setFormData({...formData, business_type: v})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                        <SelectItem value="llc">LLC</SelectItem>
                        <SelectItem value="corporation">Corporation</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                        <SelectItem value="nonprofit">Nonprofit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tax ID / EIN *</Label>
                    <Input
                      value={formData.tax_id}
                      onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                      placeholder="12-3456789"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Owner Name *</Label>
                    <Input
                      value={formData.owner_name}
                      onChange={(e) => setFormData({...formData, owner_name: e.target.value})}
                      placeholder="John Doe"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>Owner Email *</Label>
                    <Input
                      type="email"
                      value={formData.owner_email}
                      onChange={(e) => setFormData({...formData, owner_email: e.target.value})}
                      placeholder="owner@business.com"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input
                      type="tel"
                      value={formData.owner_phone}
                      onChange={(e) => setFormData({...formData, owner_phone: e.target.value})}
                      placeholder="(555) 123-4567"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Business Address *</Label>
                  <Input
                    value={formData.business_address}
                    onChange={(e) => setFormData({...formData, business_address: e.target.value})}
                    placeholder="123 Business St"
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>City *</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder="City"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Input
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      placeholder="CA"
                      className="mt-1"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div>
                    <Label>ZIP Code *</Label>
                    <Input
                      value={formData.zip}
                      onChange={(e) => setFormData({...formData, zip: e.target.value})}
                      placeholder="12345"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Industry *</Label>
                    <Select
                      value={formData.industry}
                      onValueChange={(v) => setFormData({...formData, industry: v})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                        <SelectItem value="automotive">Automotive</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estimated Monthly Shipments *</Label>
                    <Input
                      type="number"
                      value={formData.estimated_monthly_volume}
                      onChange={(e) => setFormData({...formData, estimated_monthly_volume: e.target.value})}
                      placeholder="500"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Website (optional)</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    placeholder="https://yoursite.com"
                    className="mt-1"
                  />
                </div>

                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 h-14 text-lg font-semibold">
                  Continue to Plan Selection
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose Plan */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Plan</h2>
              <p className="text-gray-600">Select the plan that fits your shipping volume</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {pricingTiers.map((plan) => (
                <Card
                  key={plan.tier}
                  className={`cursor-pointer transition-all border-2 ${
                    selectedTier === plan.tier
                      ? 'border-purple-400 shadow-2xl scale-105'
                      : 'border-gray-200 hover:border-purple-300'
                  } ${plan.popular ? 'relative' : ''}`}
                  onClick={() => setSelectedTier(plan.tier)}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1">
                        ⭐ Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className={`bg-gradient-to-r from-${plan.color}-500 to-${plan.color}-600 text-white pt-8`}>
                    <CardTitle className="text-center">
                      <p className="text-2xl font-bold mb-2">{plan.name}</p>
                      <div className="text-4xl font-bold">${plan.price}</div>
                      <p className="text-sm text-white/80 mt-1">per month</p>
                      <p className="text-sm text-white/90 mt-3 font-semibold">
                        {plan.perShipmentRate} per shipment
                      </p>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {selectedTier === plan.tier && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                        <p className="text-sm font-semibold text-green-900 text-center">
                          ✓ Selected Plan
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-14"
              >
                ← Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 h-14 text-lg font-semibold"
              >
                Continue to Payment
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment Setup */}
        {step === 3 && (
          <Card className="border-2 border-purple-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600">
              <CardTitle className="text-white text-2xl">Step 3: Payment Setup</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="mb-6 p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-purple-900 text-lg">
                      {pricingTiers.find(t => t.tier === selectedTier)?.name} Plan
                    </p>
                    <p className="text-purple-700">
                      ${pricingTiers.find(t => t.tier === selectedTier)?.monthlyFee}/month + per-shipment fees
                    </p>
                  </div>
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    size="sm"
                  >
                    Change Plan
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label>Payment Method *</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(v) => setFormData({...formData, payment_method: v})}
                  >
                    <SelectTrigger className="mt-1 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">💳 Credit Card</SelectItem>
                      <SelectItem value="ach_bank_account">🏦 Bank Account (ACH)</SelectItem>
                      <SelectItem value="invoice_net30">📄 Invoice Net 30 (Requires Approval)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_method === 'credit_card' && (
                  <div className="space-y-4 p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <div>
                      <Label>Card Number *</Label>
                      <Input
                        value={formData.credit_card_number}
                        onChange={(e) => setFormData({...formData, credit_card_number: e.target.value})}
                        placeholder="4111 1111 1111 1111"
                        maxLength={19}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Expiration *</Label>
                        <Input
                          value={formData.credit_card_exp}
                          onChange={(e) => setFormData({...formData, credit_card_exp: e.target.value})}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label>CVV *</Label>
                        <Input
                          value={formData.credit_card_cvv}
                          onChange={(e) => setFormData({...formData, credit_card_cvv: e.target.value})}
                          placeholder="123"
                          maxLength={4}
                          className="mt-1"
                          type="password"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.payment_method === 'ach_bank_account' && (
                  <div className="space-y-4 p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <div>
                      <Label>Routing Number *</Label>
                      <Input
                        value={formData.bank_routing}
                        onChange={(e) => setFormData({...formData, bank_routing: e.target.value})}
                        placeholder="123456789"
                        maxLength={9}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label>Account Number *</Label>
                      <Input
                        value={formData.bank_account}
                        onChange={(e) => setFormData({...formData, bank_account: e.target.value})}
                        placeholder="1234567890"
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                )}

                {formData.payment_method === 'invoice_net30' && (
                  <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                    <p className="font-semibold text-yellow-900 mb-2">⚠️ Net 30 Invoicing Requires Approval</p>
                    <p className="text-sm text-yellow-800">
                      Your account will be reviewed by our team. This typically takes 1-2 business days.
                      You'll receive an email once approved and can start shipping immediately.
                    </p>
                  </div>
                )}

                <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-blue-900 mb-2">🔒 Secure Payment Processing</p>
                      <p className="text-sm text-blue-800">
                        Your payment information is encrypted and secure. We use industry-standard 
                        security measures to protect your data. We never store full card numbers.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="flex-1 h-14"
                  >
                    ← Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerBusinessMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 h-14 text-lg font-semibold"
                  >
                    <CheckCircle2 className="w-6 h-6 mr-2" />
                    {registerBusinessMutation.isPending ? "Processing..." : "Complete Registration"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <Card className="border-2 border-green-300 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600">
              <CardTitle className="text-white text-center py-6">
                <CheckCircle2 className="w-20 h-20 mx-auto mb-4" />
                <p className="text-3xl">Welcome to DeliveryPro!</p>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <p className="text-xl text-gray-700 mb-4">
                  Your {pricingTiers.find(t => t.tier === selectedTier)?.name} account is ready!
                </p>
                <div className="p-6 bg-green-50 rounded-lg border-2 border-green-200 inline-block">
                  <p className="text-gray-600 mb-2">Business Name:</p>
                  <p className="text-2xl font-bold text-green-900">{formData.business_name}</p>
                </div>
              </div>

              <Card className="border-2 border-blue-200 mb-6">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">🚀 What's Next:</h3>
                  <ol className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-purple-600">1.</span>
                      <span>Check your email ({formData.owner_email}) for welcome message</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-purple-600">2.</span>
                      <span>Login with your email to access your dashboard</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-purple-600">3.</span>
                      <span>Create your first shipping label</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-purple-600">4.</span>
                      <span>Track all your deliveries in real-time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-purple-600">5.</span>
                      <span>Access analytics and reports</span>
                    </li>
                  </ol>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="border-2 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <Package className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                    <p className="font-bold text-gray-900">Create Labels</p>
                    <p className="text-sm text-gray-600">Start shipping today</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <p className="font-bold text-gray-900">View Analytics</p>
                    <p className="text-sm text-gray-600">Track performance</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-green-200">
                  <CardContent className="p-4 text-center">
                    <Star className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="font-bold text-gray-900">24/7 Support</p>
                    <p className="text-sm text-gray-600">We're here to help</p>
                  </CardContent>
                </Card>
              </div>

              <Button
                onClick={() => base44.auth.redirectToLogin()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-14 text-lg font-semibold"
              >
                <ArrowRight className="w-6 h-6 mr-2" />
                Login to Your Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
