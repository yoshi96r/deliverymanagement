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
  DollarSign, Plus, Receipt, Upload, CheckCircle2,
  Clock, XCircle, Calendar, TrendingUp, FileText
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DriverExpenses() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newExpense, setNewExpense] = useState({
    expense_type: "fuel",
    amount: "",
    expense_date: new Date().toISOString().split('T')[0],
    merchant_name: "",
    description: "",
    reimbursable: true
  });

  const queryClient = useQueryClient();

  // Get current user (driver)
  const driverEmail = "driver@example.com"; // In real app, get from auth
  const driverName = "Driver Name";

  const { data: expenses } = useQuery({
    queryKey: ['driverExpenses', driverEmail],
    queryFn: () => base44.entities.DriverExpense.filter({ driver_email: driverEmail }),
    initialData: [],
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData) => {
      return await base44.entities.DriverExpense.create({
        ...expenseData,
        driver_email: driverEmail,
        driver_name: driverName,
        reimbursement_status: expenseData.reimbursable ? "pending" : "not_applicable"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverExpenses'] });
      setShowAddDialog(false);
      setNewExpense({
        expense_type: "fuel",
        amount: "",
        expense_date: new Date().toISOString().split('T')[0],
        merchant_name: "",
        description: "",
        reimbursable: true
      });
      setSelectedFile(null);
      toast.success("Expense added successfully!");
    },
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      try {
        const result = await base44.integrations.Core.UploadFile({ file });
        setNewExpense({...newExpense, receipt_photo_url: result.file_url});
        setSelectedFile(file.name);
        toast.success("Receipt uploaded!");
      } catch (error) {
        toast.error("Failed to upload receipt");
      }
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!newExpense.amount || !newExpense.expense_date) {
      toast.error("Please fill in required fields");
      return;
    }
    createExpenseMutation.mutate(newExpense);
  };

  const monthExpenses = expenses.filter(e => {
    const expenseMonth = new Date(e.expense_date).getMonth();
    const currentMonth = new Date().getMonth();
    return expenseMonth === currentMonth;
  });

  const totalMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingReimbursement = expenses
    .filter(e => e.reimbursement_status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0);
  const approvedThisMonth = monthExpenses
    .filter(e => e.reimbursement_status === 'approved' || e.reimbursement_status === 'paid')
    .reduce((sum, e) => sum + (e.approved_amount || e.amount), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Receipt className="w-10 h-10 text-green-600" />
              My Expenses
            </h1>
            <p className="text-gray-600 mt-1">Track and submit expenses for reimbursement</p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-green-600 hover:bg-green-700 h-12"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Expense
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <DollarSign className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">${totalMonth.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Total This Month</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-200">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-yellow-600 mb-2" />
              <p className="text-3xl font-bold text-yellow-900">${pendingReimbursement.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Pending Approval</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">${approvedThisMonth.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Approved This Month</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <FileText className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-900">{monthExpenses.length}</p>
              <p className="text-sm text-gray-600">Expenses This Month</p>
            </CardContent>
          </Card>
        </div>

        {/* Expenses List */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No expenses yet</p>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  variant="outline"
                  className="mt-4"
                >
                  Add Your First Expense
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses
                  .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date))
                  .map((expense) => (
                    <Card key={expense.id} className="border-2 border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-gray-600">
                                {expense.expense_type.replace(/_/g, ' ')}
                              </Badge>
                              <Badge className={
                                expense.reimbursement_status === 'paid' ? 'bg-green-600' :
                                expense.reimbursement_status === 'approved' ? 'bg-blue-600' :
                                expense.reimbursement_status === 'pending' ? 'bg-yellow-600' :
                                expense.reimbursement_status === 'denied' ? 'bg-red-600' :
                                'bg-gray-600'
                              }>
                                {expense.reimbursement_status?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-gray-600">Amount</p>
                                <p className="font-bold text-gray-900">${expense.amount.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Date</p>
                                <p className="font-semibold text-gray-900">
                                  {format(new Date(expense.expense_date), "MMM d, yyyy")}
                                </p>
                              </div>
                              {expense.merchant_name && (
                                <div>
                                  <p className="text-gray-600">Merchant</p>
                                  <p className="font-semibold text-gray-900">{expense.merchant_name}</p>
                                </div>
                              )}
                              {expense.approved_amount && (
                                <div>
                                  <p className="text-gray-600">Approved</p>
                                  <p className="font-bold text-green-900">${expense.approved_amount.toFixed(2)}</p>
                                </div>
                              )}
                            </div>
                            {expense.description && (
                              <p className="text-sm text-gray-600 mt-2">{expense.description}</p>
                            )}
                          </div>
                          {expense.receipt_photo_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(expense.receipt_photo_url, '_blank')}
                            >
                              <Receipt className="w-4 h-4 mr-1" />
                              View Receipt
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Expense Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expense Type *</Label>
                  <Select
                    value={newExpense.expense_type}
                    onValueChange={(v) => setNewExpense({...newExpense, expense_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fuel">Fuel</SelectItem>
                      <SelectItem value="vehicle_maintenance">Vehicle Maintenance</SelectItem>
                      <SelectItem value="tolls">Tolls</SelectItem>
                      <SelectItem value="parking">Parking</SelectItem>
                      <SelectItem value="meals">Meals</SelectItem>
                      <SelectItem value="supplies">Supplies</SelectItem>
                      <SelectItem value="phone_data">Phone/Data</SelectItem>
                      <SelectItem value="vehicle_wash">Vehicle Wash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={newExpense.expense_date}
                    onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Merchant Name</Label>
                  <Input
                    value={newExpense.merchant_name}
                    onChange={(e) => setNewExpense({...newExpense, merchant_name: e.target.value})}
                    placeholder="Shell, Walmart, etc."
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Description/Notes</Label>
                <Textarea
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="Add any additional details..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label>Receipt Photo</Label>
                <div className="mt-1">
                  <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="text-center">
                      {uploading ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      ) : selectedFile ? (
                        <>
                          <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                          <p className="text-sm text-gray-600">{selectedFile}</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload receipt</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAddDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createExpenseMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {createExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}