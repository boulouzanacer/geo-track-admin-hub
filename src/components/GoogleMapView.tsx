import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, Route } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Loader } from '@googlemaps/js-api-loader';
// Marker clustering will be loaded at runtime via script tag to avoid build-time deps
import MapView from '@/components/MapView';

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

interface GoogleMapViewProps {
  selectedPhone: Phone | null;
  phones: Phone[];
  trackingData?: any;
  fullScreen?: boolean;
  resizeSignal?: number;
}

const GoogleMapView = ({ selectedPhone, phones, trackingData = {}, fullScreen = false, resizeSignal }: GoogleMapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [googleMapsKey, setGoogleMapsKey] = useState<string>('');
  const [mapDefaultZoom, setMapDefaultZoom] = useState<number>(10);
  const [phoneLocations, setPhoneLocations] = useState<{[phoneId: string]: {lat: number, lng: number, timestamp?: string}}>({});
  const [loading, setLoading] = useState(true);
  const [trajectoryInfo, setTrajectoryInfo] = useState<{[phoneId: string]: {distance: number, duration: number, positions: number}}>({});
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routesRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const clustererRef = useRef<any>(null);
  const [gmError, setGmError] = useState<string | null>(null);

  // Prefer backend config for API key; fallback to env only if server returns empty
  useEffect(() => {
    (async () => {
      try {
        let res = await fetch('/api/config/map-keys');
        if (!res.ok) {
          res = await fetch('http://localhost:5003/api/config/map-keys');
        }
        if (res.ok) {
          const data = await res.json();
          const fromServer = data.googleMapsKey || '';
          const z = Number.isFinite(Number(data.mapDefaultZoom)) ? Math.round(Number(data.mapDefaultZoom)) : 10;
          setMapDefaultZoom(Math.max(1, Math.min(20, z)));
          if (fromServer) {
            setGoogleMapsKey(fromServer);
          } else {
            const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
            if (fromEnv) setGoogleMapsKey(fromEnv);
          }
        } else {
          const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
          if (fromEnv) setGoogleMapsKey(fromEnv);
        }
      } catch {
        const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
        if (fromEnv) setGoogleMapsKey(fromEnv);
      }
    })();
  }, []);

  // Fetch phone locations
  useEffect(() => {
    const fetchPhoneLocations = async () => {
      try {
        const locations: {[phoneId: string]: {lat: number, lng: number, timestamp?: string}} = {};
        
        for (const phone of phones) {
          try {
            const response = await fetch(`/api/locations/latest?phone_id=${phone.phone_id}`);
            
            if (response.ok) {
              const data = await response.json();
              if (data && data.latitude && data.longitude) {
                locations[phone.phone_id] = {
                  lat: parseFloat(data.latitude),
                  lng: parseFloat(data.longitude),
                  timestamp: data.timestamp
                };
                console.log(`Map: Using timestamp for ${phone.phone_id}:`, data.timestamp);
              }
            } else {
              console.log(`Map: No location found for phone ${phone.phone_id}, status:`, response.status);
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

  // Poll for latest locations periodically (every 10s)
  useEffect(() => {
    const interval = setInterval(async () => {
      const updates: {[phoneId: string]: {lat: number, lng: number, timestamp?: string}} = {};
      for (const phone of phones) {
        try {
          const res = await fetch(`/api/locations/latest?phone_id=${phone.phone_id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.latitude && data.longitude) {
              updates[phone.phone_id] = {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude),
                timestamp: data.timestamp,
              };
            }
          }
        } catch {}
      }
      if (Object.keys(updates).length > 0) {
        setPhoneLocations(prev => ({ ...prev, ...updates }));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [phones]);

  // Initialize Google Maps
  useEffect(() => {
    if (!mapContainer.current || !googleMapsKey) return;

    const loader = new Loader({
      apiKey: googleMapsKey,
      version: 'weekly',
      libraries: ['geometry', 'places', 'routes']
    });

    loader.load().then(() => {
      if (mapContainer.current) {
        map.current = new google.maps.Map(mapContainer.current, {
          center: { lat: 0, lng: 0 },
          zoom: mapDefaultZoom,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        // Load marker clusterer library dynamically
        const existing = document.querySelector('script[data-clusterer]');
        if (!existing) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
          script.async = true;
          script.dataset.clusterer = 'true';
          script.onload = () => {
            // Ready to use on next render cycle
          };
          document.head.appendChild(script);
        }
      }
    }).catch(error => {
      console.error('Error loading Google Maps:', error);
      setGmError(error?.message || 'Failed to load Google Maps');
    });

    return () => {
      // Cleanup
      if (map.current) {
        map.current = null;
      }
    };
  }, [googleMapsKey]);

  // Adjust zoom if default changes after map initialization
  useEffect(() => {
    try {
      if (map.current) {
        const currentZoom = map.current.getZoom() ?? mapDefaultZoom;
        if (!Number.isFinite(currentZoom) || Math.abs(currentZoom - mapDefaultZoom) > 0.1) {
          map.current.setZoom(mapDefaultZoom);
        }
      }
    } catch {}
  }, [mapDefaultZoom]);

  // Capture Google Maps auth failures (e.g., invalid key, billing, referrer restrictions)
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      setGmError('Google Maps authentication failed');
    };
    return () => {
      try { delete (window as any).gm_authFailure; } catch {}
    };
  }, []);

  // Trigger map resize when layout changes (e.g., panels collapse/expand)
  useEffect(() => {
    if (map.current) {
      try {
        // Notify Google Maps of container size changes
        google.maps.event.trigger(map.current, 'resize');
      } catch {}
    }
  }, [resizeSignal]);

  // Add markers and routes
  useEffect(() => {
    if (!map.current || Object.keys(phoneLocations).length === 0) return;

    // Clear existing markers, routes, and clustering
    markersRef.current.forEach(marker => marker.setMap(null));
    routesRef.current.forEach(renderer => renderer.setMap(null));
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    markersRef.current = [];
    routesRef.current = [];
    polylinesRef.current = [];
    if (clustererRef.current && typeof clustererRef.current.clearMarkers === 'function') {
      try { clustererRef.current.clearMarkers(); } catch {}
    }

    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;

    // Add phone markers
    phones.forEach(phone => {
      const location = phoneLocations[phone.phone_id];
      
      if (location) {
        hasValidLocations = true;
        const position = new google.maps.LatLng(location.lat, location.lng);
        bounds.extend(position);

        const marker = new google.maps.Marker({
          position,
          map: map.current!,
          title: phone.name,
          icon: {
            path: "M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13C19,5.13 15.87,2 12,2zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5s2.5,1.12 2.5,2.5S13.38,11.5 12,11.5z",
            fillColor: selectedPhone?.phone_id === phone.phone_id ? '#ef4444' : '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.5,
            anchor: new google.maps.Point(12, 24),
          }
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="p-2">
              <h4 class="font-semibold">${phone.name}</h4>
              <p class="text-sm text-gray-600">ID: ${phone.phone_id}</p>
              <p class="text-sm text-gray-600">Last update: ${location.timestamp ? formatDistanceToNow(new Date(location.timestamp), { addSuffix: true }) : 'Unknown'}</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map.current!, marker);
        });

        markersRef.current.push(marker);
      }
    });

    // Add tracking routes
    if (Object.keys(trackingData).length > 0) {
      Object.entries(trackingData).forEach(async ([phoneId, data]: [string, any]) => {
        if (data.allLocations && data.allLocations.length > 1) {
          const locations = data.allLocations.filter((loc: any) => loc.latitude && loc.longitude);
          
          if (locations.length > 1) {
            // Filter out locations that are too far apart (likely GPS errors)
            const filteredLocations = [locations[0]];
            for (let i = 1; i < locations.length; i++) {
              const prevLoc = filteredLocations[filteredLocations.length - 1];
              const currLoc = locations[i];
              
              // Calculate distance using Haversine formula
              const R = 6371; // Earth's radius in km
              const dLat = (parseFloat(currLoc.latitude) - parseFloat(prevLoc.latitude)) * Math.PI / 180;
              const dLon = (parseFloat(currLoc.longitude) - parseFloat(prevLoc.longitude)) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                       Math.cos(parseFloat(prevLoc.latitude) * Math.PI / 180) * Math.cos(parseFloat(currLoc.latitude) * Math.PI / 180) *
                       Math.sin(dLon/2) * Math.sin(dLon/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const distance = R * c;
              
              // Only include if distance is reasonable (less than 50km between consecutive points)
              if (distance < 50) {
                filteredLocations.push(currLoc);
              } else {
                console.log(`Filtering out location jump: ${distance.toFixed(2)}km`);
              }
            }

            console.log(`Filtered locations: ${locations.length} → ${filteredLocations.length}`);
            
            if (filteredLocations.length > 1) {
              try {
                // Calculate trajectory info
                let totalDistance = 0;
                const startTime = new Date(filteredLocations[0].timestamp);
                const endTime = new Date(filteredLocations[filteredLocations.length - 1].timestamp);
                const totalDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes

                // Create routes between each pair of consecutive points
                const directionsService = new google.maps.DirectionsService();
                
                for (let i = 0; i < filteredLocations.length - 1; i++) {
                  const start = new google.maps.LatLng(
                    parseFloat(filteredLocations[i].latitude), 
                    parseFloat(filteredLocations[i].longitude)
                  );
                  const end = new google.maps.LatLng(
                    parseFloat(filteredLocations[i + 1].latitude), 
                    parseFloat(filteredLocations[i + 1].longitude)
                  );

                  try {
                    const result = await directionsService.route({
                      origin: start,
                      destination: end,
                      travelMode: google.maps.TravelMode.DRIVING,
                      avoidHighways: false,
                      avoidTolls: false
                    });

                    const directionsRenderer = new google.maps.DirectionsRenderer({
                      map: map.current!,
                      directions: result,
                      suppressMarkers: true, // We'll use our own markers
                      polylineOptions: {
                        strokeColor: '#3b82f6',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        icons: [{
                          icon: {
                            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                            scale: 3,
                            fillColor: '#3b82f6',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 1
                          },
                          offset: '100%',
                          repeat: '200px'
                        }]
                      }
                    });

                    routesRef.current.push(directionsRenderer);
                  } catch (error) {
                    console.log(`Could not get route between points ${i} and ${i+1}, using straight line`);
                    // Fallback to straight line if routing fails
                    const polyline = new google.maps.Polyline({
                      path: [start, end],
                      geodesic: true,
                      strokeColor: '#ff6b6b',
                      strokeOpacity: 0.6,
                      strokeWeight: 3,
                    });
                    
                    polyline.setMap(map.current!);
                    polylinesRef.current.push(polyline);
                  }
                }
                
                // Calculate total distance using Haversine formula
                for (let i = 1; i < filteredLocations.length; i++) {
                  const R = 6371; // Earth's radius in km
                  const dLat = (parseFloat(filteredLocations[i].latitude) - parseFloat(filteredLocations[i-1].latitude)) * Math.PI / 180;
                  const dLon = (parseFloat(filteredLocations[i].longitude) - parseFloat(filteredLocations[i-1].longitude)) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                           Math.cos(parseFloat(filteredLocations[i-1].latitude) * Math.PI / 180) * Math.cos(parseFloat(filteredLocations[i].latitude) * Math.PI / 180) *
                           Math.sin(dLon/2) * Math.sin(dLon/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  totalDistance += R * c; // km
                }

                // Update trajectory info
                setTrajectoryInfo(prev => ({
                  ...prev,
                  [phoneId]: {
                    distance: totalDistance,
                    duration: totalDuration,
                    positions: filteredLocations.length
                  }
                }));

                // Add custom markers for start, end, and waypoints
                filteredLocations.forEach((location: any, index: number) => {
                  const position = new google.maps.LatLng(
                    parseFloat(location.latitude),
                    parseFloat(location.longitude)
                  );
                  
                  let markerColor = '#6b7280'; // gray for waypoints
                  let markerSize = 6;
                  let popupTitle = `Waypoint ${index + 1}`;
                  
                  if (index === 0) {
                    markerColor = '#22c55e'; // green for start
                    markerSize = 8;
                    popupTitle = 'Start Point';
                  } else if (index === filteredLocations.length - 1) {
                    markerColor = '#ef4444'; // red for end
                    markerSize = 8;
                    popupTitle = 'End Point';
                  }
                  
                  const wayPointMarker = new google.maps.Marker({
                    position,
                    map: map.current!,
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: markerSize,
                      fillColor: markerColor,
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    }
                  });

                  const infoWindow = new google.maps.InfoWindow({
                    content: `
                      <div class="p-2">
                        <h4 class="font-semibold">${popupTitle}</h4>
                        <p class="text-sm">${new Date(location.timestamp).toLocaleString()}</p>
                        <p class="text-xs text-gray-500">Lat: ${location.latitude}, Lng: ${location.longitude}</p>
                      </div>
                    `
                  });

                  wayPointMarker.addListener('click', () => {
                    infoWindow.open(map.current!, wayPointMarker);
                  });

                  markersRef.current.push(wayPointMarker);
                  bounds.extend(position);
                });
              } catch (error) {
                console.error('Error calculating route:', error);
                // Final fallback: draw simple polyline
                if (filteredLocations.length > 1) {
                  const path = filteredLocations.map((loc: any) => 
                    new google.maps.LatLng(parseFloat(loc.latitude), parseFloat(loc.longitude))
                  );
                  
                  const polyline = new google.maps.Polyline({
                    path,
                    geodesic: true,
                    strokeColor: '#ff6b6b',
                    strokeOpacity: 0.8,
                    strokeWeight: 5,
                  });
                  
                  polyline.setMap(map.current!);
                }
              }
            }
          }
        }
      });
    }

    // Apply marker clustering if library is available
    const MC = (window as any).markerClusterer || (window as any).MarkerClusterer;
    if (MC && markersRef.current.length > 0) {
      try {
        clustererRef.current = new MC({ markers: markersRef.current, map: map.current });
      } catch {
        // If constructor signature differs, fallback silently
      }
    }

    // Fit map to show all markers
    if (hasValidLocations) {
      if (phones.filter(phone => phoneLocations[phone.phone_id]).length === 1) {
        const singleLocation = Object.values(phoneLocations)[0];
        map.current!.setCenter(new google.maps.LatLng(singleLocation.lat, singleLocation.lng));
        map.current!.setZoom(mapDefaultZoom);
      } else {
        map.current!.fitBounds(bounds);
        // Cap zoom after bounds fit to avoid over-zooming
        try {
          google.maps.event.addListenerOnce(map.current!, 'idle', () => {
            const z = map.current!.getZoom() ?? mapDefaultZoom;
            if (Number.isFinite(z) && z > mapDefaultZoom) {
              map.current!.setZoom(mapDefaultZoom);
            }
          });
        } catch {}
      }
    }
  }, [phoneLocations, phones, selectedPhone, trackingData]);

  if (!googleMapsKey) {
    return (
      <Card className={fullScreen ? "absolute inset-0 m-0" : "h-full"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={fullScreen ? "w-full h-full min-h-screen bg-muted rounded-none flex items-center justify-center" : "w-full h-96 bg-muted rounded-lg flex items-center justify-center"}>
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Loading Map...</h3>
              <p className="text-sm text-muted-foreground">Getting Google Maps configuration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If Google Maps fails at runtime, attempt Mapbox fallback or show a helpful error
  if (gmError) {
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (mapboxToken) {
      return (
        <MapView
          fullScreen={fullScreen}
          resizeSignal={resizeSignal}
          selectedPhone={selectedPhone}
          phones={phones}
          trackingData={trackingData}
        />
      );
    }

    return (
      <Card className={fullScreen ? "absolute inset-0 m-0" : "h-full"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Google Maps error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={fullScreen ? "w-full h-full min-h-screen bg-muted rounded-none flex items-center justify-center" : "w-full h-96 bg-muted rounded-lg flex items-center justify-center"}>
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Google Maps ne s'est pas chargé</h3>
              <p className="text-sm text-muted-foreground mb-2">{gmError}</p>
              <p className="text-sm text-muted-foreground">Vérifiez votre clé (`VITE_GOOGLE_MAPS_KEY`), la facturation, et les restrictions de référent pour `localhost:{window.location.port}`. Ou définissez `VITE_MAPBOX_TOKEN` dans `.env` pour utiliser Mapbox.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Full-screen mode: render only the map container, panels are managed by the page overlay
  if (fullScreen) {
    return (
      <div ref={mapContainer} className="absolute inset-0" />
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Map (Google Maps)
          {selectedPhone && (
            <Badge variant="outline">
              {selectedPhone.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Google Maps Container */}
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

export default GoogleMapView;
