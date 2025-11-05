import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, CheckCircle2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export default function LocationShareHandler({ driverEmail, conversationId }) {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error("Location error:", error);
        }
      );
    }
  }, []);

  const { data: pendingRequests, refetch } = useQuery({
    queryKey: ['locationRequests', conversationId, driverEmail],
    queryFn: async () => {
      if (!conversationId) return [];
      const requests = await base44.entities.LocationShareRequest.filter({
        conversation_id: conversationId,
        driver_email: driverEmail,
        status: "pending"
      });
      return requests;
    },
    initialData: [],
    enabled: !!conversationId,
    refetchInterval: 5000,
  });

  const handleShareLocation = async (request) => {
    if (!currentLocation) {
      toast.error("Location not available. Please enable GPS.");
      return;
    }

    try {
      // Update request
      await base44.entities.LocationShareRequest.update(request.id, {
        status: "shared",
        shared_at: new Date().toISOString(),
        location_data: currentLocation
      });

      // Send location in chat
      await base44.entities.ChatMessage.create({
        conversation_id: conversationId,
        sender_email: driverEmail,
        sender_name: request.driver_name,
        sender_role: "driver",
        message_text: `📍 Shared location in response to: ${request.reason}`,
        message_type: "location_share",
        sent_at: new Date().toISOString(),
        read_by: [{
          email: driverEmail,
          read_at: new Date().toISOString()
        }],
        delivered_to: [driverEmail],
        location_data: currentLocation
      });

      refetch();
      toast.success("Location shared!");
    } catch (error) {
      console.error("Failed to share location:", error);
      toast.error("Failed to share location");
    }
  };

  const handleDeclineRequest = async (request) => {
    try {
      await base44.entities.LocationShareRequest.update(request.id, {
        status: "declined"
      });

      await base44.entities.ChatMessage.create({
        conversation_id: conversationId,
        sender_email: driverEmail,
        sender_name: request.driver_name,
        sender_role: "driver",
        message_text: "Declined location sharing request",
        message_type: "text",
        sent_at: new Date().toISOString(),
        read_by: [{
          email: driverEmail,
          read_at: new Date().toISOString()
        }],
        delivered_to: [driverEmail]
      });

      refetch();
    } catch (error) {
      console.error("Failed to decline:", error);
    }
  };

  if (pendingRequests.length === 0) return null;

  return (
    <div className="space-y-2">
      {pendingRequests.map((request) => (
        <Alert key={request.id} className="border-2 border-blue-300 bg-blue-50">
          <MapPin className="h-5 w-5 text-blue-600" />
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-blue-900 mb-1">
                  📍 Location Request from {request.requested_by_name}
                </p>
                <p className="text-sm text-blue-800">{request.reason}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Requested {format(new Date(request.requested_at), "h:mm a")}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleShareLocation(request)}
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!currentLocation}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Share Location
                </Button>
                <Button
                  onClick={() => handleDeclineRequest(request)}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>

              {!currentLocation && (
                <p className="text-xs text-orange-700">
                  ⚠️ Enable GPS to share location
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}