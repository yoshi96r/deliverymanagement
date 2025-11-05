import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BellOff, Check, CheckCheck, Trash2, Archive, Filter } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function NotificationCenter() {
  const [filter, setFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_at', 100),
    initialData: [],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, {
        read: true,
        read_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n =>
        base44.entities.Notification.update(n.id, {
          read: true,
          read_at: new Date().toISOString()
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success("All notifications marked as read");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, {
        archived: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success("Notification archived");
    },
  });

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;
    
    if (filter === "unread") {
      filtered = filtered.filter(n => !n.read && !n.archived);
    } else if (filter === "read") {
      filtered = filtered.filter(n => n.read && !n.archived);
    } else if (filter === "archived") {
      filtered = filtered.filter(n => n.archived);
    } else {
      filtered = filtered.filter(n => !n.archived);
    }

    return filtered;
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

  const getNotificationIcon = (type) => {
    const icons = {
      delivery: "📦",
      exception: "⚠️",
      payment: "💰",
      route: "🗺️",
      safety: "🛡️",
      system: "⚙️",
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌"
    };
    return icons[type] || "📬";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: "border-red-400 bg-red-50",
      high: "border-orange-400 bg-orange-50",
      normal: "border-blue-200 bg-white",
      low: "border-gray-200 bg-gray-50"
    };
    return colors[priority] || colors.normal;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Bell className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Notifications</h1>
                <p className="text-gray-600 mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                onClick={() => markAllAsReadMutation.mutate()}
                variant="outline"
                className="border-2 border-blue-300"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-md">
            <TabsTrigger value="all">
              All
              <Badge className="ml-2 bg-blue-600">
                {notifications.filter(n => !n.archived).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-red-600">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read">
              Read
            </TabsTrigger>
            <TabsTrigger value="archived">
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <Card className="border-2 border-gray-200">
              <CardContent className="p-12 text-center">
                <BellOff className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 text-lg">No notifications</p>
                <p className="text-sm text-gray-500 mt-2">You're all caught up!</p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`border-2 transition-all hover:shadow-md ${
                  notification.read ? "opacity-60" : ""
                } ${getPriorityColor(notification.priority)}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{getNotificationIcon(notification.type)}</div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-1">{notification.title}</h3>
                          <p className="text-sm text-gray-700">{notification.message}</p>
                        </div>
                        <div className="flex gap-1">
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveMutation.mutate(notification.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {notification.category}
                        </Badge>
                        {notification.priority !== "normal" && (
                          <Badge className={
                            notification.priority === "urgent" ? "bg-red-600" :
                            notification.priority === "high" ? "bg-orange-600" :
                            "bg-gray-600"
                          }>
                            {notification.priority}
                          </Badge>
                        )}
                      </div>

                      {notification.action_url && notification.action_label && (
                        <Link to={notification.action_url}>
                          <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">
                            {notification.action_label}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}