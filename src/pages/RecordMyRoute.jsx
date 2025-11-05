import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Navigation, MapPin, Circle, Square, Camera, Mic,
  Play, Pause, Save, Plus, AlertTriangle, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RecordMyRoute() {
  const [recording, setRecording] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeNumber, setRouteNumber] = useState("");
  const [gpsPoints, setGpsPoints] = useState([]);
  const [stops, setStops] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [distance, setDistance] = useState(0);
  const [showAddStopDialog, setShowAddStopDialog] = useState(false);
  
  const [newStop, setNewStop] = useState({
    stop_type: "mailbox",
    is_permanent: true,
    stop_name: "",
    physical_address: "",
    mailbox_number: "",
    delivery_instructions: "",
    side_of_road: "right"
  });

  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: myRoutes } = useQuery({
    queryKey: ['myRecordedRoutes'],
    queryFn: () => base44.entities.GPSRouteTrace.list('-recording_date', 20),
    initialData: [],
  });

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

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const startRecording = () => {
    if (!routeName || !currentLocation) {
      toast.error("Please enter route name and ensure GPS is active");
      return;
    }

    setRecording(true);
    setStartTime(new Date());
    setGpsPoints([]);
    setDistance(0);
    lastPointRef.current = null;

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPoint = {
          timestamp: new Date().toISOString(),
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed_mph: position.coords.speed ? (position.coords.speed * 2.237) : 0, // Convert m/s to mph
          heading: position.coords.heading || 0,
          accuracy_meters: position.coords.accuracy
        };

        setGpsPoints(prev => [...prev, newPoint]);
        setCurrentLocation({ lat: newPoint.lat, lng: newPoint.lng });

        // Calculate distance
        if (lastPointRef.current) {
          const dist = calculateDistance(
            lastPointRef.current.lat,
            lastPointRef.current.lng,
            newPoint.lat,
            newPoint.lng
          );
          setDistance(prev => prev + dist);
        }
        lastPointRef.current = newPoint;
      },
      (error) => {
        console.error("GPS error:", error);
        toast.error("GPS tracking error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    toast.success("Route recording started!");
  };

  const pauseRecording = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setRecording(false);
    toast.success("Recording paused");
  };

  const addStopAtCurrentLocation = () => {
    if (!currentLocation) {
      toast.error("GPS location not available");
      return;
    }
    setShowAddStopDialog(true);
  };

  const saveStop = () => {
    if (!newStop.stop_name && !newStop.mailbox_number) {
      toast.error("Please provide stop name or mailbox number");
      return;
    }

    const stop = {
      ...newStop,
      stop_sequence: stops.length + 1,
      gps_lat: currentLocation.lat,
      gps_lng: currentLocation.lng,
      gps_accuracy_meters: 10, // Would get from actual GPS
      added_at: new Date().toISOString()
    };

    setStops([...stops, stop]);
    setShowAddStopDialog(false);
    setNewStop({
      stop_type: "mailbox",
      is_permanent: true,
      stop_name: "",
      physical_address: "",
      mailbox_number: "",
      delivery_instructions: "",
      side_of_road: "right"
    });
    toast.success("Stop added to route!");
  };

  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      const endTime = new Date();
      const durationMinutes = Math.floor((endTime - startTime) / 60000);

      // Create route trace
      const route = await base44.entities.GPSRouteTrace.create({
        route_name: routeName,
        route_number: routeNumber,
        carrier_email: "carrier@usps.com", // Get from auth
        carrier_name: "Current Carrier",
        route_type: "rural",
        recording_date: new Date().toISOString().split('T')[0],
        gps_breadcrumbs: gpsPoints,
        total_stops: stops.length,
        total_distance_miles: distance,
        total_duration_minutes: durationMinutes,
        average_speed_mph: distance / (durationMinutes / 60),
        start_location_lat: gpsPoints[0]?.lat,
        start_location_lng: gpsPoints[0]?.lng,
        start_location_name: "Post Office",
        end_location_lat: gpsPoints[gpsPoints.length - 1]?.lat,
        end_location_lng: gpsPoints[gpsPoints.length - 1]?.lng,
        recording_quality: gpsPoints.length > 100 ? "excellent" : "good",
        last_updated: new Date().toISOString()
      });

      // Create all stops
      for (const stop of stops) {
        await base44.entities.RouteStopPoint.create({
          ...stop,
          route_trace_id: route.id,
          route_name: routeName,
          added_by: "Current Carrier"
        });
      }

      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRecordedRoutes'] });
      setRecording(false);
      setGpsPoints([]);
      setStops([]);
      setRouteName("");
      setRouteNumber("");
      setDistance(0);
      toast.success("Route saved successfully! Subs can now follow this route.");
    }
  });

  const handleSaveRoute = () => {
    if (gpsPoints.length < 10) {
      toast.error("Record at least 10 GPS points before saving");
      return;
    }
    if (stops.length === 0) {
      toast.error("Add at least one stop before saving");
      return;
    }
    saveRouteMutation.mutate();
  };

  const recordingDuration = startTime 
    ? Math.floor((new Date() - startTime) / 60000) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Circle className="w-10 h-10 text-red-600" />
            Record My Route
          </h1>
          <p className="text-gray-600">Create GPS-guided route for substitute carriers</p>
        </div>

        {/* Setup Card */}
        {!recording && gpsPoints.length === 0 && (
          <Card className="border-2 border-blue-300 mb-6">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-green-600">
              <CardTitle className="text-white">Route Setup</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Route Name *</Label>
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Rural Route 1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Route Number</Label>
                <Input
                  value={routeNumber}
                  onChange={(e) => setRouteNumber(e.target.value)}
                  placeholder="RR001"
                  className="mt-1"
                />
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-2">📍 How it works:</p>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Start recording when you begin your route</li>
                  <li>2. App tracks your exact GPS path automatically</li>
                  <li>3. Add stops at each mailbox/delivery point as you go</li>
                  <li>4. Save route when complete</li>
                  <li>5. Subs can follow your exact path with turn-by-turn guidance</li>
                </ol>
              </div>
              <Button
                onClick={startRecording}
                disabled={!routeName || !currentLocation}
                className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg font-semibold"
              >
                <Play className="w-6 h-6 mr-2" />
                Start Recording Route
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recording Stats */}
        {(recording || gpsPoints.length > 0) && (
          <Card className="border-2 border-green-300 mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <Circle className={`w-8 h-8 mx-auto mb-2 ${recording ? 'text-red-600 animate-pulse' : 'text-gray-400'}`} />
                  <p className="text-2xl font-bold text-gray-900">{recording ? 'RECORDING' : 'PAUSED'}</p>
                  <p className="text-xs text-gray-600">{recordingDuration} min</p>
                </div>
                <div className="text-center">
                  <MapPin className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-blue-900">{gpsPoints.length}</p>
                  <p className="text-xs text-gray-600">GPS Points</p>
                </div>
                <div className="text-center">
                  <Square className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                  <p className="text-2xl font-bold text-purple-900">{stops.length}</p>
                  <p className="text-xs text-gray-600">Stops Added</p>
                </div>
                <div className="text-center">
                  <Navigation className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                  <p className="text-2xl font-bold text-orange-900">{distance.toFixed(1)}</p>
                  <p className="text-xs text-gray-600">Miles</p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                {recording ? (
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    className="flex-1 border-2 border-yellow-300"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    Pause Recording
                  </Button>
                ) : gpsPoints.length > 0 && (
                  <Button
                    onClick={startRecording}
                    className="flex-1 bg-green-600"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Resume Recording
                  </Button>
                )}
                
                <Button
                  onClick={addStopAtCurrentLocation}
                  disabled={!currentLocation}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Stop Here
                </Button>

                {gpsPoints.length > 0 && (
                  <Button
                    onClick={handleSaveRoute}
                    disabled={saveRouteMutation.isPending || stops.length === 0}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {saveRouteMutation.isPending ? "Saving..." : "Save Route"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Location */}
        {currentLocation && (
          <Card className="border-2 border-blue-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Current GPS Position</p>
                  <p className="text-sm text-gray-600 font-mono">
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  </p>
                </div>
                <Badge className="bg-green-600">GPS Active</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stops List */}
        {stops.length > 0 && (
          <Card className="border-2 border-purple-200 mb-6">
            <CardHeader className="bg-purple-50">
              <CardTitle>Stops on Route ({stops.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {stops.map((stop, index) => (
                  <Card key={index} className="border-2 border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {stop.stop_sequence}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-900">
                              {stop.stop_name || stop.mailbox_number || stop.physical_address}
                            </p>
                            <Badge className={stop.is_permanent ? "bg-green-600" : "bg-orange-600"}>
                              {stop.is_permanent ? "Permanent" : "Temporary"}
                            </Badge>
                            <Badge variant="outline">{stop.stop_type.replace(/_/g, ' ')}</Badge>
                          </div>
                          {stop.physical_address && (
                            <p className="text-sm text-gray-600">{stop.physical_address}</p>
                          )}
                          {stop.delivery_instructions && (
                            <p className="text-xs text-blue-700 mt-1">📝 {stop.delivery_instructions}</p>
                          )}
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            GPS: {stop.gps_lat?.toFixed(6)}, {stop.gps_lng?.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Recorded Routes */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>My Recorded Routes</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {myRoutes.length === 0 ? (
              <div className="text-center py-8">
                <Navigation className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No routes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRoutes.map((route) => (
                  <Card key={route.id} className="border-2 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">{route.route_name}</h4>
                          <div className="grid grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Recorded</p>
                              <p className="font-semibold">
                                {format(new Date(route.recording_date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Stops</p>
                              <p className="font-semibold">{route.total_stops}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Distance</p>
                              <p className="font-semibold">{route.total_distance_miles?.toFixed(1)} mi</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Used by Subs</p>
                              <p className="font-semibold">{route.times_followed_by_subs || 0}×</p>
                            </div>
                          </div>
                          {route.average_sub_rating && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-sm text-gray-600">Sub Rating:</span>
                              <Badge className="bg-yellow-500">
                                ⭐ {route.average_sub_rating.toFixed(1)}/5
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Stop Dialog */}
        <Dialog open={showAddStopDialog} onOpenChange={setShowAddStopDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Stop at Current Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded border border-green-200">
                <p className="text-sm font-semibold text-green-900 mb-1">📍 GPS Coordinates:</p>
                <p className="text-sm text-green-800 font-mono">
                  {currentLocation?.lat.toFixed(6)}, {currentLocation?.lng.toFixed(6)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stop Type *</Label>
                  <Select
                    value={newStop.stop_type}
                    onValueChange={(v) => setNewStop({...newStop, stop_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mailbox">Mailbox</SelectItem>
                      <SelectItem value="physical_address">Physical Address</SelectItem>
                      <SelectItem value="cluster_box">Cluster Box</SelectItem>
                      <SelectItem value="parcel_locker">Parcel Locker</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="apartment_complex">Apartment Complex</SelectItem>
                      <SelectItem value="rural_box">Rural Box</SelectItem>
                      <SelectItem value="temporary_stop">Temporary Stop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Side of Road</Label>
                  <Select
                    value={newStop.side_of_road}
                    onValueChange={(v) => setNewStop({...newStop, side_of_road: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="either">Either</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Stop Name / Customer Name</Label>
                <Input
                  value={newStop.stop_name}
                  onChange={(e) => setNewStop({...newStop, stop_name: e.target.value})}
                  placeholder="Smith Family, Jones Mailbox, etc."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Physical Address</Label>
                <Input
                  value={newStop.physical_address}
                  onChange={(e) => setNewStop({...newStop, physical_address: e.target.value})}
                  placeholder="123 Main St (optional if mailbox)"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Mailbox/Box Number</Label>
                <Input
                  value={newStop.mailbox_number}
                  onChange={(e) => setNewStop({...newStop, mailbox_number: e.target.value})}
                  placeholder="Box #, Unit #, etc."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Delivery Instructions</Label>
                <Textarea
                  value={newStop.delivery_instructions}
                  onChange={(e) => setNewStop({...newStop, delivery_instructions: e.target.value})}
                  placeholder="Special instructions, gate codes, landmarks, etc."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="permanent"
                  checked={newStop.is_permanent}
                  onChange={(e) => setNewStop({...newStop, is_permanent: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label htmlFor="permanent" className="cursor-pointer">
                  Permanent stop (uncheck for temporary)
                </Label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAddStopDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveStop}
                  className="flex-1 bg-blue-600"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Add Stop
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}