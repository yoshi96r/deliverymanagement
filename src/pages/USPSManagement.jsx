import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, MapPin, Truck, DollarSign, Users,
  CheckCircle2, TrendingUp, Calendar, Shield
} from "lucide-react";

export default function USPSManagement() {
  const { data: config } = useQuery({
    queryKey: ['uspsConfig'],
    queryFn: () => base44.entities.USPSConfiguration.list(),
    initialData: [],
  });

  const activeConfig = config[0];
  const isSubscribed = activeConfig?.service_enabled;

  const subscriptionTiers = [
    {
      name: "Basic",
      price: 49,
      features: [
        "Route management for up to 5 carriers",
        "Basic mailbox tracking",
        "Customer delivery preferences",
        "Standard reporting"
      ]
    },
    {
      name: "Professional",
      price: 99,
      features: [
        "Route management for up to 20 carriers",
        "Advanced mailbox configuration",
        "GPS tracking integration",
        "Priority customer support",
        "Advanced analytics",
        "USPS Informed Delivery integration"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: 199,
      features: [
        "Unlimited carriers and routes",
        "Full USPS API integration",
        "Real-time package tracking",
        "Custom reporting and analytics",
        "Dedicated account manager",
        "Address verification",
        "Multi-facility support"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-red-600" />
            USPS Management System
          </h1>
          <p className="text-gray-600">Premium features for USPS rural and city carriers</p>
        </div>

        {/* Current Status */}
        {activeConfig ? (
          <Card className="border-2 border-blue-200 mb-8">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-900">Current Subscription</CardTitle>
                <Badge className={isSubscribed ? "bg-green-600" : "bg-gray-600"}>
                  {isSubscribed ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Plan</p>
                  <p className="text-xl font-bold text-gray-900 capitalize">
                    {activeConfig.subscription_tier}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monthly Cost</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${activeConfig.monthly_cost}/mo
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Carriers</p>
                  <p className="text-xl font-bold text-gray-900">
                    {activeConfig.active_carriers}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Routes</p>
                  <p className="text-xl font-bold text-gray-900">
                    {activeConfig.active_routes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Subscription Tiers */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isSubscribed ? "Upgrade Your Plan" : "Choose Your Plan"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {subscriptionTiers.map((tier) => (
            <Card 
              key={tier.name}
              className={`border-2 ${
                tier.popular ? 'border-blue-500 shadow-xl' : 'border-gray-200'
              }`}
            >
              <CardHeader className={tier.popular ? 'bg-blue-50' : 'bg-gray-50'}>
                <div className="text-center">
                  {tier.popular && (
                    <Badge className="bg-blue-600 mb-2">Most Popular</Badge>
                  )}
                  <CardTitle className="text-2xl text-gray-900">{tier.name}</CardTitle>
                  <p className="text-4xl font-bold text-blue-600 mt-4">
                    ${tier.price}
                    <span className="text-lg text-gray-600">/month</span>
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full mt-6 ${
                    tier.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {isSubscribed ? 'Upgrade' : 'Get Started'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Overview */}
        <Card className="border-2 border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-purple-900">USPS-Specific Features</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Rural Route Management</h4>
                    <p className="text-sm text-gray-600">
                      Optimize routes for rural carriers with detailed mailbox configurations and GPS tracking
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Package Tracking Integration</h4>
                    <p className="text-sm text-gray-600">
                      Seamless integration with USPS tracking systems for real-time package updates
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Customer Communication</h4>
                    <p className="text-sm text-gray-600">
                      Direct communication with customers for signature requirements and delivery preferences
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Informed Delivery Support</h4>
                    <p className="text-sm text-gray-600">
                      Integration with USPS Informed Delivery for customer notifications
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Signature Verification</h4>
                    <p className="text-sm text-gray-600">
                      Digital signature capture with photo proof for certified and registered mail
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Performance Analytics</h4>
                    <p className="text-sm text-gray-600">
                      Detailed analytics on delivery performance, route efficiency, and carrier productivity
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="border-2 border-blue-200 mt-8">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Questions about USPS Integration?
            </h3>
            <p className="text-gray-600 mb-6">
              Our team is ready to help you get started with the perfect plan for your post office
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Package className="w-5 h-5 mr-2" />
                Schedule Demo
              </Button>
              <Button variant="outline" className="border-2 border-blue-300">
                Contact Sales
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}