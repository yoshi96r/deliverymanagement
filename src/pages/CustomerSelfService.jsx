import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, Bell, MapPin, Calendar, Clock, 
  Save, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

export default function CustomerSelfService() {
  const [customerEmail, setCustomerEmail] = useState("");
  const [preferences, setPreferences] = useState({
    customer_name: "",
    delivery_address: "",
    vacation_hold_active: false,
    vacation_hold_start: "",
    vacation_hold_end: "",
    preferred_delivery_window: "any_time",
    safe_place_instructions: "",
    signature_preference: "electronic_ok",
    leave_if_no_response: true,
    notification_preferences: {
      email_on_delivery: true,
      sms_on_delivery: false,
      email_on_out_for_delivery: true,
      sms_approaching: false
    }
  });

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (prefData) => {
      const existing = await base44.entities.CustomerPreference.filter({
        customer_email: customerEmail
      });

      if (existing.length > 0) {
        return await base44.entities.CustomerPreference.update(existing[0].id, {
          ...prefData,
          updated_at: new Date().toISOString()
        });
      } else {
        return await base44.entities.CustomerPreference.create({
          ...prefData,
          customer_email: customerEmail,
          updated_at: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      toast.success("Preferences saved!");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <User className="w-10 h-10 text-blue-600" />
            My Delivery Preferences
          </h1>
          <p className="text-gray-600">Manage how and when you receive your packages</p>
        </div>

        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardTitle className="text-blue-900">Update Your Preferences</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Your Name</Label>
                  <Input
                    value={preferences.customer_name}
                    onChange={(e) => setPreferences({...preferences, customer_name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <Label>Delivery Address</Label>
                <Input
                  value={preferences.delivery_address}
                  onChange={(e) => setPreferences({...preferences, delivery_address: e.target.value})}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>
            </div>

            {/* Vacation Hold */}
            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-orange-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-orange-900">
                    <Calendar className="w-5 h-5 inline mr-2" />
                    Vacation Mail Hold
                  </CardTitle>
                  <Switch
                    checked={preferences.vacation_hold_active}
                    onCheckedChange={(checked) => setPreferences({...preferences, vacation_hold_active: checked})}
                  />
                </div>
              </CardHeader>
              {preferences.vacation_hold_active && (
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={preferences.vacation_hold_start}
                        onChange={(e) => setPreferences({...preferences, vacation_hold_start: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={preferences.vacation_hold_end}
                        onChange={(e) => setPreferences({...preferences, vacation_hold_end: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-orange-100 rounded">
                    <p className="text-sm text-orange-900">
                      📬 Your mail will be held at the post office during these dates
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Delivery Window */}
            <div>
              <Label>Preferred Delivery Time Window</Label>
              <Select
                value={preferences.preferred_delivery_window}
                onValueChange={(v) => setPreferences({...preferences, preferred_delivery_window: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning_8am_12pm">Morning (8am - 12pm)</SelectItem>
                  <SelectItem value="afternoon_12pm_5pm">Afternoon (12pm - 5pm)</SelectItem>
                  <SelectItem value="evening_5pm_8pm">Evening (5pm - 8pm)</SelectItem>
                  <SelectItem value="any_time">Any Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Safe Place */}
            <div>
              <Label>Safe Place Instructions</Label>
              <Textarea
                value={preferences.safe_place_instructions}
                onChange={(e) => setPreferences({...preferences, safe_place_instructions: e.target.value})}
                placeholder="Leave packages by front door, covered porch..."
                rows={3}
              />
            </div>

            {/* Notifications */}
            <Card className="border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-base text-purple-900">
                  <Bell className="w-5 h-5 inline mr-2" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Email when delivered</Label>
                  <Switch
                    checked={preferences.notification_preferences.email_on_delivery}
                    onCheckedChange={(checked) => setPreferences({
                      ...preferences,
                      notification_preferences: {
                        ...preferences.notification_preferences,
                        email_on_delivery: checked
                      }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>SMS when delivered</Label>
                  <Switch
                    checked={preferences.notification_preferences.sms_on_delivery}
                    onCheckedChange={(checked) => setPreferences({
                      ...preferences,
                      notification_preferences: {
                        ...preferences.notification_preferences,
                        sms_on_delivery: checked
                      }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Email when out for delivery</Label>
                  <Switch
                    checked={preferences.notification_preferences.email_on_out_for_delivery}
                    onCheckedChange={(checked) => setPreferences({
                      ...preferences,
                      notification_preferences: {
                        ...preferences.notification_preferences,
                        email_on_out_for_delivery: checked
                      }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>SMS when approaching</Label>
                  <Switch
                    checked={preferences.notification_preferences.sms_approaching}
                    onCheckedChange={(checked) => setPreferences({
                      ...preferences,
                      notification_preferences: {
                        ...preferences.notification_preferences,
                        sms_approaching: checked
                      }
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => {
                if (!customerEmail || !preferences.customer_name || !preferences.delivery_address) {
                  toast.error("Please fill in all required fields");
                  return;
                }
                saveMutation.mutate(preferences);
              }}
              disabled={saveMutation.isPending}
              className="w-full bg-blue-600 h-12"
            >
              {saveMutation.isPending ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Preferences
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}