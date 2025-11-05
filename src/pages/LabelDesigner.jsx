import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tag, Plus, Eye, Download, Copy, Trash2, 
  Save, Palette, Layout, Image as ImageIcon 
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LabelDesigner() {
  const [labelName, setLabelName] = useState("");
  const [labelSize, setLabelSize] = useState("4x6");
  const [orientation, setOrientation] = useState("portrait");
  const [barcodeType, setBarcodeType] = useState("code128");
  const [barcodePosition, setBarcodePosition] = useState("bottom");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [fields, setFields] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);

  const queryClient = useQueryClient();

  const { data: labels } = useQuery({
    queryKey: ['customLabels'],
    queryFn: () => base44.entities.CustomLabel.list('-created_date'),
    initialData: [],
  });

  const createLabelMutation = useMutation({
    mutationFn: async (labelData) => {
      return await base44.entities.CustomLabel.create(labelData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customLabels'] });
      toast.success("Label template created!");
      resetForm();
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (labelId) => {
      await base44.entities.CustomLabel.delete(labelId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customLabels'] });
      toast.success("Label template deleted");
    },
  });

  const addField = () => {
    setFields([...fields, {
      field_name: `field_${fields.length + 1}`,
      field_type: "text",
      label: "New Field",
      font_size: 12,
      font_weight: "normal",
      position_x: 10,
      position_y: 10 + (fields.length * 30),
      width: 200,
      required: false
    }]);
  };

  const updateField = (index, key, value) => {
    const newFields = [...fields];
    newFields[index][key] = value;
    setFields(newFields);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveLabel = () => {
    if (!labelName) {
      toast.error("Please enter a label name");
      return;
    }

    createLabelMutation.mutate({
      business_id: "business_1",
      business_name: "My Business",
      label_name: labelName,
      label_size: labelSize,
      orientation: orientation,
      barcode_type: barcodeType,
      barcode_position: barcodePosition,
      include_logo: includeLogo,
      logo_url: logoUrl,
      fields: fields,
      template_json: {
        labelName,
        labelSize,
        orientation,
        barcodeType,
        barcodePosition,
        includeLogo,
        logoUrl,
        fields
      },
      is_active: true
    });
  };

  const resetForm = () => {
    setLabelName("");
    setFields([]);
    setLogoUrl("");
  };

  const duplicateLabel = (label) => {
    setLabelName(label.label_name + " (Copy)");
    setLabelSize(label.label_size);
    setOrientation(label.orientation);
    setBarcodeType(label.barcode_type);
    setBarcodePosition(label.barcode_position);
    setIncludeLogo(label.include_logo);
    setLogoUrl(label.logo_url || "");
    setFields(label.fields || []);
    toast.info("Label duplicated - edit and save");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Tag className="w-10 h-10 text-purple-600" />
            Label Designer
          </h1>
          <p className="text-gray-600">Create custom shipping labels for your business</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Designer Panel */}
          <Card className="border-2 border-purple-300">
            <CardHeader className="bg-purple-50">
              <CardTitle className="text-purple-900">Design Your Label</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Label Template Name</Label>
                <Input
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  placeholder="e.g., Standard Shipping Label"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Label Size</Label>
                  <Select value={labelSize} onValueChange={setLabelSize}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4x6">4" x 6"</SelectItem>
                      <SelectItem value="4x8">4" x 8"</SelectItem>
                      <SelectItem value="6x4">6" x 4"</SelectItem>
                      <SelectItem value="8x11">8.5" x 11"</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={setOrientation}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Barcode Type</Label>
                  <Select value={barcodeType} onValueChange={setBarcodeType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="code128">Code 128</SelectItem>
                      <SelectItem value="qr_code">QR Code</SelectItem>
                      <SelectItem value="datamatrix">Data Matrix</SelectItem>
                      <SelectItem value="ean13">EAN-13</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Barcode Position</Label>
                  <Select value={barcodePosition} onValueChange={setBarcodePosition}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeLogo"
                  checked={includeLogo}
                  onChange={(e) => setIncludeLogo(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="includeLogo" className="cursor-pointer">
                  Include Company Logo
                </Label>
              </div>

              {includeLogo && (
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="mt-1"
                  />
                </div>
              )}

              {/* Custom Fields */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-bold">Custom Fields</Label>
                  <Button onClick={addField} size="sm" className="bg-purple-600">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {fields.map((field, index) => (
                    <Card key={index} className="border-2 border-gray-200 p-3">
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Field name"
                            value={field.field_name}
                            onChange={(e) => updateField(index, 'field_name', e.target.value)}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Label"
                            value={field.label}
                            onChange={(e) => updateField(index, 'label', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={field.field_type}
                            onValueChange={(v) => updateField(index, 'field_type', v)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="barcode">Barcode</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => removeField(index)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSaveLabel}
                  disabled={createLabelMutation.isPending}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createLabelMutation.isPending ? "Saving..." : "Save Label Template"}
                </Button>
                <Button
                  onClick={() => setShowPreview(true)}
                  variant="outline"
                  className="border-2 border-purple-300"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Saved Labels */}
          <Card className="border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-blue-900">Saved Label Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {labels.length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No label templates yet</p>
                  <p className="text-sm text-gray-500 mt-2">Create your first custom label</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {labels.map((label) => (
                    <Card key={label.id} className="border-2 border-gray-200 hover:border-purple-300 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-bold text-gray-900">{label.label_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{label.label_size}</Badge>
                              <Badge variant="outline">{label.orientation}</Badge>
                              <Badge variant="outline">{label.barcode_type}</Badge>
                            </div>
                          </div>
                          {label.is_default && (
                            <Badge className="bg-purple-600">Default</Badge>
                          )}
                        </div>

                        {label.fields && label.fields.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600">
                              {label.fields.length} custom field{label.fields.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          <Button
                            onClick={() => duplicateLabel(label)}
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Duplicate
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedLabel(label);
                              setShowPreview(true);
                            }}
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            onClick={() => deleteLabelMutation.mutate(label.id)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Label Preview</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-white border-2 border-gray-300 rounded-lg">
              <div className="aspect-[4/6] bg-gray-50 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Layout className="w-16 h-16 mx-auto mb-4" />
                  <p>Label Preview</p>
                  <p className="text-sm mt-2">
                    {labelName || selectedLabel?.label_name || "Untitled Label"}
                  </p>
                  <p className="text-xs mt-1">
                    {labelSize} - {orientation}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}