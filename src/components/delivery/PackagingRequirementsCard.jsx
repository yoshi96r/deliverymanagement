import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, CheckCircle2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const packagingRequirements = {
  basic: {
    requirements: [
      {
        weight: "Up to 10 lbs",
        boxType: "Double-Wall Corrugated Box",
        strength: "200 lb test",
        materials: ["Bubble wrap", "Packing paper"],
        example: "Standard USPS Priority boxes with reinforcement"
      },
      {
        weight: "10-25 lbs",
        boxType: "Double-Wall Heavy Duty Box",
        strength: "275 lb test",
        materials: ["Foam padding", "Air pillows", "Corner protectors"],
        example: "Heavy duty shipping boxes from approved suppliers"
      },
      {
        weight: "25+ lbs",
        boxType: "Triple-Wall Box Required",
        strength: "350 lb test",
        materials: ["Heavy foam", "Pallet wrapping", "Reinforced corners"],
        example: "Industrial grade boxes only"
      }
    ]
  },
  premium: {
    requirements: [
      {
        weight: "Up to 10 lbs",
        boxType: "Double-Wall Premium Box",
        strength: "275 lb test",
        materials: ["Double bubble wrap", "Foam inserts", "Void fill"],
        example: "Certified premium packaging from approved suppliers"
      },
      {
        weight: "10-25 lbs",
        boxType: "Triple-Wall Box",
        strength: "350 lb test",
        materials: ["Premium foam", "Corner & edge protectors", "Anti-static materials"],
        example: "Premium grade boxes with certification sticker"
      },
      {
        weight: "25+ lbs",
        boxType: "Triple-Wall Heavy Duty",
        strength: "500 lb test",
        materials: ["Industrial foam", "Pallet base", "Strapping"],
        example: "Industrial certified boxes with inspection seal"
      }
    ]
  },
  platinum: {
    requirements: [
      {
        weight: "Up to 10 lbs",
        boxType: "Triple-Wall Premium Box",
        strength: "350 lb test",
        materials: ["Premium foam inserts", "Custom fitted void fill", "Shock indicators"],
        example: "Platinum certified boxes with tamper-evident seals"
      },
      {
        weight: "10-25 lbs",
        boxType: "Triple-Wall Reinforced",
        strength: "500 lb test",
        materials: ["Custom foam molding", "Impact sensors", "Climate control materials"],
        example: "Platinum grade with full documentation and seals"
      },
      {
        weight: "25+ lbs",
        boxType: "Crate or Wood Box",
        strength: "1000 lb test",
        materials: ["Custom crating", "Industrial protection", "Pallet mounting"],
        example: "Professional crating service required with certification"
      }
    ]
  }
};

const approvedSuppliers = [
  "Uline Professional Grade",
  "PackagingSupplies.com Premium",
  "The Packaging Company Pro Series",
  "USPS Heavy Duty Line",
  "FedEx Certified Packaging"
];

export default function PackagingRequirementsCard({ selectedTier, packageWeight }) {
  if (!selectedTier || selectedTier === 'none') {
    return null;
  }

  const requirements = packagingRequirements[selectedTier]?.requirements || [];
  const weightCategory = packageWeight <= 10 ? 0 : packageWeight <= 25 ? 1 : 2;
  const requirement = requirements[weightCategory];

  return (
    <div className="space-y-4">
      <Alert className="border-2 border-red-300 bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <AlertDescription className="text-red-900">
          <strong className="font-bold">MANDATORY PACKAGING REQUIREMENTS</strong>
          <p className="mt-1 text-sm">
            To qualify for {selectedTier} tier insurance, you MUST use approved packaging. 
            Improper packaging will result in claim denial and insurance refund.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="border-2 border-orange-300">
        <CardHeader className="bg-orange-50 border-b-2 border-orange-200">
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Package className="w-6 h-6" />
            Required Packaging for Your Package
          </CardTitle>
          <p className="text-sm text-orange-700 mt-1">
            Based on {selectedTier} tier insurance • {packageWeight || 0} lbs
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {requirement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 mb-1">REQUIRED BOX TYPE</p>
                  <p className="text-lg font-bold text-blue-900">{requirement.boxType}</p>
                  <p className="text-xs text-blue-700 mt-1">Min. {requirement.strength}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <p className="text-xs font-semibold text-green-600 mb-1">WEIGHT CATEGORY</p>
                  <p className="text-lg font-bold text-green-900">{requirement.weight}</p>
                  <p className="text-xs text-green-700 mt-1">Appropriate for your package</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Required Packing Materials:
                </p>
                <ul className="space-y-1">
                  {requirement.materials.map((material, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      {material}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">EXAMPLE</p>
                <p className="text-sm text-gray-800">{requirement.example}</p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t-2 border-gray-200">
            <h4 className="text-sm font-bold text-gray-900 mb-3">📦 Approved Box Suppliers</h4>
            <div className="space-y-2">
              {approvedSuppliers.map((supplier, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                  <span className="text-sm text-gray-700">{supplier}</span>
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </div>
              ))}
            </div>
          </div>

          <Alert className="border-2 border-yellow-300 bg-yellow-50">
            <AlertDescription className="text-yellow-900 text-sm">
              <strong className="font-bold">⚠ First Checkpoint Verification:</strong>
              <p className="mt-1">
                At the first checkpoint, the carrier will verify your packaging meets these requirements. 
                If packaging is inadequate, your shipment will be rejected and insurance refunded.
                You'll need to repack with proper materials.
              </p>
            </AlertDescription>
          </Alert>

          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-bold mb-1">Benefits of Proper Packaging:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Full insurance coverage protection</li>
                  <li>Lower damage rates = happier customers</li>
                  <li>Faster claim processing if damage occurs</li>
                  <li>Higher carrier care priority</li>
                  <li>Proof of proper preparation</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Requirements Table */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">
            Complete Packaging Requirements - {selectedTier.toUpperCase()} Tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-3 bg-gray-50">Weight Range</th>
                  <th className="text-left p-3 bg-gray-50">Box Type</th>
                  <th className="text-left p-3 bg-gray-50">Strength</th>
                  <th className="text-left p-3 bg-gray-50">Required Materials</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((req, idx) => (
                  <tr 
                    key={idx} 
                    className={`border-b ${idx === weightCategory ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
                  >
                    <td className="p-3 font-semibold">{req.weight}</td>
                    <td className="p-3">{req.boxType}</td>
                    <td className="p-3">{req.strength}</td>
                    <td className="p-3">{req.materials.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}