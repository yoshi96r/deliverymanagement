
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Shield, Crown, Gem } from "lucide-react";

const insuranceTiers = [
  {
    tier: "basic",
    name: "Basic Care",
    icon: Shield,
    color: "blue",
    price: 1.99,
    carrierPay: "$0.25",
    features: [
      "3 verification checkpoints",
      "Photo documentation",
      "Basic damage tracking",
      "Standard handling",
      "Up to $100 coverage"
    ]
  },
  {
    tier: "premium",
    name: "Premium Care",
    icon: Crown,
    color: "purple",
    price: 4.99,
    carrierPay: "$0.75",
    popular: true,
    features: [
      "5 verification checkpoints",
      "Photo + video documentation",
      "Detailed damage tracking",
      "Separate handling from regular mail",
      "Priority notifications",
      "Up to $500 coverage"
    ]
  },
  {
    tier: "platinum",
    name: "Platinum Care",
    icon: Gem,
    color: "yellow",
    price: 9.99,
    carrierPay: "$1.50",
    features: [
      "6+ verification checkpoints",
      "Full photo & video at every stage",
      "Real-time damage alerts",
      "Isolated handling - never mixed",
      "Instant notifications",
      "Premium carrier assignment",
      "Up to $2,000 coverage"
    ]
  }
];

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-600",
    icon: "text-blue-600"
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-900",
    badge: "bg-purple-600",
    icon: "text-purple-600"
  },
  yellow: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    badge: "bg-yellow-600",
    icon: "text-yellow-600"
  }
};

export default function InsurancePricingCard({ onSelect, selectedTier }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Package Insurance & Verification</h2>
        <p className="text-blue-600">
          Choose protection level - carriers earn extra for handling premium packages
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insuranceTiers.map((insurance) => {
          const Icon = insurance.icon;
          const colors = colorClasses[insurance.color];
          const isSelected = selectedTier === insurance.tier;

          return (
            <Card 
              key={insurance.tier}
              className={`relative cursor-pointer transition-all hover:shadow-xl border-2 ${
                isSelected 
                  ? `${colors.border} shadow-lg scale-105` 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelect(insurance.tier, insurance.price)}
            >
              {insurance.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 px-4 py-1">
                    ⭐ Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className={`${colors.bg} border-b-2 ${colors.border} pt-8`}>
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 ${colors.bg} rounded-2xl flex items-center justify-center border-2 ${colors.border}`}>
                    <Icon className={`w-8 h-8 ${colors.icon}`} />
                  </div>
                  <CardTitle className={colors.text}>{insurance.name}</CardTitle>
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${colors.text}`}>
                      ${insurance.price}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">per package</p>
                  </div>
                  <Badge variant="outline" className={`${colors.border} ${colors.text}`}>
                    Carriers earn {insurance.carrierPay} more
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <ul className="space-y-3">
                  {insurance.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isSelected && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                    <p className="text-sm font-semibold text-green-900 text-center">
                      ✓ Selected
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-bold text-blue-900 mb-3">💡 Why Choose Premium Insurance?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-semibold mb-1">💰 Support Your Carrier</p>
              <p>Premium packages pay carriers extra - they earn {insuranceTiers[1].carrierPay} to {insuranceTiers[2].carrierPay} more per checkpoint</p>
            </div>
            <div>
              <p className="font-semibold mb-1">📸 Complete Documentation</p>
              <p>Photo proof at every stage protects everyone from disputes</p>
            </div>
            <div>
              <p className="font-semibold mb-1">🔍 Damage Accountability</p>
              <p>Know exactly where damage occurred - clear liability</p>
            </div>
            <div>
              <p className="font-semibold mb-1">⚡ Better Service</p>
              <p>Separate handling means your package gets VIP treatment</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
