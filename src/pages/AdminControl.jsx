import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Database, Users, Package, Truck, 
  MessageSquare, BarChart3, Edit, Trash2, Plus,
  Search, Settings, AlertTriangle, Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminControl() {
  const [activeEntity, setActiveEntity] = useState("DeliveryRequest");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState({});

  const queryClient = useQueryClient();

  // Entity configurations
  const entityConfigs = {
    DeliveryRequest: { icon: Package, label: "Deliveries", color: "blue" },
    Driver: { icon: Users, label: "Drivers", color: "green" },
    DriverVehicle: { icon: Truck, label: "Vehicles", color: "purple" },
    CustomerMessage: { icon: MessageSquare, label: "Messages", color: "orange" },
    DeliveryException: { icon: AlertTriangle, label: "Exceptions", color: "red" },
    HOSLog: { icon: Clock, label: "HOS Logs", color: "indigo" },
    DOTInspection: { icon: Shield, label: "DOT Inspections", color: "red" },
    InventoryItem: { icon: Package, label: "Inventory", color: "green" },
    LoadManagement: { icon: Truck, label: "Loads", color: "blue" },
    DeliveryPreference: { icon: Settings, label: "Preferences", color: "purple" },
    MailboxConfiguration: { icon: Package, label: "Mailboxes", color: "orange" },
  };

  const { data: records, isLoading } = useQuery({
    queryKey: ['adminRecords', activeEntity],
    queryFn: async () => {
      return await base44.entities[activeEntity].list('-created_date', 200);
    },
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: async (recordId) => {
      await base44.entities[activeEntity].delete(recordId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRecords', activeEntity] });
      toast.success("Record deleted");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ recordId, data }) => {
      await base44.entities[activeEntity].update(recordId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRecords', activeEntity] });
      setShowEditDialog(false);
      setSelectedRecord(null);
      toast.success("Record updated");
    },
  });

  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return JSON.stringify(record).toLowerCase().includes(searchLower);
  });

  const handleEdit = (record) => {
    setSelectedRecord(record);
    setEditData(record);
    setShowEditDialog(true);
  };

  const handleDelete = (recordId) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      deleteMutation.mutate(recordId);
    }
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      recordId: selectedRecord.id,
      data: editData
    });
  };

  const currentConfig = entityConfigs[activeEntity];
  const Icon = currentConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-red-600" />
            Admin Control Center
          </h1>
          <p className="text-gray-600">Full system access - manage all data and entities</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {Object.entries(entityConfigs).map(([entity, config]) => {
            const EntityIcon = config.icon;
            return (
              <Card 
                key={entity}
                className={`cursor-pointer transition-all border-2 ${
                  activeEntity === entity 
                    ? `border-${config.color}-500 bg-${config.color}-50` 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setActiveEntity(entity)}
              >
                <CardContent className="p-4 text-center">
                  <EntityIcon className={`w-6 h-6 mx-auto mb-1 text-${config.color}-600`} />
                  <p className="text-xs text-gray-600 font-semibold">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Icon className={`w-6 h-6 text-${currentConfig.color}-600`} />
                {currentConfig.label} Management
              </CardTitle>
              <Badge className="bg-blue-600">{filteredRecords.length} records</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search all fields..."
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>

            {/* Records List */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading {currentConfig.label.toLowerCase()}...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No {currentConfig.label.toLowerCase()} found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredRecords.map((record) => (
                  <Card key={record.id} className="border-2 border-gray-200 hover:border-blue-300 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Record Preview */}
                          <div className="mb-2">
                            <Badge variant="outline" className="mb-2">{record.id}</Badge>
                            {record.created_date && (
                              <p className="text-xs text-gray-500">
                                Created: {format(new Date(record.created_date), "MMM d, yyyy h:mm a")}
                              </p>
                            )}
                          </div>
                          
                          {/* Display key fields based on entity */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            {activeEntity === "DeliveryRequest" && (
                              <>
                                <div>
                                  <p className="text-gray-600">Tracking</p>
                                  <p className="font-mono font-bold text-gray-900">{record.tracking_number}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Customer</p>
                                  <p className="font-semibold">{record.customer_name}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Status</p>
                                  <Badge>{record.status}</Badge>
                                </div>
                              </>
                            )}
                            {activeEntity === "Driver" && (
                              <>
                                <div>
                                  <p className="text-gray-600">Name</p>
                                  <p className="font-semibold">{record.full_name}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Email</p>
                                  <p className="font-semibold">{record.email}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Status</p>
                                  <Badge>{record.status}</Badge>
                                </div>
                              </>
                            )}
                            {activeEntity === "CustomerMessage" && (
                              <>
                                <div>
                                  <p className="text-gray-600">Customer</p>
                                  <p className="font-semibold">{record.customer_name}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Subject</p>
                                  <p className="font-semibold">{record.message_subject}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Sentiment</p>
                                  <Badge className={
                                    record.sentiment === 'angry' ? 'bg-red-600' :
                                    record.sentiment === 'frustrated' ? 'bg-orange-600' :
                                    record.sentiment === 'positive' ? 'bg-green-600' :
                                    'bg-gray-600'
                                  }>
                                    {record.sentiment}
                                  </Badge>
                                </div>
                              </>
                            )}
                            {/* Generic fallback for other entities */}
                            {!["DeliveryRequest", "Driver", "CustomerMessage"].includes(activeEntity) && (
                              Object.entries(record)
                                .filter(([key, val]) => 
                                  key !== 'id' && 
                                  key !== 'created_date' && 
                                  key !== 'updated_date' &&
                                  typeof val !== 'object'
                                )
                                .slice(0, 3)
                                .map(([key, val]) => (
                                  <div key={key}>
                                    <p className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</p>
                                    <p className="font-semibold truncate">{String(val)}</p>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            onClick={() => handleEdit(record)}
                            size="sm"
                            variant="outline"
                            className="border-blue-300 text-blue-700"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDelete(record.id)}
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit {currentConfig.label} Record</DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900">Record ID: {selectedRecord.id}</p>
                  <p className="text-xs text-blue-700">
                    Created: {format(new Date(selectedRecord.created_date), "MMM d, yyyy h:mm a")}
                  </p>
                </div>

                {/* Dynamic form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
                  {Object.entries(selectedRecord)
                    .filter(([key]) => 
                      key !== 'id' && 
                      key !== 'created_date' && 
                      key !== 'updated_date' &&
                      key !== 'created_by'
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <label className="text-sm font-semibold text-gray-700 mb-1 block capitalize">
                          {key.replace(/_/g, ' ')}
                        </label>
                        {typeof value === 'boolean' ? (
                          <select
                            value={editData[key] ? 'true' : 'false'}
                            onChange={(e) => setEditData({...editData, [key]: e.target.value === 'true'})}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : typeof value === 'object' && value !== null ? (
                          <textarea
                            value={JSON.stringify(editData[key], null, 2)}
                            onChange={(e) => {
                              try {
                                setEditData({...editData, [key]: JSON.parse(e.target.value)});
                              } catch (err) {
                                // Keep as string if invalid JSON
                              }
                            }}
                            className="w-full p-2 border border-gray-300 rounded font-mono text-xs"
                            rows={3}
                          />
                        ) : (
                          <Input
                            type={typeof value === 'number' ? 'number' : 'text'}
                            value={editData[key] || ''}
                            onChange={(e) => setEditData({
                              ...editData, 
                              [key]: typeof value === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                            })}
                          />
                        )}
                      </div>
                    ))}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => setShowEditDialog(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="flex-1 bg-blue-600"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>

                {/* Raw JSON View */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700 mb-2">
                    View Raw JSON
                  </summary>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}