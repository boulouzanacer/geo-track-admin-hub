import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

export const SettingsPanel = ({ onSaved }: { onSaved?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [googleKey, setGoogleKey] = useState('');
  const [mapboxToken, setMapboxToken] = useState('');
  const [enableGoogleMaps, setEnableGoogleMaps] = useState(true);
  const [enableMapbox, setEnableMapbox] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshFromServer = async () => {
    try {
      let res = await fetch('/api/config/map-keys');
      if (!res.ok) {
        res = await fetch('http://localhost:5003/api/config/map-keys');
      }
      if (res.ok) {
        const data = await res.json();
        setGoogleKey(data.googleMapsKey || '');
        setMapboxToken(data.mapboxToken || '');
        setEnableGoogleMaps(typeof data.enableGoogleMaps === 'boolean' ? data.enableGoogleMaps : true);
        setEnableMapbox(typeof data.enableMapbox === 'boolean' ? data.enableMapbox : true);
      }
    } catch {}
  };

  useEffect(() => {
    refreshFromServer();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const payload = { googleMapsKey: googleKey, mapboxToken, enableGoogleMaps, enableMapbox };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      let res: Response | null = null;
      try {
        res = await fetch('/api/admin/config/map-keys', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      } catch (_) {
        res = null;
      }
      if (!res || !res.ok) {
        const res2 = await fetch('http://localhost:5003/api/admin/config/map-keys', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res2.ok) throw new Error(`Save failed (${res2.status})`);
      }
      toast({ title: 'Succès', description: 'Paramètres mis à jour.' });
      // Recharger depuis le serveur pour refléter l’état réellement persisté
      setRefreshing(true);
      await refreshFromServer();
      setRefreshing(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err?.message || 'Échec de la sauvegarde', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="rounded-xl border bg-white/80 dark:bg-neutral-900/70 backdrop-blur-xl p-4 text-center shadow-lg">
        <p className="font-medium mb-1">Accès refusé</p>
        <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent modifier les paramètres.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Paramètres</CardTitle>
          <CardDescription>Gérer les clés API Google Maps et Mapbox. Les clés doivent être restreintes par référent (localhost).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="enable-google">Activer Google Maps</Label>
                <div className="flex items-center gap-3">
                  <Switch id="enable-google" checked={enableGoogleMaps} onCheckedChange={setEnableGoogleMaps} disabled={loading || refreshing} />
                  <span className="text-sm text-muted-foreground">{enableGoogleMaps ? 'Activé' : 'Désactivé'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="enable-mapbox">Activer Mapbox</Label>
                <div className="flex items-center gap-3">
                  <Switch id="enable-mapbox" checked={enableMapbox} onCheckedChange={setEnableMapbox} disabled={loading || refreshing} />
                  <span className="text-sm text-muted-foreground">{enableMapbox ? 'Activé' : 'Désactivé'}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-key">Google Maps API Key</Label>
              <Input id="google-key" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="AIza..." disabled={loading || refreshing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapbox-token">Mapbox Access Token</Label>
              <Input id="mapbox-token" value={mapboxToken} onChange={(e) => setMapboxToken(e.target.value)} placeholder="pk.eyJ..." disabled={loading || refreshing} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || refreshing}>{loading ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
              {refreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="rechargement" />
                  Rechargement...
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;