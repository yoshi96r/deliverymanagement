import React, { useState, useEffect } from 'react';
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";

export default function NotificationBadge({ driverEmail, onClick }) {
  const [count, setCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);

  useEffect(() => {
    checkNotifications();
    
    // Check every 10 seconds
    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  }, [driverEmail]);

  const checkNotifications = async () => {
    try {
      const notifications = await base44.entities.PushNotification.filter({
        driver_email: driverEmail,
        acknowledged: false
      });

      // Filter out expired
      const now = new Date();
      const active = notifications.filter(n => 
        !n.expires_at || new Date(n.expires_at) > now
      );

      setCount(active.length);
      setHasCritical(active.some(n => n.priority === 'critical'));
    } catch (error) {
      console.error("Failed to check notifications:", error);
    }
  };

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`relative ${hasCritical ? 'animate-pulse' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        hasCritical 
          ? 'bg-red-600 shadow-lg' 
          : 'bg-blue-600'
      }`}>
        <Bell className="w-5 h-5 text-white" />
      </div>
      {count > 0 && (
        <div className="absolute -top-1 -right-1">
          <Badge className={`${
            hasCritical ? 'bg-red-800' : 'bg-red-600'
          } text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center`}>
            {count > 9 ? '9+' : count}
          </Badge>
        </div>
      )}
    </button>
  );
}