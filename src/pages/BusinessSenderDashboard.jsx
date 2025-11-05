import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle2, AlertTriangle, Camera, Shield, MapPin, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BusinessSenderDashboard() {
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showCheckpointsDialog, setShowCheckpointsDialog] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [showExceptionsDialog, setShowExceptionsDialog] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAIAnalysis, setLoadingAIAnalysis] = useState(false);

  const queryClient = useQueryClient();

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['businessDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list('-created_date'),
    initialData: [],
  });

  const { data: checkpoints } = useQuery({
    queryKey: ['allCheckpoints'],
    queryFn: () => base44.entities.DeliveryCheckpoint.list('-timestamp'),
    initialData: [],
  });

  const { data: exceptions } = useQuery({
    queryKey: ['deliveryExceptions'],
    queryFn: () => base44.entities.DeliveryException.list('-timestamp'),
    initialData: [],
  });

  const totalDeliveries = deliveries.length;
  const inTransit = deliveries.filter(d => ['signed', 'at_facility', 'in_bin', 'on_truck', 'out_for_delivery', 'in_transit'].includes(d.status)).length;
  const delivered = deliveries.filter(d => d.status === 'delivered').length;
  const damagedCount = deliveries.filter(d => d.damage_reported).length;
  const exceptionCount = deliveries.filter(d => d.has_active_exception).length;

  const viewCheckpoints = (delivery) => {
    setSelectedDelivery(delivery);
    setShowCheckpointsDialog(true);
  };

  const viewProof = (delivery) => {
    setSelectedDelivery(delivery);
    setShowProofDialog(true);
  };

  const viewExceptions = (delivery) => {
    setSelectedDelivery(delivery);
    setShowExceptionsDialog(true);
  };

  const analyzeExceptionWithAI = async (exception, delivery) => {
    setLoadingAIAnalysis(true);
    try {
      const prompt = `You are an expert logistics analyst. Analyze this delivery exception and provide business insights and action recommendations.

Delivery Details:
- Tracking: ${delivery.tracking_number}
- Customer: ${delivery.customer_name}
- Address: ${delivery.delivery_address}
- Package Value: $${delivery.package_value}
- Insurance: ${delivery.insurance_tier}

Exception Details:
- Type: ${exception.exception_type}
- Severity: ${exception.severity}
- Description: ${exception.description}
- Driver Actions: ${exception.attempted_actions || 'None'}
- Customer Contacted: ${exception.customer_contacted ? 'Yes - ' + exception.customer_contact_method : 'No'}
- Customer Response: ${exception.customer_response || 'N/A'}
- Status: ${exception.resolution_status}

Provide:
1. Root Cause Analysis (what likely caused this issue)
2. Recommended Business Actions (what the sender should do)
3. Customer Service Script (exact message to send to customer)
4. Prevention Strategy (how to avoid this in future shipments)
5. Cost Impact (potential costs or delays)
6. Claim Process (if damage claim needed, what steps to take)

Be specific about actions the business should take and provide ready-to-use customer communication templates.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            root_cause: {
              type: "object",
              properties: {
                primary_cause: { type: "string" },
                contributing_factors: { type: "array", items: { type: "string" } }
              }
            },
            business_actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  priority: { type: "string", enum: ["immediate", "high", "medium", "low"] },
                  responsible_party: { type: "string" }
                }
              }
            },
            customer_service_script: {
              type: "object",
              properties: {
                subject: { type: "string" },
                message: { type: "string" },
                tone: { type: "string" }
              }
            },
            prevention_strategy: {
              type: "array",
              items: { type: "string" }
            },
            cost_impact: {
              type: "object",
              properties: {
                estimated_delay: { type: "string" },
                potential_refund: { type: "string" },
                additional_costs: { type: "string" }
              }
            },
            claim_process: {
              type: "object",
              properties: {
                claim_needed: { type: "boolean" },
                claim_type: { type: "string" },
                required_documentation: { type: "array", items: { type: "string" } },
                next_steps: { type: "array", items: { type: "string" } }
              }
            },
            overall_recommendation: { type: "string" }
          }
        }
      });

      setAiAnalysis({ exception, delivery, analysis: response });
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Could not generate AI analysis");
    }
    setLoadingAIAnalysis(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-2">Business Sender Dashboard</h1>
          <p className="text-blue-600">Track your shipments with premium verification</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <Card className="border-2 border-blue-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Shipments</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{totalDeliveries}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">In Transit</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">{inTransit}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Delivered</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{delivered}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Damaged</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{damagedCount}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Exceptions</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{exceptionCount}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-100 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Premium</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">
                    {deliveries.filter(d => d.has_premium_insurance).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Premium Verification Pricing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-sm font-bold text-blue-900 mb-2">Basic Verification</p>
                <p className="text-2xl font-bold text-blue-700 mb-2">$1.50</p>
                <p className="text-xs text-blue-600">3 checkpoints + delivery proof</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
                <p className="text-sm font-bold text-purple-900 mb-2">Premium Verification</p>
                <p className="text-2xl font-bold text-purple-700 mb-2">$5.00</p>
                <p className="text-xs text-purple-600">7+ checkpoints + GPS tracking</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <p className="text-sm font-bold text-yellow-900 mb-2">Platinum Verification</p>
                <p className="text-2xl font-bold text-yellow-700 mb-2">$10.00</p>
                <p className="text-xs text-yellow-600">Real-time tracking + priority handling</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {exceptionCount > 0 && (
          <Card className="mb-8 border-2 border-orange-300 bg-orange-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-8 h-8 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-orange-900 mb-2">
                    {exceptionCount} Active Delivery Exception{exceptionCount > 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-orange-800">
                    Some deliveries require attention. Review exceptions below to take appropriate action.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {damagedCount > 0 && (
          <Card className="mb-8 border-2 border-red-300 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-red-900 mb-2">
                    {damagedCount} Package{damagedCount > 1 ? 's' : ''} Damaged
                  </h3>
                  <p className="text-sm text-red-800 mb-2">
                    Damage was reported during transit. Review damage details and photos below.
                  </p>
                  <p className="text-xs text-red-700">
                    Note: Packages damaged due to improper packaging may not be eligible for refund.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Your Deliveries</h2>
          {isLoading ? (
            <p className="text-blue-600">Loading deliveries...</p>
          ) : deliveries.length === 0 ? (
            <Card className="border-2 border-dashed border-blue-200">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto text-blue-300 mb-4" />
                <p className="text-blue-600 text-lg">No deliveries yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {deliveries.map((delivery) => {
                const deliveryCheckpoints = checkpoints.filter(
                  c => c.delivery_request_id === delivery.id
                ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                const deliveryExceptions = exceptions.filter(
                  e => e.delivery_request_id === delivery.id
                ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                return (
                  <Card 
                    key={delivery.id} 
                    className={`border-2 hover:shadow-lg transition-all ${
                      delivery.has_active_exception ? 'border-orange-300 bg-orange-50' :
                      delivery.damage_reported ? 'border-red-300 bg-red-50' :
                      delivery.has_premium_insurance ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-100'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-mono text-2xl font-bold text-blue-900">{delivery.tracking_number}</p>
                              <p className="text-gray-600">{delivery.customer_name}</p>
                            </div>
                            <Badge className={
                              delivery.status === 'delivered' ? 'bg-green-600' :
                              delivery.status === 'out_for_delivery' ? 'bg-blue-600' :
                              delivery.status === 'exception' ? 'bg-orange-600' :
                              delivery.damage_reported ? 'bg-red-600' :
                              'bg-yellow-600'
                            }>
                              {delivery.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          {delivery.has_active_exception && deliveryExceptions.length > 0 && (
                            <div className="p-3 bg-orange-100 rounded-lg border-2 border-orange-300">
                              <p className="text-sm font-bold text-orange-900 mb-1 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Active Exception: {deliveryExceptions[0].exception_type.replace(/_/g, ' ')}
                              </p>
                              <p className="text-sm text-orange-800">{deliveryExceptions[0].description}</p>
                              <p className="text-xs text-orange-700 mt-1">
                                Status: {deliveryExceptions[0].resolution_status.replace(/_/g, ' ')}
                              </p>
                            </div>
                          )}

                          {delivery.damage_reported && (
                            <div className="p-3 bg-red-100 rounded-lg border-2 border-red-300">
                              <p className="text-sm font-bold text-red-900 mb-1">⚠️ Damage Reported</p>
                              <p className="text-sm text-red-800">{delivery.damage_description}</p>
                              <p className="text-xs text-red-700 mt-1">Stage: {delivery.damage_stage}</p>
                            </div>
                          )}

                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-semibold text-gray-900 mb-2">Checkpoint Timeline</p>
                            {deliveryCheckpoints.length === 0 ? (
                              <p className="text-xs text-gray-500">No checkpoints yet</p>
                            ) : (
                              <div className="space-y-2">
                                {deliveryCheckpoints.slice(0, 3).map((checkpoint) => (
                                  <div key={checkpoint.id} className="flex items-start gap-2 text-xs">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-900">
                                        {checkpoint.checkpoint_location} - {checkpoint.checkpoint_type}
                                      </p>
                                      <p className="text-gray-600">
                                        {format(new Date(checkpoint.timestamp), "MMM d 'at' h:mm a")}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Checkpoints</p>
                              <p className="font-bold text-blue-900">
                                {delivery.checkpoints_completed}/{delivery.total_checkpoints}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Carrier</p>
                              <p className="font-bold text-gray-900">{delivery.carrier_name || 'Unassigned'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Insurance</p>
                              <p className="font-bold text-purple-900">{delivery.insurance_tier || 'None'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Payment</p>
                              <p className="font-bold text-green-900">${delivery.total_carrier_payment?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>

                          <div className="flex gap-3 flex-wrap">
                            {deliveryExceptions.length > 0 && (
                              <Button
                                onClick={() => viewExceptions(delivery)}
                                variant="outline"
                                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                View Exceptions ({deliveryExceptions.length})
                              </Button>
                            )}
                            {deliveryCheckpoints.length > 0 && (
                              <Button
                                onClick={() => viewCheckpoints(delivery)}
                                variant="outline"
                                className="border-blue-300 text-blue-700"
                              >
                                <MapPin className="w-4 h-4 mr-2" />
                                View All Checkpoints
                              </Button>
                            )}
                            {delivery.status === 'delivered' && (
                              <Button
                                onClick={() => viewProof(delivery)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Camera className="w-4 h-4 mr-2" />
                                View Delivery Proof
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="md:w-64 space-y-2">
                          {delivery.package_photo_url && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Package Photo</p>
                              <img 
                                src={delivery.package_photo_url} 
                                alt="Package" 
                                className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                              />
                            </div>
                          )}
                          {delivery.delivery_proof_photo_url && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Delivery Proof</p>
                              <img 
                                src={delivery.delivery_proof_photo_url} 
                                alt="Delivery Proof" 
                                className="w-full h-32 object-cover rounded-lg border-2 border-green-300"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCheckpointsDialog} onOpenChange={setShowCheckpointsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-blue-900">Delivery Checkpoints</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <div className="space-y-4">
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-blue-900">{selectedDelivery.tracking_number}</p>
                      <p className="text-sm text-blue-700">{selectedDelivery.customer_name}</p>
                    </div>
                    <Badge className="bg-blue-500 text-white">
                      {selectedDelivery.checkpoints_completed}/{selectedDelivery.total_checkpoints} Completed
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {checkpoints
                .filter(c => c.delivery_request_id === selectedDelivery.id)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((checkpoint, index) => (
                  <Card key={checkpoint.id} className="border-2 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-gray-900">{checkpoint.checkpoint_location}</h3>
                            <span className="text-sm text-gray-600">
                              {format(new Date(checkpoint.timestamp), "MMM d 'at' h:mm a")}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                            <div>
                              <p className="text-gray-600">Type:</p>
                              <p className="font-semibold">{checkpoint.checkpoint_type}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Verified by:</p>
                              <p className="font-semibold">{checkpoint.verified_by}</p>
                            </div>
                          </div>
                          {checkpoint.notes && (
                            <p className="text-sm text-gray-700 mt-2">{checkpoint.notes}</p>
                          )}
                          {checkpoint.photo_url && (
                            <img 
                              src={checkpoint.photo_url} 
                              alt={`Checkpoint at ${checkpoint.checkpoint_location}`}
                              className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 mt-2"
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-green-900">Delivery Proof</DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <div className="space-y-4">
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <p className="font-mono font-bold text-green-900">{selectedDelivery.tracking_number}</p>
                  <p className="text-sm text-green-700">Delivered to {selectedDelivery.customer_name}</p>
                  {selectedDelivery.delivery_timestamp && (
                    <p className="text-sm text-green-700">
                      {format(new Date(selectedDelivery.delivery_timestamp), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </CardContent>
              </Card>

              {selectedDelivery.delivery_proof_photo_url && (
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-2">Delivery Photo</p>
                  <img 
                    src={selectedDelivery.delivery_proof_photo_url} 
                    alt="Delivery Proof"
                    className="w-full rounded-lg border-2 border-green-300"
                  />
                </div>
              )}

              {selectedDelivery.delivery_proof_video_url && (
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-2">Delivery Video</p>
                  <video 
                    src={selectedDelivery.delivery_proof_video_url} 
                    controls
                    className="w-full rounded-lg border-2 border-green-300"
                  />
                </div>
              )}

              {selectedDelivery.signature_data && (
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-2">Customer Signature</p>
                  <img 
                    src={selectedDelivery.signature_data} 
                    alt="Signature"
                    className="w-full h-32 object-contain bg-white rounded-lg border-2 border-gray-300"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showExceptionsDialog} onOpenChange={setShowExceptionsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-orange-900">Delivery Exceptions with AI Analysis</DialogTitle>
          </DialogHeader>
          
          {selectedDelivery && (
            <div className="space-y-6">
              <Card className="border-2 border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-orange-900">{selectedDelivery.tracking_number}</p>
                      <p className="text-sm text-orange-700">{selectedDelivery.customer_name}</p>
                    </div>
                    <Badge className="bg-orange-500 text-white">
                      {selectedDelivery.exception_count || 0} Exception{(selectedDelivery.exception_count || 0) !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {aiAnalysis && aiAnalysis.exception && (
                <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
                  <CardHeader className="bg-purple-100 border-b-2 border-purple-300">
                    <CardTitle className="text-purple-900 flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6" />
                      AI Business Intelligence Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        🔍 Root Cause Analysis
                      </h4>
                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 mb-2">
                          {aiAnalysis.analysis.root_cause?.primary_cause}
                        </p>
                        {aiAnalysis.analysis.root_cause?.contributing_factors?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Contributing Factors:</p>
                            <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                              {aiAnalysis.analysis.root_cause.contributing_factors.map((factor, idx) => (
                                <li key={idx}>{factor}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        ✅ Recommended Actions
                      </h4>
                      <div className="space-y-2">
                        {aiAnalysis.analysis.business_actions?.map((action, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-lg border-2 ${
                              action.priority === 'immediate' ? 'bg-red-50 border-red-300' :
                              action.priority === 'high' ? 'bg-orange-50 border-orange-300' :
                              action.priority === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                              'bg-blue-50 border-blue-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Badge className={
                                action.priority === 'immediate' ? 'bg-red-600' :
                                action.priority === 'high' ? 'bg-orange-600' :
                                action.priority === 'medium' ? 'bg-yellow-600' :
                                'bg-blue-600'
                              }>
                                {action.priority}
                              </Badge>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{action.action}</p>
                                <p className="text-xs text-gray-600 mt-1">Responsible: {action.responsible_party}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {aiAnalysis.analysis.customer_service_script && (
                      <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                        <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                          💬 Ready-to-Send Customer Message
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-blue-700 mb-1">Subject Line:</p>
                            <p className="text-sm font-semibold text-blue-900 p-2 bg-white rounded border border-blue-200">
                              {aiAnalysis.analysis.customer_service_script.subject}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-blue-700 mb-1">Message:</p>
                            <div className="text-sm text-blue-900 p-3 bg-white rounded border border-blue-200 whitespace-pre-wrap">
                              {aiAnalysis.analysis.customer_service_script.message}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Tone: {aiAnalysis.analysis.customer_service_script.tone}
                            </Badge>
                            <Button 
                              size="sm"
                              className="ml-auto bg-blue-600 hover:bg-blue-700"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `Subject: ${aiAnalysis.analysis.customer_service_script.subject}\n\n${aiAnalysis.analysis.customer_service_script.message}`
                                );
                                toast.success("Message copied to clipboard!");
                              }}
                            >
                              Copy Message
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {aiAnalysis.analysis.claim_process?.claim_needed && (
                      <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                        <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                          📋 Insurance Claim Process
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Badge className="bg-yellow-600 text-white mb-2">
                              {aiAnalysis.analysis.claim_process.claim_type}
                            </Badge>
                            <p className="text-sm text-yellow-900 mb-3">
                              Claim Required - Follow these steps:
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-yellow-800 mb-2">Required Documentation:</p>
                            <ul className="text-sm text-yellow-900 space-y-1 ml-4 list-disc">
                              {aiAnalysis.analysis.claim_process.required_documentation?.map((doc, idx) => (
                                <li key={idx}>{doc}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-yellow-800 mb-2">Next Steps:</p>
                            <ol className="text-sm text-yellow-900 space-y-2 ml-4 list-decimal">
                              {aiAnalysis.analysis.claim_process.next_steps?.map((step, idx) => (
                                <li key={idx} className="pl-2">{step}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          💰 Cost Impact
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-600">Estimated Delay:</p>
                            <p className="font-semibold text-gray-900">
                              {aiAnalysis.analysis.cost_impact?.estimated_delay}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Potential Refund:</p>
                            <p className="font-semibold text-orange-700">
                              {aiAnalysis.analysis.cost_impact?.potential_refund}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Additional Costs:</p>
                            <p className="font-semibold text-red-700">
                              {aiAnalysis.analysis.cost_impact?.additional_costs}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                        <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                          🛡️ Prevention Strategy
                        </h4>
                        <ul className="text-sm text-green-800 space-y-2 list-disc ml-4">
                          {aiAnalysis.analysis.prevention_strategy?.map((strategy, idx) => (
                            <li key={idx}>{strategy}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Alert className="border-2 border-purple-300 bg-purple-50">
                      <AlertDescription className="text-purple-900">
                        <strong className="font-bold">💡 AI Recommendation:</strong>
                        <p className="mt-1">{aiAnalysis.analysis.overall_recommendation}</p>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {exceptions
                  .filter(e => e.delivery_request_id === selectedDelivery.id)
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map((exception) => (
                    <Card 
                      key={exception.id} 
                      className={`border-2 ${
                        exception.severity === 'critical' ? 'border-red-300 bg-red-50' :
                        exception.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                        'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                            exception.severity === 'critical' ? 'bg-red-200' :
                            exception.severity === 'high' ? 'bg-orange-200' :
                            'bg-yellow-200'
                          }`}>
                            <AlertTriangle className={`w-6 h-6 ${
                              exception.severity === 'critical' ? 'text-red-700' :
                              exception.severity === 'high' ? 'text-orange-700' :
                              'text-yellow-700'
                            }`} />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <h3 className="font-bold text-gray-900">
                                {exception.exception_type.replace(/_/g, ' ').toUpperCase()}
                              </h3>
                              <span className="text-sm text-gray-600">
                                {format(new Date(exception.timestamp), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                              <div>
                                <p className="text-gray-600">Reported by:</p>
                                <p className="font-semibold">{exception.reported_by}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Status:</p>
                                <Badge variant="outline">
                                  {exception.resolution_status.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                            </div>

                            <div className="p-3 bg-white rounded-lg border border-gray-200 mb-3">
                              <p className="text-sm font-bold text-gray-900 mb-1">Description:</p>
                              <p className="text-sm text-gray-700">{exception.description}</p>
                            </div>

                            {exception.attempted_actions && (
                              <div className="p-3 bg-white rounded-lg border border-gray-200 mb-3">
                                <p className="text-sm font-bold text-gray-900 mb-1">Driver Actions:</p>
                                <p className="text-sm text-gray-700">{exception.attempted_actions}</p>
                              </div>
                            )}

                            {exception.customer_contacted && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                                <p className="text-sm font-bold text-blue-900 mb-1">Customer Communication:</p>
                                <p className="text-sm text-blue-800">
                                  Method: {exception.customer_contact_method?.replace(/_/g, ' ')}
                                </p>
                                {exception.customer_response && (
                                  <p className="text-sm text-blue-800 mt-1">
                                    Response: {exception.customer_response}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2 flex-wrap text-xs">
                              {exception.customer_notified && (
                                <Badge className="bg-purple-500 text-white">Customer Notified</Badge>
                              )}
                              {exception.sender_notified && (
                                <Badge className="bg-green-500 text-white">You Were Notified</Badge>
                              )}
                              {exception.dispatch_notified && (
                                <Badge className="bg-blue-500 text-white">Dispatch Notified</Badge>
                              )}
                              {exception.requires_sender_action && (
                                <Badge className="bg-red-500 text-white">Action Required</Badge>
                              )}
                            </div>

                            {exception.photo_urls && exception.photo_urls.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-bold text-gray-900 mb-2">Photos:</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {exception.photo_urls.map((url, i) => (
                                    <img 
                                      key={i}
                                      src={url} 
                                      alt={`Exception photo ${i + 1}`}
                                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-400"
                                      onClick={() => window.open(url, '_blank')}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t-2 border-gray-200">
                          <Button
                            onClick={() => analyzeExceptionWithAI(exception, selectedDelivery)}
                            disabled={loadingAIAnalysis}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                          >
                            {loadingAIAnalysis ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Analyzing with AI...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Get AI Business Intelligence
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}