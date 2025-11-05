import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Home, Plus, MapPin, Camera, Lock, AlertTriangle,
  Edit, Search, Map, Route, Info
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MailboxManagement() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMailbox, setSelectedMailbox] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMailbox, setNewMailbox] = useState({
    address: "",
    mailbox_type: "standard_residential",
    box_number: "",
    access_code: "",
    approach_notes: "",
    parking_location: "",
    side_of_road: "right"
  });

  const [newPreference, setNewPreference] = useState({
    customer_address: "",
    preferred_location: "front_door",
    specific_instructions: "",
    gate_code: "",
    parking_notes: "",
    dog_warning: false
  });

  const queryClient = useQueryClient();

  const { data: mailboxes } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: () => base44.entities.MailboxConfiguration.list('-last_updated'),
    initialData: [],
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => base44.entities.DeliveryPreference.list('-last_updated'),
    initialData: [],
  });

  const addMailboxMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.MailboxConfiguration.create({
        ...data,
        added_by: 'Current Driver',
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      setShowAddDialog(false);
      setNewMailbox({
        address: "",
        mailbox_type: "standard_residential",
        box_number: "",
        access_code: "",
        approach_notes: "",
        parking_location: "",
        side_of_road: "right"
      });
      toast.success("Mailbox configuration saved!");
    },
  });

  const addPreferenceMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.DeliveryPreference.create({
        ...data,
        added_by_driver: 'Current Driver',
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      toast.success("Delivery preference saved!");
    },
  });

  const filteredMailboxes = mailboxes.filter(m =>
    !searchQuery ||
    m.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.box_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPreferences = preferences.filter(p =>
    !searchQuery ||
    p.customer_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Home className="w-10 h-10 text-purple-600" />
            Mailbox & Delivery Management
          </h1>
          <p className="text-gray-600">Document mailboxes and customer delivery preferences for your route</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <Home className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">{mailboxes.length}</p>
              <p className="text-sm text-gray-600">Mailboxes Documented</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <MapPin className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{preferences.length}</p>
              <p className="text-sm text-gray-600">Delivery Preferences</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">
                {mailboxes.filter(m => m.needs_repair).length}
              </p>
              <p className="text-sm text-gray-600">Need Maintenance</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Mailbox/Preference
          </Button>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search addresses..."
            className="max-w-md"
          />
        </div>

        {/* Mailboxes Section */}
        <Card className="border-2 border-purple-200 mb-8">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-purple-900">Mailbox Configurations</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredMailboxes.length === 0 ? (
              <div className="text-center py-8">
                <Home className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No mailboxes documented yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMailboxes.map((mailbox) => (
                  <Card key={mailbox.id} className="border-2 border-gray-200 hover:border-purple-300 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-900">{mailbox.address}</h4>
                            {mailbox.needs_repair && (
                              <Badge className="bg-red-600">Needs Repair</Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Type</p>
                              <p className="font-semibold capitalize">
                                {mailbox.mailbox_type?.replace(/_/g, ' ')}
                              </p>
                            </div>
                            {mailbox.box_number && (
                              <div>
                                <p className="text-gray-600">Box #</p>
                                <p className="font-semibold">{mailbox.box_number}</p>
                              </div>
                            )}
                            {mailbox.access_code && (
                              <div>
                                <p className="text-gray-600">Access Code</p>
                                <p className="font-semibold text-orange-700">{mailbox.access_code}</p>
                              </div>
                            )}
                            {mailbox.side_of_road && (
                              <div>
                                <p className="text-gray-600">Side of Road</p>
                                <p className="font-semibold capitalize">{mailbox.side_of_road}</p>
                              </div>
                            )}
                          </div>

                          {mailbox.approach_notes && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs font-semibold text-blue-900 mb-1">📝 Notes:</p>
                              <p className="text-xs text-blue-800">{mailbox.approach_notes}</p>
                            </div>
                          )}

                          {mailbox.hazards && mailbox.hazards.length > 0 && (
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {mailbox.hazards.map((hazard, idx) => (
                                <Badge key={idx} className="bg-red-600 text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {hazard}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <Button
                          onClick={() => setSelectedMailbox(mailbox)}
                          variant="outline"
                          size="sm"
                        >
                          <Info className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-blue-900">Delivery Preferences</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredPreferences.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No delivery preferences saved yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPreferences.map((pref) => (
                  <Card key={pref.id} className="border-2 border-gray-200 hover:border-blue-300 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-gray-900">{pref.customer_name || pref.customer_address}</h4>
                          <p className="text-sm text-gray-600">{pref.customer_address}</p>
                        </div>
                        {pref.dog_warning && (
                          <Badge className="bg-red-600 animate-pulse">🐕 Dog Warning</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-2">
                        {pref.preferred_location && (
                          <div>
                            <p className="text-gray-600">Preferred Location</p>
                            <p className="font-semibold capitalize">
                              {pref.preferred_location.replace(/_/g, ' ')}
                            </p>
                          </div>
                        )}
                        {pref.gate_code && (
                          <div>
                            <p className="text-gray-600">Gate Code</p>
                            <p className="font-semibold text-orange-700">{pref.gate_code}</p>
                          </div>
                        )}
                        {pref.customer_usually_home && (
                          <div>
                            <p className="text-gray-600">Usually Home</p>
                            <p className="font-semibold capitalize">
                              {pref.customer_usually_home.replace(/_/g, ' ')}
                            </p>
                          </div>
                        )}
                      </div>

                      {pref.specific_instructions && (
                        <div className="p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-xs text-green-800">💡 {pref.specific_instructions}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Mailbox Configuration & Delivery Preferences</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Mailbox Section */}
              <Card className="border-2 border-purple-200">
                <CardHeader className="bg-purple-50">
                  <CardTitle className="text-base text-purple-900">Mailbox Configuration</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label>Address *</Label>
                    <Input
                      value={newMailbox.address}
                      onChange={(e) => setNewMailbox({...newMailbox, address: e.target.value})}
                      placeholder="123 Main St"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Mailbox Type</Label>
                      <Select
                        value={newMailbox.mailbox_type}
                        onValueChange={(v) => setNewMailbox({...newMailbox, mailbox_type: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard_residential">Standard Residential</SelectItem>
                          <SelectItem value="apartment_cluster">Apartment Cluster</SelectItem>
                          <SelectItem value="cbu_cluster_box">CBU Cluster Box</SelectItem>
                          <SelectItem value="parcel_locker">Parcel Locker</SelectItem>
                          <SelectItem value="rural_roadside">Rural Roadside</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Box Number</Label>
                      <Input
                        value={newMailbox.box_number}
                        onChange={(e) => setNewMailbox({...newMailbox, box_number: e.target.value})}
                        placeholder="Box or unit #"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Access Code</Label>
                      <Input
                        value={newMailbox.access_code}
                        onChange={(e) => setNewMailbox({...newMailbox, access_code: e.target.value})}
                        placeholder="Combination or code"
                      />
                    </div>

                    <div>
                      <Label>Side of Road</Label>
                      <Select
                        value={newMailbox.side_of_road}
                        onValueChange={(v) => setNewMailbox({...newMailbox, side_of_road: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="either">Either</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Approach Notes</Label>
                    <Textarea
                      value={newMailbox.approach_notes}
                      onChange={(e) => setNewMailbox({...newMailbox, approach_notes: e.target.value})}
                      placeholder="How to approach this mailbox..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Parking Location</Label>
                    <Input
                      value={newMailbox.parking_location}
                      onChange={(e) => setNewMailbox({...newMailbox, parking_location: e.target.value})}
                      placeholder="Where to park for this delivery"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Preference Section */}
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-base text-blue-900">Delivery Preferences (Optional)</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label>Customer Address</Label>
                    <Input
                      value={newPreference.customer_address}
                      onChange={(e) => setNewPreference({...newPreference, customer_address: e.target.value})}
                      placeholder="Same as mailbox address or specific address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Preferred Location</Label>
                      <Select
                        value={newPreference.preferred_location}
                        onValueChange={(v) => setNewPreference({...newPreference, preferred_location: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="front_door">Front Door</SelectItem>
                          <SelectItem value="back_door">Back Door</SelectItem>
                          <SelectItem value="side_door">Side Door</SelectItem>
                          <SelectItem value="garage">Garage</SelectItem>
                          <SelectItem value="porch">Porch</SelectItem>
                          <SelectItem value="mailbox">Mailbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Gate Code</Label>
                      <Input
                        value={newPreference.gate_code}
                        onChange={(e) => setNewPreference({...newPreference, gate_code: e.target.value})}
                        placeholder="Gate or door code"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Specific Instructions</Label>
                    <Textarea
                      value={newPreference.specific_instructions}
                      onChange={(e) => setNewPreference({...newPreference, specific_instructions: e.target.value})}
                      placeholder="Any specific delivery instructions..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Parking Notes</Label>
                    <Input
                      value={newPreference.parking_notes}
                      onChange={(e) => setNewPreference({...newPreference, parking_notes: e.target.value})}
                      placeholder="Where to park"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dog_warning"
                      checked={newPreference.dog_warning}
                      onChange={(e) => setNewPreference({...newPreference, dog_warning: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="dog_warning" className="cursor-pointer text-red-700 font-semibold">
                      🐕 Dog Warning - Exercise Caution
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    addMailboxMutation.mutate(newMailbox);
                    if (newPreference.customer_address) {
                      addPreferenceMutation.mutate(newPreference);
                    }
                  }}
                  disabled={!newMailbox.address}
                  className="flex-1 bg-purple-600"
                >
                  Save Configuration
                </Button>
                <Button
                  onClick={() => setShowAddDialog(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}