import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, Users, Search, Edit, CheckCircle2, XCircle,
  UserCog, Lock, Unlock, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RoleManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  const [editData, setEditData] = useState({
    role: "",
    secondary_roles: [],
    status: "active",
    permissions: {}
  });

  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    initialData: null
  });

  const { data: users } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      return await base44.entities.User.update(userId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setShowEditDialog(false);
      setSelectedUser(null);
      toast.success("User role updated successfully!");
    },
  });

  const roleDefinitions = {
    customer: {
      color: "bg-blue-600",
      description: "Can track packages, create returns, file claims",
      defaultPermissions: {
        can_create_deliveries: false,
        can_complete_deliveries: false,
        can_manage_drivers: false,
        can_view_analytics: false,
        can_manage_payments: false,
        can_access_emergency_response: false,
        can_manage_routes: false,
        can_manage_system_settings: false
      }
    },
    driver: {
      color: "bg-green-600",
      description: "Can complete deliveries, record routes, track earnings",
      defaultPermissions: {
        can_create_deliveries: false,
        can_complete_deliveries: true,
        can_manage_drivers: false,
        can_view_analytics: false,
        can_manage_payments: false,
        can_access_emergency_response: true,
        can_manage_routes: false,
        can_manage_system_settings: false
      }
    },
    dispatcher: {
      color: "bg-purple-600",
      description: "Can manage routes, assign drivers, handle exceptions",
      defaultPermissions: {
        can_create_deliveries: true,
        can_complete_deliveries: false,
        can_manage_drivers: true,
        can_view_analytics: true,
        can_manage_payments: false,
        can_access_emergency_response: true,
        can_manage_routes: true,
        can_manage_system_settings: false
      }
    },
    manager: {
      color: "bg-orange-600",
      description: "Can view analytics, manage incidents, oversee operations",
      defaultPermissions: {
        can_create_deliveries: true,
        can_complete_deliveries: false,
        can_manage_drivers: true,
        can_view_analytics: true,
        can_manage_payments: true,
        can_access_emergency_response: true,
        can_manage_routes: true,
        can_manage_system_settings: false
      }
    },
    business_sender: {
      color: "bg-indigo-600",
      description: "Can create labels, manage shipments, view business analytics",
      defaultPermissions: {
        can_create_deliveries: true,
        can_complete_deliveries: false,
        can_manage_drivers: false,
        can_view_analytics: true,
        can_manage_payments: false,
        can_access_emergency_response: false,
        can_manage_routes: false,
        can_manage_system_settings: false
      }
    },
    admin: {
      color: "bg-red-600",
      description: "Full system access, can manage all settings and users",
      defaultPermissions: {
        can_create_deliveries: true,
        can_complete_deliveries: true,
        can_manage_drivers: true,
        can_view_analytics: true,
        can_manage_payments: true,
        can_access_emergency_response: true,
        can_manage_routes: true,
        can_manage_system_settings: true
      }
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditData({
      role: user.role || "customer",
      secondary_roles: user.secondary_roles || [],
      status: user.status || "active",
      permissions: user.permissions || roleDefinitions[user.role]?.defaultPermissions || {}
    });
    setShowEditDialog(true);
  };

  const handleSaveChanges = () => {
    if (!selectedUser) return;

    updateUserRoleMutation.mutate({
      userId: selectedUser.id,
      data: editData
    });
  };

  const toggleSecondaryRole = (role) => {
    if (editData.secondary_roles.includes(role)) {
      setEditData({
        ...editData,
        secondary_roles: editData.secondary_roles.filter(r => r !== role)
      });
    } else {
      setEditData({
        ...editData,
        secondary_roles: [...editData.secondary_roles, role]
      });
    }
  };

  const togglePermission = (permission) => {
    setEditData({
      ...editData,
      permissions: {
        ...editData.permissions,
        [permission]: !editData.permissions[permission]
      }
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    customer: users.filter(u => u.role === "customer").length,
    driver: users.filter(u => u.role === "driver").length,
    dispatcher: users.filter(u => u.role === "dispatcher").length,
    manager: users.filter(u => u.role === "manager").length,
    business_sender: users.filter(u => u.role === "business_sender").length,
    admin: users.filter(u => u.role === "admin").length,
  };

  // Check if current user is admin
  const isAdmin = currentUser?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-8">
        <Card className="border-2 border-red-300 bg-red-50 max-w-2xl mx-auto mt-20">
          <CardContent className="p-12 text-center">
            <Lock className="w-20 h-20 mx-auto text-red-600 mb-6" />
            <h2 className="text-2xl font-bold text-red-900 mb-3">Access Denied</h2>
            <p className="text-red-700 mb-6">
              You need administrator privileges to access role management.
            </p>
            <p className="text-sm text-red-600">Current Role: <strong>{currentUser?.role}</strong></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-purple-600" />
            Role & Permission Management
          </h1>
          <p className="text-gray-600">Manage user roles and access permissions</p>
        </div>

        {/* Role Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {Object.entries(roleStats).map(([role, count]) => (
            <Card key={role} className={`border-2 border-${roleDefinitions[role].color.split('-')[1]}-200`}>
              <CardContent className="p-4 text-center">
                <Badge className={roleDefinitions[role].color}>
                  {role.replace('_', ' ')}
                </Badge>
                <p className="text-3xl font-bold text-gray-900 mt-2">{count}</p>
                <p className="text-xs text-gray-600 mt-1">users</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Role Descriptions */}
        <Card className="border-2 border-blue-200 mb-8">
          <CardHeader className="bg-blue-50">
            <CardTitle>Role Descriptions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(roleDefinitions).map(([role, config]) => (
                <div key={role} className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <Badge className={`${config.color} mb-2`}>
                    {role.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-sm text-gray-700">{config.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card className="border-2 border-gray-200 mb-6">
          <CardContent className="p-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="pl-10 h-12"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48 h-12">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="driver">Drivers</SelectItem>
                  <SelectItem value="dispatcher">Dispatchers</SelectItem>
                  <SelectItem value="manager">Managers</SelectItem>
                  <SelectItem value="business_sender">Business Senders</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No users found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="border-2 border-gray-200 hover:border-purple-300 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-900">{user.full_name}</h4>
                            <Badge className={roleDefinitions[user.role || 'customer'].color}>
                              {(user.role || 'customer').replace('_', ' ').toUpperCase()}
                            </Badge>
                            {user.secondary_roles && user.secondary_roles.length > 0 && (
                              <Badge variant="outline">
                                +{user.secondary_roles.length} more
                              </Badge>
                            )}
                            <Badge className={
                              user.status === 'active' ? 'bg-green-600' :
                              user.status === 'inactive' ? 'bg-gray-600' :
                              user.status === 'suspended' ? 'bg-red-600' :
                              'bg-yellow-600'
                            }>
                              {user.status || 'active'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Email</p>
                              <p className="font-semibold">{user.email}</p>
                            </div>
                            {user.phone && (
                              <div>
                                <p className="text-gray-600">Phone</p>
                                <p className="font-semibold">{user.phone}</p>
                              </div>
                            )}
                            {user.driver_id && (
                              <div>
                                <p className="text-gray-600">Driver ID</p>
                                <p className="font-semibold">{user.driver_id}</p>
                              </div>
                            )}
                          </div>

                          {user.permissions && Object.keys(user.permissions).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(user.permissions)
                                .filter(([_, value]) => value === true)
                                .map(([perm, _]) => (
                                  <Badge key={perm} variant="outline" className="text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {perm.replace('can_', '').replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => handleEditUser(user)}
                          size="sm"
                          variant="outline"
                          className="border-purple-300 text-purple-700"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User Role & Permissions</DialogTitle>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-bold text-blue-900">{selectedUser.full_name}</p>
                  <p className="text-sm text-blue-700">{selectedUser.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Primary Role *</Label>
                    <Select
                      value={editData.role}
                      onValueChange={(v) => setEditData({
                        ...editData, 
                        role: v,
                        permissions: roleDefinitions[v].defaultPermissions
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="dispatcher">Dispatcher</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="business_sender">Business Sender</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Account Status</Label>
                    <Select
                      value={editData.status}
                      onValueChange={(v) => setEditData({...editData, status: v})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="pending_approval">Pending Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Secondary Roles (Optional)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(roleDefinitions)
                      .filter(r => r !== editData.role)
                      .map((role) => (
                        <button
                          key={role}
                          onClick={() => toggleSecondaryRole(role)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            editData.secondary_roles.includes(role)
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-900 capitalize">
                            {role.replace('_', ' ')}
                          </p>
                          {editData.secondary_roles.includes(role) && (
                            <CheckCircle2 className="w-4 h-4 text-purple-600 mx-auto mt-1" />
                          )}
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Granular Permissions</Label>
                  <div className="space-y-2">
                    {Object.entries(roleDefinitions[editData.role]?.defaultPermissions || {}).map(([permission, defaultValue]) => (
                      <div
                        key={permission}
                        className="flex items-center justify-between p-3 bg-white border-2 border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          {editData.permissions[permission] ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400" />
                          )}
                          <span className="text-sm font-semibold text-gray-900 capitalize">
                            {permission.replace('can_', '').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Button
                          onClick={() => togglePermission(permission)}
                          size="sm"
                          variant={editData.permissions[permission] ? "default" : "outline"}
                          className={editData.permissions[permission] ? "bg-green-600" : ""}
                        >
                          {editData.permissions[permission] ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {editData.role !== selectedUser.role && (
                  <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-yellow-900 mb-1">Role Change Warning</p>
                        <p className="text-sm text-yellow-800">
                          Changing this user's role will update their default permissions and access to pages.
                          They will lose access to {selectedUser.role}-specific features.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowEditDialog(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveChanges}
                    disabled={updateUserRoleMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {updateUserRoleMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}