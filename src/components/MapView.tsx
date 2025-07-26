import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock } from 'lucide-react';
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

    // Add tracking lines for movement data
    if (Object.keys(trackingData).length > 0) {
      console.log('Adding tracking lines:', trackingData);
      
      Object.entries(trackingData).forEach(([phoneId, data]: [string, any]) => {
        if (data.allLocations && data.allLocations.length > 1) {
          // Create path from all locations
          const coordinates = data.allLocations
            .filter((loc: any) => loc.latitude && loc.longitude)
            .map((loc: any) => [parseFloat(loc.longitude), parseFloat(loc.latitude)]);
          
          if (coordinates.length > 1) {
            // Remove existing tracking elements
            const lineId = `tracking-line-${phoneId}`;
            const pointsId = `tracking-points-${phoneId}`;
            
            if (map.current.getSource(lineId)) {
              map.current.removeLayer(lineId);
              map.current.removeSource(lineId);
            }
            if (map.current.getSource(pointsId)) {
              map.current.removeLayer(pointsId);
              map.current.removeSource(pointsId);
            }
            
            // Clear existing arrows
            const existingArrows = document.querySelectorAll('.tracking-arrow');
            existingArrows.forEach(arrow => arrow.remove());
            
            // Add tracking line
            map.current.addSource(lineId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: coordinates
                }
              }
            });
            
            map.current.addLayer({
              id: lineId,
              type: 'line',
              source: lineId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#ef4444',
                'line-width': 4,
                'line-opacity': 0.8
              }
            });
            
            // Add direction arrows along the path
            for (let i = 0; i < coordinates.length - 1; i++) {
              const start = coordinates[i];
              const end = coordinates[i + 1];
              const bearing = getBearing(start, end);
              
              // Create arrow element
              const arrowEl = document.createElement('div');
              arrowEl.className = 'tracking-arrow';
              arrowEl.style.width = '0';
              arrowEl.style.height = '0';
              arrowEl.style.borderLeft = '6px solid transparent';
              arrowEl.style.borderRight = '6px solid transparent';
              arrowEl.style.borderBottom = '10px solid #ef4444';
              arrowEl.style.transform = `rotate(${bearing}deg)`;
              arrowEl.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
              
              // Position arrow at the end of each segment
              new mapboxgl.Marker(arrowEl)
                .setLngLat(end as [number, number])
                .addTo(map.current!);
            }
            
            // Add start marker (green)
            const startEl = document.createElement('div');
            startEl.className = 'tracking-marker start-marker';
            startEl.style.width = '12px';
            startEl.style.height = '12px';
            startEl.style.borderRadius = '50%';
            startEl.style.backgroundColor = '#22c55e';
            startEl.style.border = '2px solid white';
            startEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            
            new mapboxgl.Marker(startEl)
              .setLngLat(coordinates[0] as [number, number])
              .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div class="p-2">
                  <h4 class="font-semibold text-green-600">Start Point</h4>
                  <p class="text-sm">${data.allLocations[0].timestamp}</p>
                </div>
              `))
              .addTo(map.current!);
            
            // Add end marker (red)
            const endEl = document.createElement('div');
            endEl.className = 'tracking-marker end-marker';
            endEl.style.width = '12px';
            endEl.style.height = '12px';
            endEl.style.borderRadius = '50%';
            endEl.style.backgroundColor = '#ef4444';
            endEl.style.border = '2px solid white';
            endEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            
            new mapboxgl.Marker(endEl)
              .setLngLat(coordinates[coordinates.length - 1] as [number, number])
              .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div class="p-2">
                  <h4 class="font-semibold text-red-600">End Point</h4>
                  <p class="text-sm">${data.allLocations[data.allLocations.length - 1].timestamp}</p>
                </div>
              `))
              .addTo(map.current!);
            
            // Extend bounds to include tracking path
            coordinates.forEach(coord => bounds.extend(coord));
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
        </div>
      </CardContent>
    </Card>
  );
};

export default MapView;