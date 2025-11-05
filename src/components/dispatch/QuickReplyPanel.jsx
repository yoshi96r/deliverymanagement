import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, Plus, Search, Star, Edit, Trash2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuickReplyPanel({ onSelectTemplate, driverName, trackingNumber }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    template_name: "",
    category: "general_support",
    template_text: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: async () => {
      const allTemplates = await base44.entities.MessageTemplate.filter({
        is_active: true
      });
      return allTemplates.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
    },
    initialData: [],
  });

  const createTemplateMutation = useMutation({
    mutationFn: (templateData) => base44.entities.MessageTemplate.create(templateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
      setShowCreateDialog(false);
      setNewTemplate({
        template_name: "",
        category: "general_support",
        template_text: ""
      });
      toast.success("Template created!");
    },
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        await base44.entities.MessageTemplate.update(templateId, {
          usage_count: (template.usage_count || 0) + 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
    },
  });

  const handleSelectTemplate = (template) => {
    // Replace placeholders with actual values
    let message = template.template_text;
    if (driverName) {
      message = message.replace(/{driver_name}/g, driverName);
    }
    if (trackingNumber) {
      message = message.replace(/{tracking_number}/g, trackingNumber);
    }
    message = message.replace(/{time}/g, new Date().toLocaleTimeString());
    
    useTemplateMutation.mutate(template.id);
    onSelectTemplate(message);
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.template_name || !newTemplate.template_text) {
      toast.error("Please provide template name and text");
      return;
    }

    createTemplateMutation.mutate({
      ...newTemplate,
      created_by: "Dispatcher",
      quick_reply: true,
      is_active: true,
      usage_count: 0
    });
  };

  const filteredTemplates = templates.filter(t =>
    (selectedCategory === "all" || t.category === selectedCategory) &&
    (t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     t.template_text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = [
    { value: "all", label: "All Templates" },
    { value: "exception_response", label: "Exception Response" },
    { value: "route_guidance", label: "Route Guidance" },
    { value: "safety_reminder", label: "Safety Reminder" },
    { value: "delivery_instructions", label: "Delivery Instructions" },
    { value: "customer_contact", label: "Customer Contact" },
    { value: "weather_alert", label: "Weather Alert" },
    { value: "general_support", label: "General Support" }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-900">Quick Replies</h3>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          size="sm"
          variant="outline"
          className="border-purple-300 text-purple-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Template
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-8 text-sm"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-4">
          No templates found. Create one to get started!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-gray-900">{template.template_name}</p>
                <div className="flex items-center gap-2">
                  {template.usage_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {template.usage_count} uses
                    </Badge>
                  )}
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    {template.category.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">
                {template.template_text}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Quick Reply Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                value={newTemplate.template_name}
                onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
                placeholder="e.g., Customer Unavailable Response"
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={newTemplate.category}
                onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.value !== "all").map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="templateText">Message Template *</Label>
              <Textarea
                id="templateText"
                value={newTemplate.template_text}
                onChange={(e) => setNewTemplate({ ...newTemplate, template_text: e.target.value })}
                placeholder="Message text... Use {driver_name} and {tracking_number} as placeholders"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                Available placeholders: {"{driver_name}"}, {"{tracking_number}"}, {"{time}"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTemplate}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Create Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}