import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Package, Search, Plus, AlertTriangle, TrendingDown,
  BarChart3, Download, Upload, Edit, Archive
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InventoryManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [newItem, setNewItem] = useState({
    sku: "",
    item_name: "",
    category: "packaging_supplies",
    quantity_on_hand: 0,
    reorder_point: 10,
    cost_per_unit: 0
  });

  const [transaction, setTransaction] = useState({
    transaction_type: "receive",
    quantity: 0,
    unit_cost: 0
  });

  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => base44.entities.InventoryItem.list('-created_date'),
    initialData: [],
  });

  const { data: transactions } = useQuery({
    queryKey: ['inventoryTransactions'],
    queryFn: () => base44.entities.InventoryTransaction.list('-timestamp', 100),
    initialData: [],
  });

  const addItemMutation = useMutation({
    mutationFn: async (itemData) => {
      const item = await base44.entities.InventoryItem.create({
        ...itemData,
        quantity_available: itemData.quantity_on_hand,
        quantity_reserved: 0,
        low_stock_alert: itemData.quantity_on_hand <= (itemData.reorder_point || 0)
      });

      // Record initial inventory transaction
      await base44.entities.InventoryTransaction.create({
        transaction_type: "receive",
        item_id: item.id,
        sku: item.sku,
        item_name: item.item_name,
        quantity: item.quantity_on_hand,
        unit_cost: item.cost_per_unit,
        total_cost: item.quantity_on_hand * item.cost_per_unit,
        performed_by: "Admin",
        timestamp: new Date().toISOString(),
        notes: "Initial inventory",
        before_quantity: 0,
        after_quantity: item.quantity_on_hand
      });

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryTransactions'] });
      setShowAddItem(false);
      setNewItem({
        sku: "",
        item_name: "",
        category: "packaging_supplies",
        quantity_on_hand: 0,
        reorder_point: 10,
        cost_per_unit: 0
      });
      toast.success("Item added to inventory!");
    },
  });

  const recordTransactionMutation = useMutation({
    mutationFn: async ({ item, txn }) => {
      const newQuantity = item.quantity_on_hand + 
        (txn.transaction_type === "receive" ? txn.quantity : -txn.quantity);

      await base44.entities.InventoryItem.update(item.id, {
        quantity_on_hand: newQuantity,
        quantity_available: newQuantity - item.quantity_reserved,
        low_stock_alert: newQuantity <= item.reorder_point
      });

      await base44.entities.InventoryTransaction.create({
        ...txn,
        item_id: item.id,
        sku: item.sku,
        item_name: item.item_name,
        total_cost: txn.quantity * txn.unit_cost,
        performed_by: "Admin",
        timestamp: new Date().toISOString(),
        before_quantity: item.quantity_on_hand,
        after_quantity: newQuantity
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryTransactions'] });
      setShowTransaction(false);
      setSelectedItem(null);
      toast.success("Transaction recorded!");
    },
  });

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, categoryFilter]);

  const lowStockItems = items.filter(i => i.low_stock_alert);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity_on_hand * i.cost_per_unit), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Package className="w-10 h-10 text-blue-600" />
            Inventory Management
          </h1>
          <p className="text-gray-600">Track and manage your inventory</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Items</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{items.length}</p>
                </div>
                <Package className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Low Stock</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{lowStockItems.length}</p>
                </div>
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Total Value</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">${totalValue.toFixed(0)}</p>
                </div>
                <BarChart3 className="w-12 h-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Transactions</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{transactions.length}</p>
                </div>
                <TrendingDown className="w-12 h-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                    placeholder="Search by SKU or name..."
                    className="pl-10 h-12 text-base"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 h-12">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="packaging_supplies">Packaging Supplies</SelectItem>
                  <SelectItem value="shipping_materials">Shipping Materials</SelectItem>
                  <SelectItem value="labels">Labels</SelectItem>
                  <SelectItem value="tape">Tape</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setShowAddItem(true)}
                className="bg-blue-600 hover:bg-blue-700 h-12"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Inventory Items ({filteredItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No items found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <Card key={item.id} className={`border-2 ${item.low_stock_alert ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">{item.item_name}</h4>
                            <Badge variant="outline">{item.sku}</Badge>
                            <Badge className="bg-blue-600">{item.category.replace(/_/g, ' ')}</Badge>
                            {item.low_stock_alert && (
                              <Badge className="bg-red-600 animate-pulse">Low Stock</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-gray-600">On Hand</p>
                              <p className="font-bold text-gray-900">{item.quantity_on_hand}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Available</p>
                              <p className="font-bold text-green-900">{item.quantity_available}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Reorder Point</p>
                              <p className="font-bold text-orange-900">{item.reorder_point}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Unit Cost</p>
                              <p className="font-bold text-blue-900">${item.cost_per_unit}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowTransaction(true);
                            }}
                            size="sm"
                            className="bg-green-600"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Transaction
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

        {/* Add Item Dialog */}
        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Inventory Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SKU *</Label>
                  <Input
                    value={newItem.sku}
                    onChange={(e) => setNewItem({...newItem, sku: e.target.value})}
                    placeholder="SKU-001"
                  />
                </div>
                <div>
                  <Label>Item Name *</Label>
                  <Input
                    value={newItem.item_name}
                    onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                    placeholder="Item name"
                  />
                </div>
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(v) => setNewItem({...newItem, category: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="packaging_supplies">Packaging Supplies</SelectItem>
                    <SelectItem value="shipping_materials">Shipping Materials</SelectItem>
                    <SelectItem value="labels">Labels</SelectItem>
                    <SelectItem value="tape">Tape</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Initial Quantity</Label>
                  <Input
                    type="number"
                    value={newItem.quantity_on_hand}
                    onChange={(e) => setNewItem({...newItem, quantity_on_hand: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Reorder Point</Label>
                  <Input
                    type="number"
                    value={newItem.reorder_point}
                    onChange={(e) => setNewItem({...newItem, reorder_point: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Cost Per Unit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.cost_per_unit}
                    onChange={(e) => setNewItem({...newItem, cost_per_unit: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <Button
                onClick={() => addItemMutation.mutate(newItem)}
                disabled={!newItem.sku || !newItem.item_name || addItemMutation.isPending}
                className="w-full bg-blue-600"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transaction Dialog */}
        <Dialog open={showTransaction} onOpenChange={setShowTransaction}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Transaction</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="font-bold">{selectedItem.item_name}</p>
                  <p className="text-sm text-gray-600">Current: {selectedItem.quantity_on_hand} units</p>
                </div>

                <div>
                  <Label>Transaction Type</Label>
                  <Select
                    value={transaction.transaction_type}
                    onValueChange={(v) => setTransaction({...transaction, transaction_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receive">Receive (Add)</SelectItem>
                      <SelectItem value="issue">Issue (Remove)</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                      <SelectItem value="damage">Damage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={transaction.quantity}
                      onChange={(e) => setTransaction({...transaction, quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Unit Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={transaction.unit_cost}
                      onChange={(e) => setTransaction({...transaction, unit_cost: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => recordTransactionMutation.mutate({ item: selectedItem, txn: transaction })}
                  disabled={transaction.quantity <= 0 || recordTransactionMutation.isPending}
                  className="w-full bg-green-600"
                >
                  {recordTransactionMutation.isPending ? "Recording..." : "Record Transaction"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}