import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, CheckCircle2, XCircle, Clock, TrendingUp, 
  AlertTriangle, Navigation, User, Zap
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";

export default function AISuggestionsDashboard() {
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [filterBy, setFilterBy] = useState("all");
  const queryClient = useQueryClient();

  const { data: allSuggestions } = useQuery({
    queryKey: ['aiRouteSuggestions'],
    queryFn: async () => {
      const mods = await base44.entities.RouteModification.filter({
        status: ['pending_driver_review', 'pending_dispatcher_approval', 'driver_accepted']
      });
      return mods.sort((a, b) => {
        // Sort by confidence score, then by time saved
        if (b.ai_confidence !== a.ai_confidence) {
          return b.ai_confidence - a.ai_confidence;
        }
        return (b.time_saved_minutes || 0) - (a.time_saved_minutes || 0);
      });
    },
    initialData: [],
    refetchInterval: 15000,
  });

  const { data: deliveries } = useQuery({
    queryKey: ['allDeliveries'],
    queryFn: () => base44.entities.DeliveryRequest.list(),
    initialData: [],
  });

  const approveAllHighConfidenceMutation = useMutation({
    mutationFn: async () => {
      const highConfidence = allSuggestions.filter(s => 
        s.ai_confidence >= 85 &&
        s.status === 'pending_dispatcher_approval'
      );

      for (const suggestion of highConfidence) {
        await base44.entities.RouteModification.update(suggestion.id, {
          status: 'dispatcher_approved',
          dispatcher_reviewed_by: 'Dispatcher (Batch)',
          dispatcher_reviewed_at: new Date().toISOString(),
          dispatcher_notes: 'Auto-approved: High AI confidence (>=85%)',
          applied_at: new Date().toISOString()
        });

        // Update route
        await base44.entities.OptimizedRoute.update(suggestion.route_id, {
          delivery_ids: suggestion.modified_sequence,
          optimized_sequence: suggestion.modified_sequence.map((id, idx) => ({
            delivery_id: id,
            sequence_number: idx + 1
          }))
        });

        // Notify driver
        await base44.entities.DispatchMessage.create({
          message_type: 'route_update',
          from_dispatcher: 'AI System',
          to_driver: suggestion.driver_email,
          driver_name: suggestion.driver_name,
          subject: 'AI Route Optimization Applied',
          message_text: `Your route has been automatically optimized by our AI system.\n\nReason: ${suggestion.ai_reasoning}\n\nTime saved: ${suggestion.time_saved_minutes} minutes\nConfidence: ${suggestion.ai_confidence}%`,
          priority: 'high',
          sent_at: new Date().toISOString()
        });
      }

      return highConfidence.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['aiRouteSuggestions'] });
      toast.success(`Auto-approved ${count} high-confidence suggestions!`);
    },
  });

  const approveSuggestionMutation = useMutation({
    mutationFn: async (suggestionId) => {
      const suggestion = allSuggestions.find(s => s.id === suggestionId);
      
      await base44.entities.RouteModification.update(suggestionId, {
        status: 'dispatcher_approved',
        dispatcher_reviewed_by: 'Dispatcher',
        dispatcher_reviewed_at: new Date().toISOString(),
        dispatcher_notes: 'Manually approved',
        applied_at: new Date().toISOString()
      });

      // Update route
      await base44.entities.OptimizedRoute.update(suggestion.route_id, {
        delivery_ids: suggestion.modified_sequence,
        optimized_sequence: suggestion.modified_sequence.map((id, idx) => ({
          delivery_id: id,
          sequence_number: idx + 1
        }))
      });

      // Notify driver
      await base44.entities.DispatchMessage.create({
        message_type: 'route_update',
        from_dispatcher: 'Dispatch',
        to_driver: suggestion.driver_email,
        driver_name: suggestion.driver_name,
        subject: 'Route Updated',
        message_text: `Your route has been updated based on AI optimization.\n\n${suggestion.ai_reasoning}`,
        priority: 'high',
        sent_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRouteSuggestions'] });
      toast.success("Suggestion approved and applied!");
      setSelectedSuggestion(null);
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async ({ suggestionId, reason }) => {
      await base44.entities.RouteModification.update(suggestionId, {
        status: 'dispatcher_rejected',
        dispatcher_reviewed_by: 'Dispatcher',
        dispatcher_reviewed_at: new Date().toISOString(),
        dispatcher_notes: reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRouteSuggestions'] });
      toast.success("Suggestion rejected");
      setSelectedSuggestion(null);
    },
  });

  const filteredSuggestions = allSuggestions.filter(s => {
    if (filterBy === "all") return true;
    if (filterBy === "high_confidence") return s.ai_confidence >= 80;
    if (filterBy === "high_impact") return Math.abs(s.time_saved_minutes) >= 10;
    if (filterBy === "needs_approval") return s.status === 'pending_dispatcher_approval';
    return true;
  });

  const getConfidenceColor = (confidence) => {
    if (confidence >= 90) return "text-green-600 bg-green-50";
    if (confidence >= 75) return "text-blue-600 bg-blue-50";
    if (confidence >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-orange-600 bg-orange-50";
  };

  const getImpactColor = (minutes) => {
    const abs = Math.abs(minutes);
    if (abs >= 20) return "text-green-600";
    if (abs >= 10) return "text-blue-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-4">
      {/* Header with Batch Actions */}
      <Card className="border-2 border-purple-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              <div>
                <h3 className="font-bold text-gray-900 text-lg">AI Route Suggestions</h3>
                <p className="text-sm text-gray-600">
                  {allSuggestions.length} active suggestions • {allSuggestions.filter(s => s.ai_confidence >= 85).length} high confidence
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => approveAllHighConfidenceMutation.mutate()}
              disabled={allSuggestions.filter(s => s.ai_confidence >= 85 && s.status === 'pending_dispatcher_approval').length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Auto-Approve High Confidence (≥85%)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <Tabs value={filterBy} onValueChange={setFilterBy}>
        <TabsList className="grid w-full grid-cols-4 bg-white">
          <TabsTrigger value="all">
            All ({allSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="high_confidence">
            High Confidence ({allSuggestions.filter(s => s.ai_confidence >= 80).length})
          </TabsTrigger>
          <TabsTrigger value="high_impact">
            High Impact ({allSuggestions.filter(s => Math.abs(s.time_saved_minutes) >= 10).length})
          </TabsTrigger>
          <TabsTrigger value="needs_approval">
            Needs Approval ({allSuggestions.filter(s => s.status === 'pending_dispatcher_approval').length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 text-lg">No AI suggestions in this category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSuggestions.map((suggestion) => {
            const isSelected = selectedSuggestion?.id === suggestion.id;
            const minutesAgo = differenceInMinutes(new Date(), new Date(suggestion.suggested_at));

            return (
              <Card
                key={suggestion.id}
                className={`border-2 cursor-pointer transition-all ${
                  isSelected ? 'border-purple-400 bg-purple-50 shadow-lg' :
                  suggestion.ai_confidence >= 85 ? 'border-green-300 bg-green-50' :
                  'border-gray-200'
                }`}
                onClick={() => setSelectedSuggestion(isSelected ? null : suggestion)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-600" />
                      <div>
                        <CardTitle className="text-sm">{suggestion.driver_name}</CardTitle>
                        <p className="text-xs text-gray-600">{minutesAgo}m ago</p>
                      </div>
                    </div>
                    <Badge className={
                      suggestion.status === 'pending_dispatcher_approval' ? 'bg-orange-600' :
                      suggestion.status === 'driver_accepted' ? 'bg-blue-600' :
                      'bg-purple-600'
                    }>
                      {suggestion.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Modification Type */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {suggestion.modification_type.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.trigger_reason.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {/* Confidence Score */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">AI Confidence</span>
                      <span className={`text-sm font-bold ${getConfidenceColor(suggestion.ai_confidence)}`}>
                        {suggestion.ai_confidence}%
                      </span>
                    </div>
                    <Progress value={suggestion.ai_confidence} className="h-2" />
                  </div>

                  {/* Impact Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded border border-gray-200 text-center">
                      <Clock className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                      <p className={`text-lg font-bold ${getImpactColor(suggestion.time_saved_minutes)}`}>
                        {suggestion.time_saved_minutes > 0 ? '-' : '+'}{Math.abs(suggestion.time_saved_minutes)}m
                      </p>
                      <p className="text-xs text-gray-600">Time Impact</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-gray-200 text-center">
                      <Navigation className="w-4 h-4 mx-auto text-purple-600 mb-1" />
                      <p className="text-lg font-bold text-purple-900">
                        {suggestion.affected_deliveries?.length || 0}
                      </p>
                      <p className="text-xs text-gray-600">Stops Affected</p>
                    </div>
                  </div>

                  {/* AI Reasoning Preview */}
                  <div className="p-2 bg-purple-50 rounded border border-purple-200">
                    <p className="text-xs text-purple-900 line-clamp-2">
                      {suggestion.ai_reasoning}
                    </p>
                  </div>

                  {/* Expanded View */}
                  {isSelected && (
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      {/* Full Reasoning */}
                      <div className="p-3 bg-white rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-900 mb-2">Full AI Analysis:</p>
                        <p className="text-sm text-gray-800">{suggestion.ai_reasoning}</p>
                      </div>

                      {/* Trigger Details */}
                      <div className="p-2 bg-gray-50 rounded">
                        <p className="text-xs font-semibold text-gray-900 mb-1">Trigger:</p>
                        <p className="text-xs text-gray-700">{suggestion.trigger_details}</p>
                      </div>

                      {/* Driver Feedback if exists */}
                      {suggestion.driver_feedback && (
                        <div className="p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900 mb-1">Driver Feedback:</p>
                          <p className="text-xs text-blue-800">{suggestion.driver_feedback}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {suggestion.status === 'pending_dispatcher_approval' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              const reason = prompt("Reason for rejection:");
                              if (reason) {
                                rejectSuggestionMutation.mutate({ 
                                  suggestionId: suggestion.id, 
                                  reason 
                                });
                              }
                            }}
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-700"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              approveSuggestionMutation.mutate(suggestion.id);
                            }}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Impact Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <TrendingUp className="w-6 h-6 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">
                {allSuggestions.reduce((sum, s) => sum + (s.time_saved_minutes || 0), 0)}
              </p>
              <p className="text-xs text-gray-600">Total Minutes Saved</p>
            </div>

            <div className="text-center p-3 bg-white rounded-lg">
              <Brain className="w-6 h-6 mx-auto text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-purple-900">
                {allSuggestions.length > 0 
                  ? Math.round(allSuggestions.reduce((sum, s) => sum + s.ai_confidence, 0) / allSuggestions.length)
                  : 0}%
              </p>
              <p className="text-xs text-gray-600">Avg Confidence</p>
            </div>

            <div className="text-center p-3 bg-white rounded-lg">
              <CheckCircle2 className="w-6 h-6 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">
                {allSuggestions.filter(s => s.ai_confidence >= 85).length}
              </p>
              <p className="text-xs text-gray-600">High Confidence (≥85%)</p>
            </div>

            <div className="text-center p-3 bg-white rounded-lg">
              <Zap className="w-6 h-6 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-900">
                {allSuggestions.filter(s => Math.abs(s.time_saved_minutes) >= 10).length}
              </p>
              <p className="text-xs text-gray-600">High Impact (≥10m)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}