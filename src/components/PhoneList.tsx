import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Smartphone, Clock, User } from 'lucide-react';
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

interface PhoneListProps {
  phones: Phone[];
  selectedPhone: Phone | null;
  onSelectPhone: (phone: Phone) => void;
  userRole: string;
  currentUserId: string;
  loading: boolean;
  onRefresh: () => void;
}

const PhoneList = ({
  phones,
  selectedPhone,
  onSelectPhone,
  userRole,
  currentUserId,
  loading,
  onRefresh
}: PhoneListProps) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const getStatusColor = (lastUpdate: string) => {
    const lastUpdateTime = new Date(lastUpdate);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return 'bg-green-500';
    if (diffMinutes < 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const filteredPhones = userRole === 'admin' 
    ? phones 
    : phones.filter(phone => phone.user_id === currentUserId);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Phones ({filteredPhones.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-muted rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : filteredPhones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No phones found</p>
            </div>
          ) : (
            filteredPhones.map((phone) => (
              <div
                key={phone.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedPhone?.id === phone.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onSelectPhone(phone)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">{phone.name}</h4>
                    <p className="text-xs text-muted-foreground">{phone.phone_id}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(phone.last_update)}`} />
                </div>
                
                {userRole === 'admin' && phone.users && (
                  <div className="flex items-center gap-1 mb-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{phone.users.name}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(phone.last_update), { addSuffix: true })}
                  </span>
                </div>
                
                <Badge 
                  variant="secondary" 
                  className="text-xs mt-2"
                >
                  {(() => {
                    const diffMinutes = (new Date().getTime() - new Date(phone.last_update).getTime()) / (1000 * 60);
                    if (diffMinutes < 5) return 'Online';
                    if (diffMinutes < 30) return 'Recent';
                    return 'Offline';
                  })()}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PhoneList;