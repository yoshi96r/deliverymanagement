import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Navigation, MapPin, ArrowRight, CheckCircle2, Play,
  Pause, AlertTriangle, Camera, Volume2, Info, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function FollowRecordedRoute() {
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [following, setFollowing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [stopsCompleted, setStopsCompleted] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [deviationWarnings, setDeviationWarnings] = useState([]);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(true);

  const watchIdRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const queryClient = useQueryClient();

  const { data: availableRoutes } = useQuery({
    queryKey: ['availableRoutes'],
    queryFn: () => base44.entities.GPSRouteTrace.filter({ is_active: true }),
    initialData: [],
  });

  const { data: routeStops } = useQuery({
    queryKey: ['routeStops', selectedRouteId],
    queryFn: () => base44.entities.RouteStopPoint.filter({ 
      route_trace_id: selectedRouteId 
    }),
    enabled: !!selectedRouteId,
    initialData: [],
  });

  const selectedRoute = availableRoutes.find(r => r.id === selectedRouteId);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, []);

  const speak = (text) => {
    if (voiceGuidanceEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      synthRef.current.speak(utterance);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const startFollowingMutation = useMutation({
    mutationFn: async () => {
      const session = await base44.entities.RouteFollowSession.create({
        route_trace_id: selectedRouteId,
        follower_email: "sub@usps.com", // Get from auth
        follower_name: "Substitute Carrier",
        session_date: new Date().toISOString().split('T')[0],
        started_at: new Date().toISOString(),
        status: "in_progress",
        current_stop_index: 0,
        gps_tracking_enabled: true
      });
      
      return session;
    },
    onSuccess: (session) => {
      setSessionId(session.id);
      setFollowing(true);
      setStartTime(new Date());
      
      // Start GPS tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(newLocation);

          // Check if approaching next stop
          const nextStop = sortedStops[currentStopIndex];
          if (nextStop) {
            const distanceToStop = calculateDistance(
              newLocation.lat,
              newLocation.lng,
              nextStop.gps_lat,
              nextStop.gps_lng
            );

            // Within 500 feet (0.095 miles)
            if (distanceToStop < 0.095 && distanceToStop > 0.01) {
              speak(`Approaching ${nextStop.stop_name || nextStop.mailbox_number}. ${nextStop.side_of_road} side.`);
            }

            // Check for deviation from route
            if (selectedRoute?.gps_breadcrumbs) {
              const closestPoint = findClosestPoint(newLocation, selectedRoute.gps_breadcrumbs);
              if (closestPoint.distance > 0.1) { // More than 0.1 miles off
                const warning = {
                  timestamp: new Date().toISOString(),
                  distance: closestPoint.distance,
                  location: newLocation
                };
                setDeviationWarnings(prev => [...prev, warning]);
              }
            }
          }
        },
        (error) => console.error("GPS error:", error),
        { enableHighAccuracy: true, maximumAge: 0 }
      );

      speak(`Starting route ${selectedRoute.route_name}. ${routeStops.length} stops on route.`);
      toast.success("Following route - GPS guidance active!");
    }
  });

  const findClosestPoint = (currentLoc, breadcrumbs) => {
    let minDist = Infinity;
    let closestPoint = null;

    breadcrumbs.forEach(point => {
      const dist = calculateDistance(
        currentLoc.lat,
        currentLoc.lng,
        point.lat,
        point.lng
      );
      if (dist < minDist) {
        minDist = dist;
        closestPoint = point;
      }
    });

    return { point: closestPoint, distance: minDist };
  };

  const markStopComplete = async () => {
    setStopsCompleted([...stopsCompleted, currentStopIndex]);
    const nextIndex = currentStopIndex + 1;
    
    if (nextIndex < sortedStops.length) {
      setCurrentStopIndex(nextIndex);
      const nextStop = sortedStops[nextIndex];
      speak(`Next stop: ${nextStop.stop_name || nextStop.mailbox_number}`);
    } else {
      // Route complete
      await base44.entities.RouteFollowSession.update(sessionId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        stops_completed: stopsCompleted.length + 1
      });
      
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      
      speak("Route complete! All stops delivered.");
      toast.success("Route completed! Great job!");
      setFollowing(false);
    }
  };

  const sortedStops = routeStops.sort((a, b) => a.stop_sequence - b.stop_sequence);
  const currentStop = sortedStops[currentStopIndex];
  const nextStop = sortedStops[currentStopIndex + 1];
  const progress = sortedStops.length > 0 
    ? ((stopsCompleted.length / sortedStops.length) * 100) 
    : 0;

  const distanceToCurrentStop = currentStop && currentLocation
    ? calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        currentStop.gps_lat,
        currentStop.gps_lng
      )
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Navigation className="w-10 h-10 text-blue-600" />
            Follow GPS Route
          </h1>
          <p className="text-gray-600">Turn-by-turn guidance for substitute carriers</p>
        </div>

        {/* Route Selection */}
        {!following && (
          <Card className="border-2 border-blue-300 mb-6">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600">
              <CardTitle className="text-white">Select Route to Follow</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-white">Available Routes</Label>
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue placeholder="Choose a route..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.route_name} - {route.total_stops} stops, {route.total_distance_miles?.toFixed(1)} mi
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRoute && (
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Regular Carrier</p>
                        <p className="font-semibold">{selectedRoute.carrier_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Recorded</p>
                        <p className="font-semibold">
                          {format(new Date(selectedRoute.recording_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Stops</p>
                        <p className="font-bold text-green-900">{selectedRoute.total_stops}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Distance</p>
                        <p className="font-bold text-green-900">
                          {selectedRoute.total_distance_miles?.toFixed(1)} mi
                        </p>
                      </div>
                    </div>
                    {selectedRoute.average_sub_rating && (
                      <Badge className="bg-yellow-500">
                        ⭐ {selectedRoute.average_sub_rating.toFixed(1)}/5 rated by subs
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="voice"
                  checked={voiceGuidanceEnabled}
                  onChange={(e) => setVoiceGuidanceEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="voice" className="cursor-pointer flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Enable voice guidance
                </Label>
              </div>

              <Button
                onClick={() => startFollowingMutation.mutate()}
                disabled={!selectedRouteId || !currentLocation || startFollowingMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-semibold"
              >
                <Play className="w-6 h-6 mr-2" />
                Start Following Route
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Navigation */}
        {following && currentStop && (
          <div className="space-y-4">
            {/* Progress */}
            <Card className="border-2 border-green-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">Route Progress</p>
                  <Badge className="bg-green-600">
                    {stopsCompleted.length}/{sortedStops.length} Stops
                  </Badge>
                </div>
                <Progress value={progress} className="h-3" />
                <p className="text-sm text-gray-600 mt-2">
                  {Math.round(progress)}% Complete
                </p>
              </CardContent>
            </Card>

            {/* Current Stop */}
            <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader className="bg-blue-600">
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="w-6 h-6" />
                  CURRENT STOP #{currentStop.stop_sequence}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentStop.stop_name || currentStop.mailbox_number || "Stop " + currentStop.stop_sequence}
                  </h3>
                  {currentStop.physical_address && (
                    <p className="text-gray-700 mb-2">{currentStop.physical_address}</p>
                  )}
                  {currentStop.mailbox_number && (
                    <Badge>Box #{currentStop.mailbox_number}</Badge>
                  )}
                </div>

                {distanceToCurrentStop !== null && (
                  <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300 mb-4">
                    <p className="text-3xl font-bold text-green-900 text-center">
                      {distanceToCurrentStop < 0.1 
                        ? `${Math.round(distanceToCurrentStop * 5280)} feet`
                        : `${distanceToCurrentStop.toFixed(2)} miles`}
                    </p>
                    <p className="text-center text-green-700 font-semibold">Distance to Stop</p>
                  </div>
                )}

                {/* Instructions */}
                {currentStop.delivery_instructions && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">📝 Instructions:</p>
                    <p className="text-sm text-blue-800">{currentStop.delivery_instructions}</p>
                  </div>
                )}

                {/* Side & Warnings */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-orange-50 rounded border border-orange-200">
                    <p className="text-xs text-gray-600">Side of Road</p>
                    <p className="font-bold text-orange-900 capitalize">
                      {currentStop.side_of_road} Side
                    </p>
                  </div>
                  {currentStop.hazard_warnings && currentStop.hazard_warnings.length > 0 && (
                    <div className="p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-xs text-gray-600">⚠️ Warning</p>
                      <p className="font-bold text-red-900 text-sm">
                        {currentStop.hazard_warnings[0]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Photo */}
                {currentStop.photo_url && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      <Camera className="w-4 h-4 inline mr-1" />
                      Stop Photo:
                    </p>
                    <img
                      src={currentStop.photo_url}
                      alt="Stop location"
                      className="w-full rounded-lg border-2 border-gray-200"
                    />
                  </div>
                )}

                <Button
                  onClick={markStopComplete}
                  className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg font-semibold"
                >
                  <CheckCircle2 className="w-6 h-6 mr-2" />
                  Mark Complete & Continue
                </Button>
              </CardContent>
            </Card>

            {/* Next Stop Preview */}
            {nextStop && (
              <Card className="border-2 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <ArrowRight className="w-6 h-6 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Next Stop</p>
                      <p className="font-bold text-gray-900">
                        {nextStop.stop_name || nextStop.mailbox_number || `Stop ${nextStop.stop_sequence}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deviation Warning */}
            {deviationWarnings.length > 0 && (
              <Card className="border-2 border-yellow-300 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-700" />
                    <div>
                      <p className="font-bold text-yellow-900">Off Recorded Route</p>
                      <p className="text-sm text-yellow-800">
                        You may be deviating from the regular carrier's path
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Available Routes List */}
        {!following && !selectedRouteId && (
          <div className="space-y-3">
            {availableRoutes.map((route) => (
              <Card 
                key={route.id}
                className="border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-all"
                onClick={() => setSelectedRouteId(route.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-lg mb-1">{route.route_name}</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Regular Carrier: {route.carrier_name}
                      </p>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Stops</p>
                          <p className="font-bold text-blue-900">{route.total_stops}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Distance</p>
                          <p className="font-bold text-blue-900">{route.total_distance_miles?.toFixed(1)} mi</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Duration</p>
                          <p className="font-bold text-blue-900">{route.total_duration_minutes} min</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Used</p>
                          <p className="font-bold text-blue-900">{route.times_followed_by_subs || 0}×</p>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}