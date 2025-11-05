import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, MapPin, Calendar, FileSignature, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusConfig = {
  pending: { 
    color: "bg-amber-100 text-amber-800 border-amber-300", 
    label: "Signature Required",
    icon: AlertCircle 
  },
  signed: { 
    color: "bg-blue-100 text-blue-800 border-blue-300", 
    label: "Signed - Ready for Delivery",
    icon: FileSignature 
  },
  delivered: { 
    color: "bg-green-100 text-green-800 border-green-300", 
    label: "Delivered",
    icon: Package 
  },
  held_at_post_office: { 
    color: "bg-gray-100 text-gray-800 border-gray-300", 
    label: "Held at Post Office",
    icon: Package 
  }
};

export default function DeliveryCard({ delivery, onClick }) {
  const status = statusConfig[delivery.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card 
      className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-blue-100 hover:border-blue-300"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="font-mono text-sm font-semibold text-blue-900">
                {delivery.tracking_number}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">{delivery.customer_name}</h3>
          </div>
          <Badge className={`${status.color} border flex items-center gap-1 px-3 py-1`}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {delivery.package_photo_url && (
          <div className="relative h-40 rounded-lg overflow-hidden bg-gray-100">
            <img 
              src={delivery.package_photo_url} 
              alt="Package" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 text-gray-700">
            <MapPin className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <span>{delivery.delivery_address}</span>
          </div>
          
          {delivery.scheduled_delivery_date && (
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Scheduled: {format(new Date(delivery.scheduled_delivery_date), "MMM d, yyyy")}</span>
            </div>
          )}

          {delivery.carrier_notes && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-1">Carrier Notes:</p>
              <p className="text-sm text-blue-800">{delivery.carrier_notes}</p>
            </div>
          )}
        </div>

        {delivery.status === 'pending' && (
          <Button 
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <FileSignature className="w-4 h-4 mr-2" />
            Sign for Delivery
          </Button>
        )}
      </CardContent>
    </Card>
  );
}