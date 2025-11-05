import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, Bell, DollarSign, Shield, Zap,
  Globe, Mail, MessageSquare
} from "lucide-react";

export default function SystemSettings() {
  const { data: settings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: () => base44.entities.SystemSettings.list(),
    initialData: [],
  });

  const settingsByCategory = {
    general: settings.filter(s => s.setting_category === 'general'),
    payment: settings.filter(s => s.setting_category === 'payment'),
    notifications: settings.filter(s => s.setting_category === 'notifications'),
    routing: settings.filter(s => s.setting_category === 'routing'),
    compliance: settings.filter(s => s.setting_category === 'compliance'),
    safety: settings.filter(s => s.setting_category === 'safety'),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Settings className="w-10 h-10 text-blue-600" />
            System Settings
          </h1>
          <p className="text-gray-600">Configure system-wide settings and preferences</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-white shadow-md">
            <TabsTrigger value="general">
              <Globe className="w-4 h-4 mr-1" />
              General
            </TabsTrigger>
            <TabsTrigger value="payment">
              <DollarSign className="w-4 h-4 mr-1" />
              Payment
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-1" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="routing">
              <Zap className="w-4 h-4 mr-1" />
              Routing
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <Shield className="w-4 h-4 mr-1" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="safety">
              <Shield className="w-4 h-4 mr-1" />
              Safety
            </TabsTrigger>
          </TabsList>

          {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
            <TabsContent key={category} value={category}>
              <Card className="border-2 border-gray-200">
                <CardHeader className="bg-gray-50">
                  <CardTitle className="capitalize">{category} Settings</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {categorySettings.length === 0 ? (
                    <div className="text-center py-12">
                      <Settings className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-600">No settings configured</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {categorySettings.map((setting) => (
                        <div key={setting.id} className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 mb-1">{setting.setting_name}</h4>
                              <p className="text-sm text-gray-600 mb-2">{setting.description}</p>
                              <div className="flex gap-2 items-center">
                                <span className="text-sm text-gray-600">Current Value:</span>
                                <Badge variant="outline">{setting.setting_value}</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}