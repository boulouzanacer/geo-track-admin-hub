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
import LanguageSelector from '@/components/LanguageSelector';

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
  const [loading, setLoading] = useState(true);

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

        {/* Main Layout with Sidebar and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Tabs */}
          <div className="lg:col-span-1">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-1 gap-1 h-auto">
                <TabsTrigger value="overview" className="justify-start">{t('dashboard.overview')}</TabsTrigger>
                {userProfile.role === 'admin' && (
                  <TabsTrigger value="users" className="justify-start">{t('dashboard.userManagement')}</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                {/* User Filter for Admins */}
                {userProfile.role === 'admin' && (
                  <div className="mb-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t('dashboard.filterByUser')}</span>
                      <UserSelector
                        selectedUserId={selectedUserId}
                        onUserSelect={setSelectedUserId}
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}
                
                {/* Phone List */}
                <PhoneList
                  phones={selectedUserId ? phones.filter(phone => phone.user_id === selectedUserId) : phones}
                  selectedPhone={selectedPhone}
                  onSelectPhone={setSelectedPhone}
                  userRole={userProfile.role}
                  currentUserId={userProfile.id}
                  loading={loading}
                  onRefresh={fetchPhones}
                />
              </TabsContent>
              
              {userProfile.role === 'admin' && (
                <TabsContent value="users" className="space-y-4">
                  <div className="space-y-6">
                    <UserManagement />
                    <PhoneManagement />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Right Side - Map */}
          <div className="lg:col-span-3">
            <GoogleMapView
              selectedPhone={selectedPhone}
              phones={selectedUserId ? phones.filter(phone => phone.user_id === selectedUserId) : phones}
              trackingData={{}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;