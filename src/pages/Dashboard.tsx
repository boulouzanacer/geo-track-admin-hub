import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Users, Smartphone, LogOut } from 'lucide-react';
import GoogleMapView from '@/components/GoogleMapView';
import PhoneList from '@/components/PhoneList';
import { UserManagement } from '@/components/UserManagement';
import { PhoneManagement } from '@/components/PhoneManagement';
import { UserSelector } from '@/components/UserSelector';
import { TrackingFilter } from '@/components/TrackingFilter';
import LanguageSelector from '@/components/LanguageSelector';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

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

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<Phone | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [trackingDate, setTrackingDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [trackingData, setTrackingData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isTrackingFilterOpen, setIsTrackingFilterOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchPhones();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // User profile doesn't exist, create one
      await createUserProfile();
    } else if (error) {
      toast({
        title: t('auth.error'),
        description: t('dashboard.errors.fetchProfile'),
        variant: "destructive",
      });
    } else {
      setUserProfile(data);
    }
  };

  const createUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .insert([{
        auth_user_id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: 'user'
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: t('auth.error'),
        description: t('dashboard.errors.createProfile'),
        variant: "destructive",
      });
    } else {
      setUserProfile(data);
    }
  };

  const fetchPhones = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('phones')
      .select(`
        *,
        users!inner(name)
      `)
      .order('last_update', { ascending: false });

    if (error) {
      toast({
        title: t('auth.error'),
        description: t('dashboard.errors.fetchPhones'),
        variant: "destructive",
      });
    } else {
      setPhones(data || []);
    }
    
    setLoading(false);
  };

  const fetchTrackingData = async () => {
    if (!trackingDate || !startTime || !endTime) return;
    
    setLoading(true);
    try {
      const tracking: any = {};
      const targetPhones = selectedUserId ? phones.filter(phone => phone.user_id === selectedUserId) : phones;
      
      for (const phone of targetPhones) {
        // Create start and end datetime strings
        const startDateTime = new Date(trackingDate);
        const [startHours, startMinutes] = startTime.split(':');
        startDateTime.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0);
        
        const endDateTime = new Date(trackingDate);
        const [endHours, endMinutes] = endTime.split(':');
        endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
        
        try {
          // Fetch locations in the time range
          const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('phone_id', phone.id)
            .gte('timestamp', startDateTime.toISOString())
            .lte('timestamp', endDateTime.toISOString())
            .order('timestamp');
            
          if (error) {
            console.error(`Error fetching tracking data for phone ${phone.phone_id}:`, error);
          } else if (data && data.length >= 2) {
            tracking[phone.phone_id] = {
              startLocation: data[0],
              endLocation: data[data.length - 1],
              allLocations: data
            };
          }
        } catch (err) {
          console.error(`Error fetching tracking data for phone ${phone.phone_id}:`, err);
        }
      }
      
      setTrackingData(tracking);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      toast({
        title: t('auth.error'),
        description: t('dashboard.errors.fetchTracking'),
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const clearTrackingFilter = () => {
    setTrackingDate(null);
    setStartTime('08:00');
    setEndTime('18:00');
    setTrackingData({});
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('dashboard.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">{t('auth.title')}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSelector />
            <span className="text-sm text-muted-foreground">
              {t('dashboard.welcome')}, {userProfile.name} ({userProfile.role})
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {t('dashboard.signOut')}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">{t('dashboard.totalPhones')}</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold">{phones.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">{t('dashboard.activeUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold">
                {new Set(phones.map(p => p.user_id)).size}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">{t('dashboard.recentUpdates')}</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold">
                {phones.filter(p => {
                  const lastUpdate = new Date(p.last_update);
                  const now = new Date();
                  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                  return diffMinutes < 30;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t('dashboard.overview')}</TabsTrigger>
            {userProfile.role === 'admin' && (
              <TabsTrigger value="users">{t('dashboard.userManagement')}</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="overview">
            {/* User Filter for Admins */}
            {userProfile.role === 'admin' && (
              <div className="mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">{t('dashboard.filterByUser')}</span>
                  <UserSelector
                    selectedUserId={selectedUserId}
                    onUserSelect={setSelectedUserId}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Tracking Filter */}
            <div className="mb-4">
              <Collapsible open={isTrackingFilterOpen} onOpenChange={setIsTrackingFilterOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 mb-2">
                    Movement Tracking Filter
                    <ChevronDown className={`h-4 w-4 transition-transform ${isTrackingFilterOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <TrackingFilter
                    selectedDate={trackingDate}
                    startTime={startTime}
                    endTime={endTime}
                    onDateChange={setTrackingDate}
                    onStartTimeChange={setStartTime}
                    onEndTimeChange={setEndTime}
                    onApplyFilter={fetchTrackingData}
                    onClearFilter={clearTrackingFilter}
                    isLoading={loading}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
            
            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Phone List */}
              <div className="lg:col-span-1">
                <PhoneList
                  phones={selectedUserId ? phones.filter(phone => phone.user_id === selectedUserId) : phones}
                  selectedPhone={selectedPhone}
                  onSelectPhone={setSelectedPhone}
                  userRole={userProfile.role}
                  currentUserId={userProfile.id}
                  loading={loading}
                  onRefresh={fetchPhones}
                />
              </div>

              {/* Map */}
              <div className="lg:col-span-3">
                <GoogleMapView
                  selectedPhone={selectedPhone}
                  phones={selectedUserId ? phones.filter(phone => phone.user_id === selectedUserId) : phones}
                  trackingData={trackingData}
                />
              </div>
            </div>
          </TabsContent>
          
          {userProfile.role === 'admin' && (
            <TabsContent value="users">
              <div className="grid gap-6">
                <UserManagement />
                <PhoneManagement />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;