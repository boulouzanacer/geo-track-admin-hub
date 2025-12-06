import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Users, Smartphone, LogOut, Bell, Menu, ChevronLeft, ChevronRight, Search, Settings, Filter, X, ListChecks } from 'lucide-react';
import GoogleMapView from '@/components/GoogleMapView';
import MapView from '@/components/MapView';
import PhoneList from '@/components/PhoneList';
import { UserManagement } from '@/components/UserManagement';
import { PhoneManagement } from '@/components/PhoneManagement';
import SettingsPanel from '@/components/SettingsPanel';
import { UserSelector } from '@/components/UserSelector';
import LanguageSelector from '@/components/LanguageSelector';
import { Input } from '@/components/ui/input';
// Badge removed; using diagonal ribbon style for BON status

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
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<Phone | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [resizeTick, setResizeTick] = useState(0);
  const [quickFilter, setQuickFilter] = useState<'all'|'active'|'offline'|'recent30'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [managementTab, setManagementTab] = useState<'users'|'phones'|'settings'>('users');
  const [trackingEnabled, setTrackingEnabled] = useState<Record<string, boolean>>({});
  const [mapConfig, setMapConfig] = useState<{ googleMapsKey?: string; mapboxToken?: string; enableGoogleMaps?: boolean; enableMapbox?: boolean }>({});
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  // BON (sales/commandes) UI state
  const [bonType, setBonType] = useState<'ventes'|'commandes'|null>(null);
  const [bonList, setBonList] = useState<any[]>([]);
  const [bonLoading, setBonLoading] = useState(false);
  const [selectedBonNum, setSelectedBonNum] = useState<string | null>(null);
  const [bonDetails, setBonDetails] = useState<{ header: any | null; items: any[] } | null>(null);

  const fetchMapConfig = async () => {
    try {
      let res = await fetch('/api/config/map-keys');
      if (!res.ok) {
        res = await fetch('http://localhost:5003/api/config/map-keys');
      }
      if (res.ok) {
        const data = await res.json();
        setMapConfig({
          googleMapsKey: (Object.prototype.hasOwnProperty.call(data, 'googleMapsKey') ? data.googleMapsKey : import.meta.env.VITE_GOOGLE_MAPS_KEY),
          mapboxToken: (Object.prototype.hasOwnProperty.call(data, 'mapboxToken') ? data.mapboxToken : import.meta.env.VITE_MAPBOX_TOKEN),
          enableGoogleMaps: typeof data.enableGoogleMaps === 'boolean' ? data.enableGoogleMaps : true,
          enableMapbox: typeof data.enableMapbox === 'boolean' ? data.enableMapbox : true,
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (user) {
      // Build profile from backend auth user (clients table)
      const role = user.is_admin ? 'admin' : 'user';
      setUserProfile({ id: String(user.id), name: user.name, email: '', role });
      fetchPhones();
      fetchMapConfig();
    }
  }, [user]);

  // Removed Supabase-backed profile creation; profile is derived from auth user

  const fetchPhones = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/phones');
      if (!res.ok) throw new Error('Failed to fetch phones');
      const data = await res.json();
      setPhones(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: t('auth.error'),
        description: t('dashboard.errors.fetchPhones'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBonList = async (type: 'ventes'|'commandes', phoneId: string) => {
    setBonLoading(true);
    setBonType(type);
    setSelectedBonNum(null);
    setBonDetails(null);
    try {
      const url = type === 'ventes' ? `/api/bon/ventes?phone_id=${encodeURIComponent(phoneId)}` : `/api/bon/commandes?phone_id=${encodeURIComponent(phoneId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        let msg = 'Failed to fetch bons';
        try {
          const errBody = await res.json();
          if (errBody && errBody.error) msg = errBody.error;
        } catch (_) {}
        throw new Error(msg);
      }
      const rows = await res.json();
      setBonList(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible de charger les bons', variant: 'destructive' });
    } finally {
      setBonLoading(false);
    }
  };

  const fetchBonDetails = async (type: 'ventes'|'commandes', numBon: string) => {
    setBonLoading(true);
    setSelectedBonNum(numBon);
    try {
      const url = type === 'ventes' ? `/api/bon/ventes/${encodeURIComponent(numBon)}` : `/api/bon/commandes/${encodeURIComponent(numBon)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch bon details');
      const payload = await res.json();
      setBonDetails({ header: payload?.header || null, items: Array.isArray(payload?.items) ? payload.items : [] });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible de charger les détails', variant: 'destructive' });
    } finally {
      setBonLoading(false);
    }
  };


  const handleSignOut = async () => {
    await signOut();
  };

  // Derived phones by ownership and quick filter
  // Non-admin users should only see their own phones
  const ownershipFiltered = (!userProfile || userProfile.role === 'admin')
    ? (selectedUserId ? phones.filter(p => String(p.user_id) === String(selectedUserId)) : phones)
    : phones.filter(p => String(p.user_id) === String(userProfile.id));

  const filteredPhones = ownershipFiltered.filter(p => {
    const lastUpdate = new Date(p.last_update);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    if (quickFilter === 'active') return diffMinutes < 30;
    if (quickFilter === 'offline') return diffMinutes >= 30;
    if (quickFilter === 'recent30') return diffMinutes < 30;
    return true;
  });

  // Status summary
  const summary = {
    total: filteredPhones.length,
    active: filteredPhones.filter(p => ((new Date().getTime() - new Date(p.last_update).getTime()) / (1000*60)) < 30).length,
    offline: filteredPhones.filter(p => ((new Date().getTime() - new Date(p.last_update).getTime()) / (1000*60)) >= 30).length,
    recent30: filteredPhones.filter(p => ((new Date().getTime() - new Date(p.last_update).getTime()) / (1000*60)) < 30).length,
  };

  // Map provider availability and preferences from config/env
  const googleKey = (mapConfig.googleMapsKey as string | undefined) || (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined);
  const mapboxToken = (mapConfig.mapboxToken as string | undefined) || (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined);
  const allowGoogle = mapConfig.enableGoogleMaps !== false;
  const allowMapbox = mapConfig.enableMapbox !== false;

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
    <div className="relative min-h-screen">
      {/* Full-screen Map Background honoring provider preferences */}
      {allowGoogle && googleKey ? (
        <GoogleMapView
          fullScreen
          resizeSignal={resizeTick}
          selectedPhone={selectedPhone}
          phones={filteredPhones}
          trackingData={{}}
        />
      ) : allowMapbox && mapboxToken ? (
        <MapView
          fullScreen
          resizeSignal={resizeTick}
          selectedPhone={selectedPhone}
          phones={filteredPhones}
          trackingData={{}}
        />
      ) : allowGoogle && !googleKey && !allowMapbox ? (
        // Google only enabled but key missing -> show helper
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border bg-white/80 dark:bg-neutral-900/70 backdrop-blur-xl p-4 text-center shadow-lg">
            <p className="font-medium mb-1">Google Maps non configuré</p>
            <p className="text-sm text-muted-foreground">Ajoutez `VITE_GOOGLE_MAPS_KEY` ou configurez la clé dans Paramètres.</p>
          </div>
        </div>
      ) : allowMapbox && !mapboxToken && !allowGoogle ? (
        // Mapbox only enabled but token missing -> show helper
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border bg-white/80 dark:bg-neutral-900/70 backdrop-blur-xl p-4 text-center shadow-lg">
            <p className="font-medium mb-1">Mapbox non configuré</p>
            <p className="text-sm text-muted-foreground">Ajoutez `VITE_MAPBOX_TOKEN` ou configurez le token dans Paramètres.</p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border bg-white/80 dark:bg-neutral-900/70 backdrop-blur-xl p-4 text-center shadow-lg">
            <p className="font-medium mb-1">Map not configured</p>
            <p className="text-sm text-muted-foreground">Add `VITE_GOOGLE_MAPS_KEY` or `VITE_MAPBOX_TOKEN` to `.env` and restart the dev server.</p>
          </div>
        </div>
      )}

      {/* Top Overlay Bar */}
      <header className="fixed top-4 left-4 right-4 z-20">
        <div className="flex items-center justify-between rounded-2xl border shadow-lg backdrop-blur-xl transition-all bg-white/70 dark:bg-neutral-900/60 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-3">
            <Menu className="h-5 w-5 text-muted-foreground" />
            <MapPin className="h-6 w-6 text-primary" />
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <a className="font-medium text-foreground/90 hover:text-foreground" href="#">Dashboard</a>
              {userProfile.role === 'admin' && (
                <button
                  type="button"
                  className="font-medium text-foreground/90 hover:text-foreground"
                  onClick={() => { setManagementOpen(true); setManagementTab('users'); setDrawerOpen(false); setResizeTick(t=>t+1); }}
                >Manage</button>
              )}
              {/* Settings button removed to avoid duplication; use Manage → Settings */}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex rounded-full bg-white/40 dark:bg-neutral-800/40">
              <Bell className="h-5 w-5" />
            </Button>
            {/* Quick filter chips */}
            <div className="hidden lg:flex items-center gap-2 mx-2">
              <Button variant={quickFilter==='all'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('all'); setResizeTick(t=>t+1);}}>All</Button>
              <Button variant={quickFilter==='active'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('active'); setResizeTick(t=>t+1);}}>Active</Button>
              <Button variant={quickFilter==='offline'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('offline'); setResizeTick(t=>t+1);}}>Offline</Button>
              <Button variant={quickFilter==='recent30'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('recent30'); setResizeTick(t=>t+1);}}>Updated &lt; 30m</Button>
            </div>
            <span className="hidden sm:block text-sm text-foreground/90">
              {t('dashboard.welcome')}, {userProfile.name} ({userProfile.role})
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:inline-flex rounded-full">
              <LogOut className="h-4 w-4 mr-2" />
              {t('dashboard.signOut')}
            </Button>
          </div>
        </div>
      </header>

      {/* Left Overlay Panel */}
      <aside className={`fixed z-20 top-20 left-4 bottom-4 transition-all ${sidebarOpen ? 'w-80' : 'w-14'} hidden sm:block`}>
        <div className="h-full rounded-2xl border shadow-lg backdrop-blur-xl bg-white/70 dark:bg-neutral-900/60 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSidebarOpen(v => !v); setResizeTick(t => t + 1); }}
              className="rounded-full"
              aria-label={sidebarOpen ? 'Collapse panel' : 'Expand panel'}
            >
              {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </Button>
            {sidebarOpen && (
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('dashboard.searchDevices') || 'Search devices'}
                  className="pl-8 rounded-full bg-white/60 dark:bg-neutral-800/60"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {sidebarOpen && userProfile.role === 'admin' && (
              <Card className="bg-white/50 dark:bg-neutral-800/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('dashboard.filterByUser')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <UserSelector
                    selectedUserId={selectedUserId}
                    onUserSelect={setSelectedUserId}
                    disabled={loading}
                  />
                </CardContent>
              </Card>
            )}

            {sidebarOpen && (
              <PhoneList
                phones={filteredPhones}
                selectedPhone={selectedPhone}
                onSelectPhone={(p) => { setSelectedPhone(p); setDrawerOpen(true); setResizeTick(t => t + 1); }}
                userRole={userProfile.role}
                currentUserId={userProfile.id}
                loading={loading}
                onRefresh={fetchPhones}
              />
            )}
          </div>
        </div>
      </aside>

      {/* Pinned overlays: Status summary & active filters */}
      <div className="hidden md:flex fixed bottom-4 left-4 z-20 flex-col gap-3">
        <div className="rounded-xl border shadow-lg backdrop-blur-xl bg-white/70 dark:bg-neutral-900/60 px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Status Summary</div>
          <div className="flex items-center gap-4 text-sm">
            <span>Total: <strong>{summary.total}</strong></span>
            <span>Active: <strong className="text-green-600">{summary.active}</strong></span>
            <span>Offline: <strong className="text-red-600">{summary.offline}</strong></span>
          </div>
        </div>
        <div className="rounded-xl border shadow-lg backdrop-blur-xl bg-white/70 dark:bg-neutral-900/60 px-4 py-2 text-sm">
          <span className="text-xs text-muted-foreground mr-2">Active Filter:</span>
          <span className="font-medium">{quickFilter === 'recent30' ? 'Updated < 30m' : quickFilter.charAt(0).toUpperCase() + quickFilter.slice(1)}</span>
        </div>
      </div>

      {/* Right-hand details drawer */}
      <div className={`fixed top-20 right-4 bottom-4 z-20 transition-all ${drawerOpen ? 'w-96' : 'w-0'} overflow-hidden`}>
        <div className="h-full rounded-2xl border shadow-lg backdrop-blur-xl bg-white/70 dark:bg-neutral-900/60 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="font-semibold">Device Details</div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={()=>{ setDrawerOpen(false); setResizeTick(t=>t+1); }}>Close</Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedPhone ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="text-muted-foreground">Name</div>
                  <div className="font-medium truncate" title={selectedPhone.name}>{selectedPhone.name}</div>
                  <div className="text-muted-foreground">ID</div>
                  <div className="font-medium break-all">{selectedPhone.phone_id}</div>
                  <div className="text-muted-foreground">Last Update</div>
                  <div className="font-medium">{new Date(selectedPhone.last_update).toLocaleString()}</div>
                  {selectedPhone.users && (
                    <>
                      <div className="text-muted-foreground">Owner</div>
                      <div className="font-medium truncate" title={selectedPhone.users.name}>{selectedPhone.users.name}</div>
                    </>
                  )}
                </div>
                <div className="pt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={()=>{ setResizeTick(t=>t+1); }}>Center Map</Button>
                  <Button size="sm" variant={trackingEnabled[selectedPhone.phone_id] ? 'destructive' : 'default'} onClick={()=>{
                    setTrackingEnabled(prev=>({ ...prev, [selectedPhone.phone_id]: !prev[selectedPhone.phone_id] }));
                  }}>
                    {trackingEnabled[selectedPhone.phone_id] ? 'Stop Tracking' : 'Start Tracking'}
                  </Button>
                </div>

                {/* BON actions */}
                <div className="pt-3 border-t mt-3">
                  <div className="text-xs text-muted-foreground mb-2">Bons</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={bonType==='ventes' ? 'secondary' : 'outline'} onClick={() => fetchBonList('ventes', selectedPhone.phone_id)}>Ventes</Button>
                    <Button size="sm" variant={bonType==='commandes' ? 'secondary' : 'outline'} onClick={() => fetchBonList('commandes', selectedPhone.phone_id)}>Commande</Button>
                    {bonType && (
                      <Button size="sm" variant="ghost" onClick={() => { setBonType(null); setBonList([]); setBonDetails(null); setSelectedBonNum(null); }}>Clear</Button>
                    )}
                  </div>
                </div>

                {/* BON list & details */}
                {bonType && (
                  <div className="mt-3">
                    {!selectedBonNum ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" /> Liste des bons ({bonList.length})</div>
                          {bonLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
                        </div>
                        {bonList.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Aucun bon trouvé pour cet appareil.</div>
                        ) : (
                          <div className="space-y-2">
                            {bonList.map((b: any) => (
                              <div
                                key={b.NUM_BON}
                                className="relative p-3 pb-7 rounded-lg border bg-white/70 dark:bg-neutral-800/60 cursor-pointer hover:border-primary hover:shadow-sm transition"
                                onClick={() => fetchBonDetails(bonType!, String(b.NUM_BON))}
                              >
                                <div className={`ribbon-horizontal ${b.BLOCAGE === 'F' ? 'ribbon-horizontal-green' : 'ribbon-horizontal-red'}`}>
                                  {b.BLOCAGE === 'F' ? 'Validé' : 'En attente'}
                                </div>
                                <div className="grid grid-cols-12 gap-2">
                                  <div className="col-span-7 min-w-0">
                                    <div className="text-sm font-semibold truncate">Bon N° {b.NUM_BON}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {b.DATE_BON || ''} {b.HEURE || ''}
                                    </div>
                                  </div>
                                  <div className="col-span-5 text-right">
                                    <div className="text-sm font-medium whitespace-nowrap">
                                      {(b.TOT_HT ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} DA
                                    </div>
                                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">{b.CODE_DEPOT || ''}</div>
                                  </div>
                                </div>
                                {(b.NOM_CLIENT || b.CLIENT || b.CODE_CLIENT) && (
                                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2 max-w-[220px] md:max-w-[260px]">Client: {b.NOM_CLIENT || b.CLIENT || b.CODE_CLIENT}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">Détails bon: {selectedBonNum}</div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedBonNum(null); setBonDetails(null); }}>Back</Button>
                            {bonLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
                          </div>
                        </div>
                        {bonDetails?.header && (
                          <div className="mb-3 p-3 rounded-lg border bg-white/70 dark:bg-neutral-800/60">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">Détails bon: {selectedBonNum}</div>
                              <span className={`px-2 py-1 text-[11px] font-semibold rounded-md ${bonDetails.header.BLOCAGE === 'F' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                {bonDetails.header.BLOCAGE === 'F' ? 'Validé' : 'En attente'}
                              </span>
                            </div>
                            <div className="mt-2 text-xs flex flex-col gap-y-1 md:grid md:grid-cols-2 md:gap-4">
                              <div className="md:col-span-1 flex flex-col gap-y-1">
                                <div className="flex items-center gap-x-2">
                                  <span className="font-medium">Dépôt:</span>
                                  <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{bonDetails.header.CODE_DEPOT || '-'}</span>
                                </div>
                                {bonDetails.header.CODE_VENDEUR && (
                                  <div className="flex items-center gap-x-2">
                                    <span className="font-medium">Vendeur:</span>
                                    <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground truncate max-w-[120px]">{bonDetails.header.CODE_VENDEUR}</span>
                                  </div>
                                )}
                              </div>
                              <div className="md:col-span-1 flex flex-wrap items-center gap-x-2 gap-y-1 md:justify-end">
                                <span className="font-medium">Client:</span>
                                <span className="line-clamp-2 max-w-[220px] md:max-w-[280px]">{bonDetails.header.NOM_CLIENT || bonDetails.header.CLIENT || bonDetails.header.CODE_CLIENT || '-'}</span>
                                <span>•</span>
                                <span className="font-medium">Date:</span>
                                <span>{bonDetails.header.DATE_BON || ''} {bonDetails.header.HEURE || ''}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="max-h-72 overflow-y-auto">
                          <div className="text-xs font-medium text-muted-foreground sticky top-0 bg-white/80 dark:bg-neutral-900/70 backdrop-blur px-2 py-1 border-b">Produits</div>
                          <div className="divide-y">
                            {(bonDetails?.items || []).map((it: any, idx: number) => (
                              <div key={`${selectedBonNum}-${idx}`} className="px-2 py-2 bg-white/60 dark:bg-neutral-800/60">
                                <div className="grid grid-cols-12 items-center">
                                  <div className="col-span-7 text-sm font-medium truncate" title={it.PRODUIT || it.CODE_BARRE || 'Produit'}>{it.PRODUIT || it.CODE_BARRE || 'Produit'}</div>
                                  <div className="col-span-2 text-xs text-muted-foreground text-right">{it.QTE ?? 0}</div>
                                  <div className="col-span-3 text-sm font-semibold text-right">{(it.PV_HT ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="text-muted-foreground">Total TTC</div>
                          <div className="text-right font-medium">
                            {(((bonDetails?.header?.TOT_HT ?? 0) + (bonDetails?.header?.TOT_TVA ?? 0) + (bonDetails?.header?.TIMBRE ?? 0) - (bonDetails?.header?.REMISE ?? 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} DA
                          </div>
                          <div className="text-muted-foreground">Remise</div>
                          <div className="text-right">
                            {(bonDetails?.header?.REMISE ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} DA
                          </div>
                          <div className="text-muted-foreground">TTC à payer</div>
                          <div className="text-right font-semibold">
                            {(((bonDetails?.header?.TOT_HT ?? 0) + (bonDetails?.header?.TOT_TVA ?? 0) + (bonDetails?.header?.TIMBRE ?? 0) - (bonDetails?.header?.REMISE ?? 0) - (bonDetails?.header?.VERSER ?? 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} DA
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Select a device to view details</div>
            )}
          </div>
        </div>
      </div>
      {/* Admin Management Drawer (Users / Phones) */}
      {userProfile.role === 'admin' && (
        <div className={`fixed top-20 right-4 bottom-4 z-30 transition-all ${managementOpen ? 'w-[36rem]' : 'w-0'} overflow-hidden`}>
          <div className="h-full rounded-2xl border shadow-lg backdrop-blur-xl bg-white/70 dark:bg-neutral-900/60 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <Button
                  variant={managementTab==='users'?'secondary':'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={()=> setManagementTab('users')}
                >Users</Button>
                <Button
                  variant={managementTab==='phones'?'secondary':'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={()=> setManagementTab('phones')}
                >Phones</Button>
                <Button
                  variant={managementTab==='settings'?'secondary':'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={()=> setManagementTab('settings')}
                >Settings</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={()=>{ setManagementOpen(false); setResizeTick(t=>t+1); }}>Close</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {managementTab==='users' ? (
                <UserManagement />
              ) : managementTab==='phones' ? (
                <PhoneManagement />
              ) : (
                <SettingsPanel onSaved={fetchMapConfig} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-3 mb-3 rounded-2xl border shadow-lg backdrop-blur-xl bg-white/80 dark:bg-neutral-900/70 p-2 flex items-center justify-around">
          <Button variant="ghost" className="flex flex-col items-center gap-1" onClick={()=> setMobileListOpen(true)}>
            <Smartphone className="h-5 w-5" />
            <span className="text-xs">Phones</span>
          </Button>
          <Button variant="ghost" className="flex flex-col items-center gap-1" onClick={()=> setShowMobileFilters(v=>!v)}>
            <Filter className="h-5 w-5" />
            <span className="text-xs">Filter</span>
          </Button>
          {userProfile.role === 'admin' ? (
            <Button variant="ghost" className="flex flex-col items-center gap-1" onClick={()=> { setManagementOpen(true); setManagementTab('users'); }}>
              <Users className="h-5 w-5" />
              <span className="text-xs">Manage</span>
            </Button>
          ) : (
            <Button variant="ghost" className="flex flex-col items-center gap-1" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
              <span className="text-xs">Sign out</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Filters Panel */}
      {showMobileFilters && (
        <div className="sm:hidden fixed bottom-20 left-0 right-0 z-30">
          <div className="mx-3 rounded-2xl border shadow-lg backdrop-blur-xl bg-white/90 dark:bg-neutral-900/70 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Filters</div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={()=> setShowMobileFilters(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={quickFilter==='all'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('all'); setResizeTick(t=>t+1);}}>All</Button>
              <Button variant={quickFilter==='active'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('active'); setResizeTick(t=>t+1);}}>Active</Button>
              <Button variant={quickFilter==='offline'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('offline'); setResizeTick(t=>t+1);}}>Offline</Button>
              <Button variant={quickFilter==='recent30'?'secondary':'outline'} size="sm" className="rounded-full" onClick={()=>{setQuickFilter('recent30'); setResizeTick(t=>t+1);}}>Updated &lt; 30m</Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Phones Drawer */}
      {mobileListOpen && (
        <div className="sm:hidden fixed top-20 left-0 right-0 bottom-0 z-30">
          <div className="mx-3 mb-3 h-[calc(100%-1rem)] rounded-2xl border shadow-lg backdrop-blur-xl bg-white/90 dark:bg-neutral-900/70 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold">Devices</div>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={()=> setMobileListOpen(false)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <PhoneList
                phones={filteredPhones}
                selectedPhone={selectedPhone}
                onSelectPhone={(p) => { setSelectedPhone(p); setMobileListOpen(false); setDrawerOpen(true); setResizeTick(t=>t+1); }}
                userRole={userProfile.role}
                currentUserId={userProfile.id}
                loading={loading}
                onRefresh={fetchPhones}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
