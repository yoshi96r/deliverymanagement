import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, Bell, CheckCircle2, X, Zap, Navigation,
  Shield, MessageSquare, Clock
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationPanel({ 
  driverEmail, 
  onNotificationAction,
  className 
}) {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    
    // Poll for new notifications every 10 seconds
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [driverEmail]);

  const loadNotifications = async () => {
    try {
      const allNotifications = await base44.entities.PushNotification.filter({
        driver_email: driverEmail
      });

      // Filter to active, unacknowledged notifications that haven't expired
      const now = new Date();
      const activeNotifications = allNotifications
        .filter(n => {
          if (n.acknowledged) return false;
          if (n.expires_at && new Date(n.expires_at) < now) return false;
          return true;
        })
        .sort((a, b) => {
          // Sort by priority, then by time
          const priorityOrder = { critical: 0, urgent: 1, high: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return new Date(b.sent_at) - new Date(a.sent_at);
        });

      // Mark new notifications as read when loaded
      const unreadIds = activeNotifications
        .filter(n => !n.read)
        .map(n => n.id);

      if (unreadIds.length > 0) {
        for (const id of unreadIds) {
          await base44.entities.PushNotification.update(id, {
            read: true,
            read_at: new Date().toISOString()
          });
        }
      }

      setNotifications(activeNotifications);
      setLoading(false);

      // Play alert sound for critical notifications
      const criticalUnread = activeNotifications.filter(
        n => n.priority === 'critical' && !n.sound_played
      );
      
      if (criticalUnread.length > 0) {
        playAlertSound();
        // Mark as sound played
        for (const notification of criticalUnread) {
          await base44.entities.PushNotification.update(notification.id, {
            sound_played: true
          });
        }
      }

    } catch (error) {
      console.error("Failed to load notifications:", error);
      setLoading(false);
    }
  };

  const playAlertSound = () => {
    // Play browser notification sound
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGGS57OihTgwOUKzn77dmHAU7k9jyzn0vBSh+zPLaizsKE12y6OyrWBMKRp/i8r1uIQUsgs/y24k3Bxhiu+3ooE0MDlGr5fC4aB0FOZLa8s1+MAUpfs3y24s4ChNesung');
      audio.play().catch(() => {
        // Silently fail if audio can't play
      });
    } catch (e) {
      // Ignore audio errors
    }
  };

  const handleAcknowledge = async (notification) => {
    try {
      await base44.entities.PushNotification.update(notification.id, {
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        driver_response: "Acknowledged"
      });

      setNotifications(notifications.filter(n => n.id !== notification.id));
      setSelectedNotification(null);
      toast.success("Notification acknowledged");

      // Call parent callback if action needed
      if (onNotificationAction && notification.action_url) {
        onNotificationAction(notification);
      }
    } catch (error) {
      console.error("Failed to acknowledge notification:", error);
      toast.error("Failed to acknowledge notification");
    }
  };

  const handleDismiss = async (notification) => {
    try {
      await base44.entities.PushNotification.update(notification.id, {
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        driver_response: "Dismissed",
        auto_dismissed: true
      });

      setNotifications(notifications.filter(n => n.id !== notification.id));
      setSelectedNotification(null);
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'urgent_route_modification':
        return Navigation;
      case 'critical_safety_alert':
        return Shield;
      case 'emergency_assignment':
        return Zap;
      case 'dispatcher_urgent_message':
        return MessageSquare;
      case 'weather_emergency':
        return AlertTriangle;
      default:
        return Bell;
    }
  };

  const getTimeAgo = (sentAt) => {
    const minutes = differenceInMinutes(new Date(), new Date(sentAt));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return format(new Date(sentAt), "MMM d 'at' h:mm a");
  };

  if (loading) return null;

  return (
    <AnimatePresence>
      {notifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={className}
        >
          <div className="space-y-2">
            {notifications.map((notification, index) => {
              const Icon = getNotificationIcon(notification.notification_type);
              const isExpanded = selectedNotification?.id === notification.id;

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Alert
                    className={`border-2 cursor-pointer ${
                      notification.priority === 'critical' 
                        ? 'border-red-300 bg-red-50 animate-pulse shadow-lg' 
                        : notification.priority === 'urgent'
                        ? 'border-orange-300 bg-orange-50 shadow-md'
                        : 'border-yellow-300 bg-yellow-50'
                    }`}
                    onClick={() => setSelectedNotification(isExpanded ? null : notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.priority === 'critical' ? 'bg-red-600' :
                        notification.priority === 'urgent' ? 'bg-orange-600' :
                        'bg-yellow-600'
                      }`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={
                              notification.priority === 'critical' ? 'bg-red-600' :
                              notification.priority === 'urgent' ? 'bg-orange-600' :
                              'bg-yellow-600'
                            }>
                              {notification.priority.toUpperCase()}
                            </Badge>
                            {notification.priority === 'critical' && (
                              <Badge className="bg-red-800 text-white animate-pulse">
                                ACTION REQUIRED
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {getTimeAgo(notification.sent_at)}
                          </span>
                        </div>

                        <AlertDescription>
                          <p className="font-bold text-gray-900 mb-1">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-700">
                            {notification.message}
                          </p>

                          {isExpanded && notification.action_required && (
                            <div className="mt-3 pt-3 border-t border-gray-300 flex gap-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcknowledge(notification);
                                }}
                                size="sm"
                                className={`flex-1 ${
                                  notification.priority === 'critical' 
                                    ? 'bg-red-600 hover:bg-red-700' 
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                {notification.action_type === 'acknowledge' 
                                  ? 'Acknowledge' 
                                  : 'Take Action'}
                              </Button>
                              {notification.priority !== 'critical' && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismiss(notification);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="border-gray-300"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </AlertDescription>
                      </div>

                      {!isExpanded && notification.action_required && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </Alert>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}