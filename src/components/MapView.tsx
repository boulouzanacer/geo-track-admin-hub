import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, Route } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface Phone {
  id: string;
  phone_id: string;
  name: string;
  user_id: string;
  last_update: string;
  users?: {
    name: string;
  };
}

interface MapViewProps {
  selectedPhone: Phone | null;
  phones: Phone[];
  trackingData?: any;
}

const MapView = ({ selectedPhone, phones, trackingData = {} }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [phoneLocations, setPhoneLocations] = useState<{[phoneId: string]: {lat: number, lng: number}}>({});
  const [loading, setLoading] = useState(true);
  const [trajectoryInfo, setTrajectoryInfo] = useState<{[phoneId: string]: {distance: number, duration: number, positions: number}}>({});

  // Get Mapbox token from Supabase secrets
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (error) {
        console.error('Error getting Mapbox token:', error);
      }
    };
    getMapboxToken();
  }, []);

  // Fetch phone locations
  useEffect(() => {
    const fetchPhoneLocations = async () => {
      try {
        const locations: {[phoneId: string]: {lat: number, lng: number}} = {};
        
        for (const phone of phones) {
          try {
            // Construct the correct edge function URL with the phone path
            const functionUrl = `https://ebwbrjkqrsgumlwvhrhb.supabase.co/functions/v1/location-api/phone/${phone.phone_id}`;
            
            const response = await fetch(functionUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVid2JyamtxcnNndW1sd3ZocmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg3MDUsImV4cCI6MjA2ODYwNDcwNX0.DdJjvA0S3rMMAqvxfLKMPhYo2fQkwRrHj1KFOKgmXOc`,
                'Content-Type': 'application/json',
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              const locationData = data.location;
              if (locationData && locationData.latitude && locationData.longitude) {
                locations[phone.phone_id] = {
                  lat: parseFloat(locationData.latitude),
                  lng: parseFloat(locationData.longitude)
                };
                console.log(`Location found for phone ${phone.phone_id}:`, locations[phone.phone_id]);
              }
            } else {
              console.log(`No location data found for phone ${phone.phone_id}`);
            }
          } catch (err) {
            console.error(`Error fetching location for phone ${phone.phone_id}:`, err);
          }
        }
        
        setPhoneLocations(locations);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching phone locations:', error);
        setLoading(false);
      }
    };

    if (phones.length > 0) {
      fetchPhoneLocations();
    }
  }, [phones]);

  // Real-time updates for new location data
  useEffect(() => {
    const channel = supabase
      .channel('location-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations'
        },
        (payload) => {
          console.log('New location received:', payload);
          const newLocation = payload.new as any;
          
          if (newLocation.phone_id && newLocation.latitude && newLocation.longitude) {
            setPhoneLocations(prev => ({
              ...prev,
              [newLocation.phone_id]: {
                lat: parseFloat(newLocation.latitude),
                lng: parseFloat(newLocation.longitude)
              }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 0],
      zoom: 10
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Add phone markers to map
  useEffect(() => {
    if (!map.current || Object.keys(phoneLocations).length === 0) {
      console.log('Map not ready or no phone locations:', { 
        mapReady: !!map.current, 
        locationCount: Object.keys(phoneLocations).length,
        phoneLocations 
      });
      return;
    }

    console.log('Adding markers for phones:', phones.length, 'with locations:', phoneLocations);

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.phone-marker');
    existingMarkers.forEach(marker => marker.remove());

    let bounds = new mapboxgl.LngLatBounds();
    let hasValidLocations = false;

    phones.forEach(phone => {
      const location = phoneLocations[phone.phone_id];
      console.log(`Processing phone ${phone.phone_id}:`, location);
      
      if (location) {
        hasValidLocations = true;
        bounds.extend([location.lng, location.lat]);

        console.log(`Creating marker for ${phone.name} at [${location.lng}, ${location.lat}]`);

        // Create standard marker element
        const el = document.createElement('div');
        el.className = 'phone-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.style.backgroundColor = selectedPhone?.phone_id === phone.phone_id ? '#ef4444' : '#3b82f6';

        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <h4 class="font-semibold">${phone.name}</h4>
            <p class="text-sm text-gray-600">ID: ${phone.phone_id}</p>
            <p class="text-sm text-gray-600">Last update: ${formatDistanceToNow(new Date(phone.last_update), { addSuffix: true })}</p>
          </div>
        `);

        // Add marker to map
        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lng, location.lat])
          .setPopup(popup)
          .addTo(map.current!);
          
        console.log('Marker added successfully:', marker);
      } else {
        console.log(`No location found for phone ${phone.phone_id}`);
      }
    });

    // Add tracking routes for movement data
    if (Object.keys(trackingData).length > 0) {
      console.log('Adding tracking routes:', trackingData);
      
      Object.entries(trackingData).forEach(async ([phoneId, data]: [string, any]) => {
        if (data.allLocations && data.allLocations.length > 1) {
          const locations = data.allLocations.filter((loc: any) => loc.latitude && loc.longitude);
          
          if (locations.length > 1) {
            // Remove existing tracking elements
            const routeId = `tracking-route-${phoneId}`;
            const waypointsId = `tracking-waypoints-${phoneId}`;
            
            if (map.current.getSource(routeId)) {
              map.current.removeLayer(routeId);
              map.current.removeSource(routeId);
            }
            if (map.current.getSource(waypointsId)) {
              map.current.removeLayer(waypointsId);
              map.current.removeSource(waypointsId);
            }
            
            // Clear existing markers
            const existingArrows = document.querySelectorAll('.tracking-arrow, .tracking-marker');
            existingArrows.forEach(arrow => arrow.remove());
            
            // Calculate trajectory info
            let totalDistance = 0;
            let totalDuration = 0;
            const startTime = new Date(locations[0].timestamp);
            const endTime = new Date(locations[locations.length - 1].timestamp);
            totalDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
            
            // Get route between consecutive points
            const routeSegments = [];
            for (let i = 0; i < locations.length - 1; i++) {
              const start = locations[i];
              const end = locations[i + 1];
              
              try {
                const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?geometries=geojson&access_token=${mapboxToken}`;
                const response = await fetch(routeUrl);
                const routeData = await response.json();
                
                if (routeData.routes && routeData.routes.length > 0) {
                  const route = routeData.routes[0];
                  totalDistance += route.distance; // meters
                  routeSegments.push(...route.geometry.coordinates);
                } else {
                  // Fallback to straight line if no route found
                  const distance = calculateDistance(
                    parseFloat(start.latitude), parseFloat(start.longitude),
                    parseFloat(end.latitude), parseFloat(end.longitude)
                  );
                  totalDistance += distance * 1000; // convert km to meters
                  routeSegments.push([parseFloat(start.longitude), parseFloat(start.latitude)]);
                  routeSegments.push([parseFloat(end.longitude), parseFloat(end.latitude)]);
                }
              } catch (error) {
                console.error('Error fetching route:', error);
                // Fallback to straight line
                const distance = calculateDistance(
                  parseFloat(start.latitude), parseFloat(start.longitude),
                  parseFloat(end.latitude), parseFloat(end.longitude)
                );
                totalDistance += distance * 1000; // convert km to meters
                routeSegments.push([parseFloat(start.longitude), parseFloat(start.latitude)]);
                routeSegments.push([parseFloat(end.longitude), parseFloat(end.latitude)]);
              }
            }
            
            // Update trajectory info
            setTrajectoryInfo(prev => ({
              ...prev,
              [phoneId]: {
                distance: totalDistance / 1000, // convert to km
                duration: totalDuration,
                positions: locations.length
              }
            }));
            
            // Add the complete route
            if (routeSegments.length > 1) {
              map.current.addSource(routeId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: routeSegments
                  }
                }
              });
              
              map.current.addLayer({
                id: routeId,
                type: 'line',
                source: routeId,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': '#3b82f6',
                  'line-width': 5,
                  'line-opacity': 0.8
                }
              });
              
              // Add waypoint markers
              locations.forEach((location: any, index: number) => {
                const coord = [parseFloat(location.longitude), parseFloat(location.latitude)];
                
                let markerColor = '#6b7280'; // gray for waypoints
                let markerSize = '8px';
                let popupTitle = `Waypoint ${index + 1}`;
                
                if (index === 0) {
                  markerColor = '#22c55e'; // green for start
                  markerSize = '12px';
                  popupTitle = 'Start Point';
                } else if (index === locations.length - 1) {
                  markerColor = '#ef4444'; // red for end
                  markerSize = '12px';
                  popupTitle = 'End Point';
                }
                
                const markerEl = document.createElement('div');
                markerEl.className = 'tracking-marker';
                markerEl.style.width = markerSize;
                markerEl.style.height = markerSize;
                markerEl.style.borderRadius = '50%';
                markerEl.style.backgroundColor = markerColor;
                markerEl.style.border = '2px solid white';
                markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                
                new mapboxgl.Marker(markerEl)
                  .setLngLat(coord as [number, number])
                  .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                    <div class="p-2">
                      <h4 class="font-semibold">${popupTitle}</h4>
                      <p class="text-sm">${new Date(location.timestamp).toLocaleString()}</p>
                      <p class="text-xs text-gray-500">Lat: ${location.latitude}, Lng: ${location.longitude}</p>
                    </div>
                  `))
                  .addTo(map.current!);
                
                // Extend bounds
                bounds.extend(coord as [number, number]);
              });
              
              // Add direction arrows along the route
              const arrowInterval = Math.floor(routeSegments.length / 5); // Show 5 arrows along the route
              for (let i = arrowInterval; i < routeSegments.length; i += arrowInterval) {
                if (i < routeSegments.length - 1) {
                  const start = routeSegments[i - 1] || routeSegments[i];
                  const end = routeSegments[i];
                  const bearing = getBearing(start, end);
                  
                  const arrowEl = document.createElement('div');
                  arrowEl.className = 'tracking-arrow';
                  arrowEl.style.width = '0';
                  arrowEl.style.height = '0';
                  arrowEl.style.borderLeft = '5px solid transparent';
                  arrowEl.style.borderRight = '5px solid transparent';
                  arrowEl.style.borderBottom = '8px solid #3b82f6';
                  arrowEl.style.transform = `rotate(${bearing}deg)`;
                  arrowEl.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
                  
                  new mapboxgl.Marker(arrowEl)
                    .setLngLat(end as [number, number])
                    .addTo(map.current!);
                }
              }
            }
          }
        }
      });
    }

    // Fit map to show all markers or center on single location
    if (hasValidLocations) {
      if (phones.filter(phone => phoneLocations[phone.phone_id]).length === 1) {
        // For single location, center with default zoom
        const singleLocation = Object.values(phoneLocations)[0];
        map.current.setCenter([singleLocation.lng, singleLocation.lat]);
        map.current.setZoom(10);
      } else {
        // For multiple locations, fit bounds with minimum zoom
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
      }
    }
  }, [phoneLocations, phones, selectedPhone, trackingData]);

  // Helper function to calculate bearing between two points
  const getBearing = (start: number[], end: number[]) => {
    const startLat = start[1] * Math.PI / 180;
    const startLng = start[0] * Math.PI / 180;
    const endLat = end[1] * Math.PI / 180;
    const endLng = end[0] * Math.PI / 180;
    
    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  // Helper function to calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  if (!mapboxToken) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Loading Map...</h3>
              <p className="text-sm text-muted-foreground">Getting Mapbox configuration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Map
          {selectedPhone && (
            <Badge variant="outline">
              {selectedPhone.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Real Mapbox Map */}
          <div ref={mapContainer} className="w-full h-96 rounded-lg" />

          {/* Location Info Panel */}
          {selectedPhone && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Location Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{selectedPhone.name} ({selectedPhone.phone_id})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Update:</span>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(selectedPhone.last_update), { addSuffix: true })}
                  </p>
                </div>
                {selectedPhone.users && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Owner:</span>
                    <p className="font-medium">{selectedPhone.users.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trajectory Info Panel */}
          {Object.keys(trajectoryInfo).length > 0 && (
            <div className="mt-4 space-y-3">
              {Object.entries(trajectoryInfo).map(([phoneId, info]) => {
                const phone = phones.find(p => p.phone_id === phoneId);
                return (
                  <Card key={phoneId} className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Route className="h-4 w-4" />
                        Trajectory: {phone?.name || phoneId}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Navigation className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Distance</span>
                          </div>
                          <p className="font-semibold text-primary">
                            {info.distance.toFixed(2)} km
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Duration</span>
                          </div>
                          <p className="font-semibold text-primary">
                            {Math.floor(info.duration / 60)}h {Math.round(info.duration % 60)}m
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Points</span>
                          </div>
                          <p className="font-semibold text-primary">
                            {info.positions}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MapView;