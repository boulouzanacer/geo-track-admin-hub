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
}

const MapView = ({ selectedPhone, phones }: MapViewProps) => {
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
    if (!map.current || Object.keys(phoneLocations).length === 0) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.phone-marker');
    existingMarkers.forEach(marker => marker.remove());

    let bounds = new mapboxgl.LngLatBounds();
    let hasValidLocations = false;

    phones.forEach(phone => {
      const location = phoneLocations[phone.phone_id];
      if (location) {
        hasValidLocations = true;
        bounds.extend([location.lng, location.lat]);

        // Create marker element
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
        new mapboxgl.Marker(el)
          .setLngLat([location.lng, location.lat])
          .setPopup(popup)
          .addTo(map.current!);
      }
    });

    // Fit map to show all markers
    if (hasValidLocations) {
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [phoneLocations, phones, selectedPhone]);

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