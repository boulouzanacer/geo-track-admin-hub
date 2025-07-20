import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  } | null>(null);

  // For now, we'll show a placeholder map
  // In a real implementation, you would integrate with Google Maps API
  
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
          {/* Placeholder Map */}
          <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20">
              {/* Grid pattern to simulate map */}
              <div className="absolute inset-0 opacity-20">
                <div className="grid grid-cols-10 grid-rows-10 h-full w-full">
                  {[...Array(100)].map((_, i) => (
                    <div key={i} className="border border-gray-300 dark:border-gray-600"></div>
                  ))}
                </div>
              </div>
              
              {/* Phone markers */}
              {phones.map((phone, index) => (
                <div
                  key={phone.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                    selectedPhone?.id === phone.id ? 'z-20' : 'z-10'
                  }`}
                  style={{
                    left: `${20 + (index * 15) % 60}%`,
                    top: `${20 + (index * 10) % 60}%`,
                  }}
                >
                  <div className={`relative ${selectedPhone?.id === phone.id ? 'scale-150' : ''} transition-transform`}>
                    <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${
                      selectedPhone?.id === phone.id ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                    {selectedPhone?.id === phone.id && (
                      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-lg text-xs whitespace-nowrap">
                        {phone.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center z-30 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Map Integration Placeholder</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Google Maps will be integrated here to show real phone locations
              </p>
              {selectedPhone ? (
                <div className="space-y-2">
                  <Badge variant="outline">{selectedPhone.name}</Badge>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last update: {formatDistanceToNow(new Date(selectedPhone.last_update), { addSuffix: true })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select a phone from the list to view its location
                </p>
              )}
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 space-y-2">
            <button className="bg-white dark:bg-gray-800 p-2 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <Navigation className="h-4 w-4" />
            </button>
          </div>

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