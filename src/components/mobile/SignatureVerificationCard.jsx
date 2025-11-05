import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileSignature, Calendar, MapPin, User } from "lucide-react";
import { format } from "date-fns";

export default function SignatureVerificationCard({ delivery, onProceedToDeliver }) {
  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader className="bg-purple-100 border-b-2 border-purple-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-purple-900 flex items-center gap-2">
            <FileSignature className="w-5 h-5" />
            Signature Verified
          </CardTitle>
          <Badge className="bg-green-600 text-white">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Authorized
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Customer Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-bold text-gray-900">{delivery.customer_name}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">Delivery Address</p>
              <p className="text-sm text-gray-900">{delivery.delivery_address}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Signed On</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(delivery.signature_date), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        </div>

        {/* Signature Display */}
        <div className="p-4 bg-white rounded-lg border-2 border-purple-300">
          <p className="text-sm font-semibold text-purple-900 mb-3">Customer's Authorization Signature:</p>
          <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
            <img 
              src={delivery.signature_data} 
              alt="Customer signature" 
              className="w-full h-32 object-contain"
            />
          </div>
          <p className="text-xs text-gray-600 mt-2 text-center">
            Signature electronically captured and verified
          </p>
        </div>

        {/* Authorization Details */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-2">✅ Customer Authorized:</p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
            <li>Delivery to {delivery.delivery_address}</li>
            <li>Package release without in-person signature</li>
            <li>Next business day delivery</li>
            <li>USPS liability release accepted</li>
          </ul>
        </div>

        {/* Carrier Notes */}
        {delivery.carrier_notes && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ Special Instructions:</p>
            <p className="text-sm text-amber-800">{delivery.carrier_notes}</p>
          </div>
        )}

        {/* Tracking Info */}
        <div className="p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs text-gray-600">Tracking Number:</p>
          <p className="font-mono text-sm font-bold text-gray-900">{delivery.tracking_number}</p>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => onProceedToDeliver(delivery)}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Proceed to Deliver Package
        </Button>

        <p className="text-xs text-center text-gray-500">
          Signature verified ✓ • Customer authorized delivery ✓ • GPS tracking active ✓
        </p>
      </CardContent>
    </Card>
  );
}