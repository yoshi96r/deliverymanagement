import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function GroupChatManager({ currentUserEmail, currentUserName, onGroupCreated }) {
  const [groupName, setGroupName] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  // Get unique drivers
  const drivers = React.useMemo(() => {
    const driversMap = {};
    
    deliveries.forEach(delivery => {
      if (!delivery.carrier_email) return;
      
      if (!driversMap[delivery.carrier_email]) {
        driversMap[delivery.carrier_email] = {
          email: delivery.carrier_email,
          name: delivery.carrier_name || 'Unknown Driver',
          activeDeliveries: 0
        };
      }
      
      if (delivery.status !== 'delivered') {
        driversMap[delivery.carrier_email].activeDeliveries++;
      }
    });

    return Object.values(driversMap);
  }, [deliveries]);

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleDriver = (driverEmail) => {
    setSelectedDrivers(prev =>
      prev.includes(driverEmail)
        ? prev.filter(email => email !== driverEmail)
        : [...prev, driverEmail]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedDrivers.length === 0) {
      toast.error("Please select at least one driver");
      return;
    }

    setCreating(true);
    try {
      // Build participants list
      const participants = [
        {
          email: currentUserEmail,
          name: currentUserName,
          role: "dispatcher",
          joined_at: new Date().toISOString()
        },
        ...selectedDrivers.map(email => {
          const driver = drivers.find(d => d.email === email);
          return {
            email: email,
            name: driver?.name || 'Unknown',
            role: "driver",
            joined_at: new Date().toISOString()
          };
        })
      ];

      // Create conversation
      const conversation = await base44.entities.ChatConversation.create({
        conversation_type: "group",
        conversation_name: groupName,
        participants: participants,
        created_by: currentUserEmail,
        created_by_name: currentUserName,
        created_at: new Date().toISOString(),
        is_active: true,
        total_messages: 0,
        tags: ["dispatcher_created"]
      });

      // Send initial system message
      await base44.entities.ChatMessage.create({
        conversation_id: conversation.id,
        sender_email: "system",
        sender_name: "System",
        sender_role: "system",
        message_text: `${currentUserName} created this group chat`,
        message_type: "system_notification",
        sent_at: new Date().toISOString(),
        read_by: [],
        delivered_to: participants.map(p => p.email)
      });

      toast.success(`Group chat "${groupName}" created with ${selectedDrivers.length} drivers!`);
      
      // Reset form
      setGroupName("");
      setSelectedDrivers([]);
      
      if (onGroupCreated) onGroupCreated(conversation);
    } catch (error) {
      console.error("Failed to create group:", error);
      toast.error("Failed to create group chat");
    }
    setCreating(false);
  };

  return (
    <Card className="border-2 border-purple-300">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-6 h-6" />
          Create Group Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label htmlFor="groupName">Group Name *</Label>
          <Input
            id="groupName"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g., Zone A Drivers, Morning Shift Team..."
            className="mt-1"
          />
        </div>

        <div>
          <Label>Select Drivers ({selectedDrivers.length} selected)</Label>
          <div className="mt-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drivers..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="border-2 border-gray-200 rounded-lg p-3 max-h-80 overflow-y-auto">
          {filteredDrivers.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No drivers found</p>
          ) : (
            <div className="space-y-2">
              {filteredDrivers.map((driver) => (
                <div
                  key={driver.email}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => toggleDriver(driver.email)}
                >
                  <Checkbox
                    checked={selectedDrivers.includes(driver.email)}
                    onCheckedChange={() => toggleDriver(driver.email)}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{driver.name}</p>
                    <p className="text-xs text-gray-600">{driver.email}</p>
                  </div>
                  {driver.activeDeliveries > 0 && (
                    <Badge className="bg-blue-600">
                      {driver.activeDeliveries} active
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedDrivers.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-900 mb-2">Selected Drivers:</p>
            <div className="flex flex-wrap gap-2">
              {selectedDrivers.map(email => {
                const driver = drivers.find(d => d.email === email);
                return (
                  <Badge key={email} variant="outline" className="border-blue-300">
                    {driver?.name}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        <Button
          onClick={handleCreateGroup}
          disabled={creating || !groupName.trim() || selectedDrivers.length === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 text-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          {creating ? "Creating Group Chat..." : `Create Group Chat with ${selectedDrivers.length} Drivers`}
        </Button>
      </CardContent>
    </Card>
  );
}