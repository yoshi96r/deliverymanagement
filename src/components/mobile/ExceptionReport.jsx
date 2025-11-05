
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"; // Added Alert and AlertDescription
import {
  AlertTriangle, Camera, X, CheckCircle2, MapPin, Phone, MessageSquare,
  Home, Package, Navigation as Nav, Clock
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { autoAssignException } from "../dispatch/AutoAssignmentEngine";

const exceptionTypes = [
  {
    value: "customer_unavailable",
    label: "Customer Unavailable",
    category: "delivery_attempt",
    severity: "medium",
    icon: Home,
    requiresReattempt: true,
    notifyCustomer: true
  },
  {
    value: "incorrect_address",
    label: "Incorrect/Incomplete Address",
    category: "address_issue",
    severity: "high",
    icon: MapPin,
    requiresSenderAction: true,
    notifySender: true
  },
  {
    value: "damaged_package",
    label: "Package Damaged",
    category: "package_issue",
    severity: "critical",
    icon: Package,
    notifySender: true,
    notifyCustomer: true
  },
  {
    value: "access_issue",
    label: "Cannot Access Location",
    category: "access_issue",
    severity: "medium",
    icon: Nav,
    requiresCustomerAction: true,
    notifyCustomer: true
  },
  {
    value: "business_closed",
    label: "Business Closed",
    category: "delivery_attempt",
    severity: "low",
    icon: Clock,
    requiresReattempt: true
  },
  {
    value: "refused_delivery",
    label: "Customer Refused Delivery",
    category: "delivery_attempt",
    severity: "high",
    icon: X,
    notifySender: true
  },
  {
    value: "weather_delay",
    label: "Weather/Road Conditions",
    category: "other",
    severity: "medium",
    icon: AlertTriangle,
    notifyCustomer: true
  },
  {
    value: "requires_id",
    label: "ID Required (Not Available)",
    category: "delivery_attempt",
    severity: "medium",
    icon: AlertTriangle,
    requiresCustomerAction: true,
    notifyCustomer: true
  },
  {
    value: "vehicle_issue",
    label: "Vehicle Issue",
    category: "other",
    severity: "high",
    icon: AlertTriangle
  },
  {
    value: "other",
    label: "Other Issue",
    category: "other",
    severity: "medium",
    icon: AlertTriangle
  }
];

const contactMethods = [
  { value: "phone", label: "📞 Called Customer" },
  { value: "text", label: "💬 Sent Text Message" },
  { value: "door_knock", label: "🚪 Knocked on Door" },
  { value: "left_note", label: "📝 Left Note" },
  { value: "none", label: "❌ No Contact Attempted" }
];

export default function ExceptionReport({ delivery, location, onComplete, onCancel }) {
  const [exceptionType, setExceptionType] = useState("");
  const [description, setDescription] = useState("");
  const [attemptedActions, setAttemptedActions] = useState("");
  const [photoUrls, setPhotoUrls] = useState([]);
  const [customerContacted, setCustomerContacted] = useState(false);
  const [contactMethod, setContactMethod] = useState("none");
  const [customerResponse, setCustomerResponse] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(delivery.customer_phone || "");
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [submittedExceptionId, setSubmittedExceptionId] = useState(null);

  const selectedType = exceptionTypes.find(e => e.value === exceptionType);
  const Icon = selectedType?.icon || AlertTriangle;

  const getAISuggestions = async (type, desc, attemptedActs) => {
    if (!type) return;

    setLoadingAI(true);
    setAiSuggestions(null); // Clear previous suggestions
    try {
      const prompt = `You are an expert delivery operations assistant. Analyze this delivery exception and provide actionable resolution steps.

Exception Details:
- Type: ${type}
- Description: ${desc || 'Not provided yet'}
- Actions Attempted: ${attemptedActs || 'None yet'}
- Customer: ${delivery.customer_name}
- Address: ${delivery.delivery_address}
- Package Value: $${delivery.package_value}
- Insurance: ${delivery.insurance_tier || 'none'}

Provide:
1. Immediate Actions (2-3 specific steps the driver should take right now)
2. Follow-up Actions (what should happen next)
3. Customer Communication (what to say if contacting customer)
4. Resolution Timeline (estimated time to resolve)
5. Escalation Trigger (when to escalate to supervisor)

Be specific, practical, and consider the driver's current situation at the delivery location.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            immediate_actions: {
              type: "array",
              items: { type: "string" },
              description: "2-3 immediate steps driver should take now"
            },
            follow_up_actions: {
              type: "array",
              items: { type: "string" },
              description: "Next steps after immediate actions"
            },
            customer_communication: {
              type: "object",
              properties: {
                suggested_message: { type: "string" },
                key_questions: { type: "array", items: { type: "string" } }
              }
            },
            resolution_timeline: { type: "string" },
            escalation_trigger: { type: "string" },
            special_notes: { type: "string" }
          },
          required: ["immediate_actions", "resolution_timeline", "escalation_trigger"] // Mark required fields
        }
      });

      setAiSuggestions(response);
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast.error("Could not generate AI suggestions");
      setAiSuggestions(null); // Clear suggestions on error
    }
    setLoadingAI(false);
  };

  useEffect(() => {
    if (exceptionType) {
      getAISuggestions(exceptionType, description, attemptedActions);
    } else {
      setAiSuggestions(null); // Clear suggestions if no type is selected
    }
  }, [exceptionType, description, attemptedActions]); // Re-run if description or attempted actions change

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Could not access camera");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    // Add location and timestamp overlay
    if (location) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, canvas.height - 80, canvas.width - 20, 70);
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.fillText(`Exception: ${selectedType?.label || 'Unknown'}`, 20, canvas.height - 55);
      ctx.fillText(`GPS: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`, 20, canvas.height - 35);
      ctx.fillText(`Time: ${new Date().toLocaleString()}`, 20, canvas.height - 15);
    }

    setUploading(true);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `exception-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotoUrls([...photoUrls, file_url]);
        toast.success("Exception photo captured!");
        stopCamera();
      } catch (error) {
        toast.error("Failed to upload photo");
      }
      setUploading(false);
    }, 'image/jpeg', 0.9);
  };

  const removePhoto = (index) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const handleEscalate = async () => {
    if (!escalationReason) {
      toast.error("Please provide a reason for escalation");
      return;
    }

    if (!submittedExceptionId) {
      toast.error("Exception must be submitted before escalating");
      return;
    }

    try {
      // Get the exception that was just submitted
      const exceptions = await base44.entities.DeliveryException.filter({
        id: submittedExceptionId
      });
      
      if (exceptions.length === 0) {
        toast.error("Exception not found");
        return;
      }

      const exception = exceptions[0];

      // Update exception with escalation details
      await base44.entities.DeliveryException.update(submittedExceptionId, {
        escalated: true,
        escalated_at: new Date().toISOString(),
        escalated_by: delivery.carrier_name || 'Driver',
        escalation_reason: escalationReason,
        resolution_status: 'escalated',
      });

      // Use auto-assignment engine
      const assignmentResult = await autoAssignException(
        { ...exception, escalation_reason: escalationReason },
        delivery
      );

      toast.success(
        `Exception auto-assigned to ${assignmentResult.dispatcher.full_name} (${assignmentResult.team} team) with ${assignmentResult.priority} priority!`,
        { duration: 5000 }
      );
      
      setShowEscalateDialog(false);
      onComplete({ id: submittedExceptionId, escalated: true });
    } catch (error) {
      console.error("Escalation error:", error);
      toast.error("Failed to escalate exception");
    }
  };

  const handleSubmit = async () => {
    if (!exceptionType) {
      toast.error("Please select an exception type");
      return;
    }

    if (!description) {
      toast.error("Please provide a description");
      return;
    }

    if (customerContacted && contactMethod !== "none" && !customerResponse) {
      toast.error("Please note the customer's response");
      return;
    }

    try {
      // Create exception record
      const exception = await base44.entities.DeliveryException.create({
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        exception_type: exceptionType,
        exception_category: selectedType.category,
        severity: selectedType.severity,
        reported_by: delivery.carrier_name || 'Driver',
        reported_by_email: delivery.carrier_email,
        timestamp: new Date().toISOString(),
        location: location ? `${location.lat},${location.lng}` : undefined,
        description,
        attempted_actions: attemptedActions,
        photo_urls: photoUrls,
        customer_contacted: customerContacted,
        customer_contact_method: contactMethod,
        customer_response: customerResponse,
        customer_phone_called: contactMethod === 'phone' ? phoneNumber : undefined,
        requires_sender_action: selectedType.requiresSenderAction || false,
        requires_customer_action: selectedType.requiresCustomerAction || false,
        resolution_status: selectedType.requiresReattempt ? 'reattempt_scheduled' : 'pending',
        internal_notes: aiSuggestions ? JSON.stringify(aiSuggestions) : undefined, // Added AI suggestions as internal notes
        escalated: false, // Initial state, not escalated yet
      });

      // Store exception ID for potential escalation
      setSubmittedExceptionId(exception.id);

      // Update delivery status
      await base44.entities.DeliveryRequest.update(delivery.id, {
        status: 'exception',
        has_active_exception: true, // Added
        exception_count: (delivery.exception_count || 0) + 1, // Added
      });

      // Record location tracking
      await base44.entities.LocationTracking.create({
        tracking_number: delivery.tracking_number,
        delivery_request_id: delivery.id,
        timestamp: new Date().toISOString(),
        location_type: 'hand_carry',
        action: 'exception_reported',
        scanned_by: delivery.carrier_name || 'Driver',
        notes: `Exception: ${selectedType.label} - ${description}`,
        photo_url: photoUrls[0],
      });

      // Create dispatch notification for dashboard
      await base44.entities.DispatchNotification.create({
        exception_id: exception.id,
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        notification_type: 'dashboard_alert',
        priority: selectedType.severity,
        sent_to: 'dispatch_dashboard',
        sent_at: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
      });

      const notifications = [];

      // Email to customer
      if (selectedType.notifyCustomer && delivery.customer_email) {
        notifications.push(
          base44.integrations.Core.SendEmail({
            to: delivery.customer_email,
            subject: `Delivery Update: ${delivery.tracking_number}`,
            body: `Hello ${delivery.customer_name},\n\nWe encountered an issue with your delivery:\n\nIssue: ${selectedType.label}\nDetails: ${description}\n\n${attemptedActions ? `Actions Taken: ${attemptedActions}\n\n` : ''}${customerResponse ? `Your Response: ${customerResponse}\n\n` : ''}${aiSuggestions?.customer_communication?.suggested_message ? `\nNext Steps:\n${aiSuggestions.customer_communication.suggested_message}\n\n` : ''}We will ${selectedType.requiresReattempt ? 'attempt delivery again soon' : 'work to resolve this issue'}.\n\nTracking: ${delivery.tracking_number}\n\nThank you,\nUSPS Delivery Team`,
            from_name: 'USPS Delivery'
          })
        );
      }

      // Email to sender
      if (selectedType.notifySender && delivery.sender_business_name) {
        const aiInsights = aiSuggestions ? `\n\nAI Analysis:\n${aiSuggestions.special_notes || 'Automated resolution suggestions available in dashboard'}\nEstimated Resolution: ${aiSuggestions.resolution_timeline}` : '';

        notifications.push(
          base44.integrations.Core.SendEmail({
            to: delivery.carrier_email,
            subject: `Delivery Exception Alert: ${delivery.tracking_number}`,
            body: `Business: ${delivery.sender_business_name},\n\nA delivery exception has been reported:\n\nCustomer: ${delivery.customer_name}\nAddress: ${delivery.delivery_address}\nException: ${selectedType.label}\nDetails: ${description}\n\n${attemptedActions ? `Driver Actions: ${attemptedActions}\n\n` : ''}Status: ${exception.resolution_status}${aiInsights}\n\nTracking: ${delivery.tracking_number}`,
            from_name: 'USPS Exception Notification'
          })
        );
      }

      // DISPATCH NOTIFICATION EMAIL - Comprehensive details
      const dispatchEmail = "dispatch@usps.com"; // This could be from config
      const dispatchPhone = "+1234567890"; // This could be from config

      const dispatchEmailBody = `🚨 DELIVERY EXCEPTION ALERT 🚨

PRIORITY: ${selectedType.severity.toUpperCase()}
Reported: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXCEPTION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: ${selectedType.label}
Category: ${selectedType.category.replace(/_/g, ' ')}
Tracking: ${delivery.tracking_number}

Description:
${description}

${attemptedActions ? `Driver Actions Taken:\n${attemptedActions}\n\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRIVER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: ${delivery.carrier_name || 'Unknown'}
Email: ${delivery.carrier_email || 'Not provided'}
${location ? `GPS Location: ${location.lat}, ${location.lng}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: ${delivery.customer_name}
Address: ${delivery.delivery_address}
Phone: ${delivery.customer_phone || 'Not provided'}
Email: ${delivery.customer_email || 'Not provided'}

${customerContacted ? `\nCustomer Contact Attempt:
Method: ${contactMethod?.replace(/_/g, ' ')}
${customerResponse ? `Response: ${customerResponse}` : 'No response received'}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACKAGE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Value: $${delivery.package_value || 'Unknown'}
Weight: ${delivery.package_weight || 'Unknown'} lbs
Insurance: ${delivery.insurance_tier || 'none'}
${delivery.sender_business_name ? `Sender: ${delivery.sender_business_name}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI RESOLUTION SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${aiSuggestions ? `
Immediate Actions Required:
${aiSuggestions.immediate_actions?.map((action, i) => `${i + 1}. ${action}`).join('\n') || 'None'}

Estimated Resolution Time: ${aiSuggestions.resolution_timeline || 'Unknown'}

Escalate If: ${aiSuggestions.escalation_trigger || 'Contact supervisor'}

${aiSuggestions.special_notes ? `\nSpecial Notes: ${aiSuggestions.special_notes}` : ''}
` : 'AI analysis not available'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${selectedType.requiresReattempt ? '✓ Reattempt delivery required' : ''}
${selectedType.requiresSenderAction ? '✓ Sender action needed' : ''}
${selectedType.requiresCustomerAction ? '✓ Customer action needed' : ''}

View full details in Dispatch Dashboard:
https://app.usps.com/dispatch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${photoUrls.length > 0 ? `📸 ${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''} attached to exception report` : ''}

This is an automated notification. Please acknowledge in the dispatch dashboard.`;

      notifications.push(
        base44.integrations.Core.SendEmail({
          to: dispatchEmail,
          subject: `${selectedType.severity === 'critical' ? '🚨 CRITICAL' : selectedType.severity === 'high' ? '⚠️ HIGH PRIORITY' : '📋'} Exception: ${selectedType.label} - ${delivery.tracking_number}`,
          body: dispatchEmailBody,
          from_name: 'USPS Exception System'
        })
      );

      // Create email notification record
      await base44.entities.DispatchNotification.create({
        exception_id: exception.id,
        delivery_request_id: delivery.id,
        tracking_number: delivery.tracking_number,
        notification_type: 'email',
        priority: selectedType.severity,
        sent_to: dispatchEmail,
        sent_at: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
      });

      // SMS for CRITICAL exceptions only
      if (selectedType.severity === 'critical') {
        // Note: SMS would require Twilio or similar service integration
        // For now, we'll create a notification record
        await base44.entities.DispatchNotification.create({
          exception_id: exception.id,
          delivery_request_id: delivery.id,
          tracking_number: delivery.tracking_number,
          notification_type: 'sms',
          priority: 'critical',
          sent_to: dispatchPhone,
          sent_at: new Date().toISOString(),
          acknowledged: false,
          resolved: false,
        });

        // In a real implementation, you would send SMS here:
        // await sendSMS(dispatchPhone, `CRITICAL EXCEPTION: ${selectedType.label} - ${delivery.tracking_number}. Check dispatch dashboard immediately.`);

        toast.warning("Critical exception - Dispatch notified via SMS!");
      }

      // Wait for all email notifications
      await Promise.all(notifications);

      // Update exception record with notification status
      await base44.entities.DeliveryException.update(exception.id, {
        dispatch_notified: true,
        sender_notified: selectedType.notifySender || false,
        customer_notified: selectedType.notifyCustomer || false,
        notification_sent_at: new Date().toISOString(),
      });

      toast.success("Exception reported! You can now escalate if needed."); // Modified toast message
      
      // Show escalation option after successful submission
      setTimeout(() => {
        setShowEscalateDialog(true);
      }, 1000);
      
    } catch (error) {
      toast.error("Failed to submit exception report");
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Package Info */}
      <Card className="border-red-300 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-900 mb-1">{delivery.customer_name}</p>
              <p className="font-mono text-xs text-red-700 mb-2">{delivery.tracking_number}</p>
              <div className="flex items-start gap-2 text-sm text-red-800">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{delivery.delivery_address}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPS Info */}
      {location && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-1">📍 Current Location</p>
          <p className="text-xs text-blue-700 font-mono">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      )}

      {/* Exception Type */}
      <div>
        <Label htmlFor="exception_type" className="text-base font-bold">
          What's the issue? *
        </Label>
        <Select value={exceptionType} onValueChange={setExceptionType}>
          <SelectTrigger className="mt-2 h-12 text-base border-2">
            <SelectValue placeholder="Select exception type" />
          </SelectTrigger>
          <SelectContent>
            {exceptionTypes.map((type) => {
              const TypeIcon = type.icon;
              return (
                <SelectItem key={type.value} value={type.value} className="py-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="w-4 h-4" />
                    <span>{type.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedType && (
        <div className={`p-3 rounded-lg border-2 ${
          selectedType.severity === 'critical' ? 'bg-red-50 border-red-300' :
          selectedType.severity === 'high' ? 'bg-orange-50 border-orange-300' :
          'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-start gap-2">
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              selectedType.severity === 'critical' ? 'text-red-600' :
              selectedType.severity === 'high' ? 'text-orange-600' :
              'text-yellow-600'
            }`} />
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 mb-1">Selected: ${selectedType.label}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {selectedType.category.replace(/_/g, ' ')}
                </Badge>
                {selectedType.requiresReattempt && (
                  <Badge className="bg-blue-500 text-white text-xs">Reattempt Required</Badge>
                )}
                {selectedType.notifyCustomer && (
                  <Badge className="bg-purple-500 text-white text-xs">Customer Notified</Badge>
                )}
                {selectedType.notifySender && (
                  <Badge className="bg-green-500 text-white text-xs">Sender Notified</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <Label htmlFor="description" className="text-base font-bold">
          Describe the issue *
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide specific details about what happened..."
          rows={4}
          className="mt-2 text-base"
        />
      </div>

      {/* Actions Attempted */}
      <div>
        <Label htmlFor="actions" className="text-base font-bold">
          What did you try?
        </Label>
        <Textarea
          id="actions"
          value={attemptedActions}
          onChange={(e) => setAttemptedActions(e.target.value)}
          placeholder="E.g., Knocked on door 3 times, called phone number, checked with neighbor..."
          rows={3}
          className="mt-2 text-base"
        />
      </div>

      {/* AI Suggestions Card */}
      {loadingAI && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm font-semibold text-blue-900">AI analyzing exception and generating resolution steps...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {aiSuggestions && !loadingAI && (
        <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-blue-50">
          <CardHeader className="pb-3 bg-green-100 border-b-2 border-green-300">
            <CardTitle className="text-green-900 text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              AI-Powered Resolution Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Immediate Actions */}
            {aiSuggestions.immediate_actions && aiSuggestions.immediate_actions.length > 0 && (
              <div>
                <p className="text-sm font-bold text-gray-900 mb-2">🚨 Do This Now:</p>
                <ul className="space-y-2">
                  {aiSuggestions.immediate_actions?.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="text-gray-800">${action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Customer Communication */}
            {aiSuggestions.customer_communication && aiSuggestions.customer_communication.suggested_message && (
              <div className="p-3 bg-white rounded-lg border-2 border-blue-200">
                <p className="text-sm font-bold text-blue-900 mb-2">💬 If Contacting Customer:</p>
                <p className="text-sm text-blue-800 mb-2 italic">
                  "${aiSuggestions.customer_communication.suggested_message}"
                </p>
                {aiSuggestions.customer_communication.key_questions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">Key Questions:</p>
                    <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                      {aiSuggestions.customer_communication.key_questions.map((q, idx) => (
                        <li key={idx}>${q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Timeline & Escalation */}
            <div className="grid grid-cols-2 gap-3">
              {aiSuggestions.resolution_timeline && (
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-1">⏱ Timeline:</p>
                  <p className="text-sm font-bold text-gray-900">${aiSuggestions.resolution_timeline}</p>
                </div>
              )}
              {aiSuggestions.escalation_trigger && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">⚠ Escalate If:</p>
                  <p className="text-xs text-yellow-800">${aiSuggestions.escalation_trigger}</p>
                </div>
              )}
            </div>

            {/* Follow-up Actions */}
            {aiSuggestions.follow_up_actions?.length > 0 && (
              <div>
                <p className="text-sm font-bold text-gray-900 mb-2">📋 Follow-Up Required:</p>
                <ul className="space-y-1">
                  {aiSuggestions.follow_up_actions.map((action, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span className="text-gray-700">${action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiSuggestions.special_notes && (
              <Alert className="border-purple-300 bg-purple-50">
                <AlertDescription className="text-purple-900 text-sm">
                  <strong className="font-bold">💡 Note:</strong> ${aiSuggestions.special_notes}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Contact */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Customer Communication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="customer_contacted"
              checked={customerContacted}
              onChange={(e) => setCustomerContacted(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-2 rounded"
            />
            <label htmlFor="customer_contacted" className="text-sm font-semibold">
              I attempted to contact the customer
            </label>
          </div>

          {customerContacted && (
            <>
              <div>
                <Label htmlFor="contact_method">Contact Method</Label>
                <Select value={contactMethod} onValueChange={setContactMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contactMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {contactMethod === 'phone' && (
                <div>
                  <Label htmlFor="phone">Phone Number Called</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="mt-1"
                  />
                </div>
              )}

              {contactMethod !== 'none' && (
                <div>
                  <Label htmlFor="response">Customer Response *</Label>
                  <Textarea
                    id="response"
                    value={customerResponse}
                    onChange={(e) => setCustomerResponse(e.target.value)}
                    placeholder="What did the customer say or do?"
                    rows={2}
                    className="mt-1"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Photo Documentation */}
      <div>
        <Label className="text-base font-bold mb-2 block">
          Photo Evidence (Recommended)
        </Label>

        {!showCamera && (
          <Button
            onClick={startCamera}
            variant="outline"
            className="w-full h-16 border-2 border-dashed border-blue-300"
          >
            <Camera className="w-6 h-6 mr-2" />
            Take Photo of Issue
          </Button>
        )}

        {showCamera && (
          <div className="space-y-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg border-2 border-blue-300"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={stopCamera} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={capturePhoto}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Camera className="w-4 h-4 mr-2" />
                {uploading ? "Saving..." : "Capture"}
              </Button>
            </div>
          </div>
        )}

        {photoUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {photoUrls.map((url, index) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Exception ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border-2 border-green-300"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => removePhoto(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <Button
          onClick={onCancel}
          variant="outline"
          className="h-12"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!exceptionType || !description || uploading}
          className="h-12 bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          <AlertTriangle className="w-5 h-5 mr-2" />
          Report Exception
        </Button>
      </div>

      {/* Escalation Dialog - Shows after exception is submitted */}
      {showEscalateDialog && submittedExceptionId && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardHeader className="pb-3 bg-red-100 border-b-2 border-red-300">
            <CardTitle className="text-red-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Need Immediate Dispatch Support?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="p-3 bg-white rounded-lg border border-red-200">
              <p className="text-sm text-gray-900 mb-2">
                <strong>Escalate this exception</strong> if you've exhausted all available options and need immediate dispatcher intervention.
              </p>
              <p className="text-xs text-gray-600">
                Escalation will assign this to a specialized team for urgent resolution and notify management.
              </p>
            </div>

            <div>
              <Label htmlFor="escalation_reason" className="text-sm font-bold text-red-900">
                Why does this need escalation? *
              </Label>
              <Textarea
                id="escalation_reason"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="e.g., Customer is threatening to refuse package, address is completely wrong and customer unreachable, severe safety concern..."
                rows={3}
                className="mt-2 border-red-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => {
                  setShowEscalateDialog(false);
                  onComplete({ id: submittedExceptionId });
                }}
                variant="outline"
                className="border-gray-300"
              >
                Skip - Not Needed
              </Button>
              <Button
                onClick={handleEscalate}
                disabled={!escalationReason}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Escalate to Dispatch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
