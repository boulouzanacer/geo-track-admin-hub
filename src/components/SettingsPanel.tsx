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
  const [mapDefaultZoom, setMapDefaultZoom] = useState<number>(10);
  const [bonCumulate, setBonCumulate] = useState<boolean>(false);
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
        const z = Number.isFinite(Number(data.mapDefaultZoom)) ? Math.round(Number(data.mapDefaultZoom)) : 10;
        setMapDefaultZoom(Math.max(1, Math.min(20, z)));
        setBonCumulate(typeof data.bonCumulate === 'boolean' ? data.bonCumulate : false);
      }
    } catch {}
  };

  useEffect(() => {
    (async () => {
      setRefreshing(true);
      try {
        await refreshFromServer();
      } finally {
        setRefreshing(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      // IMPORTANT: do NOT include bonCumulate in bulk save to avoid overwriting
      // It is persisted via the dedicated toggle handler (saveBonCumulate)
      const payload = { googleMapsKey: googleKey, mapboxToken, enableGoogleMaps, enableMapbox, mapDefaultZoom };
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

  // Save only bonCumulate when toggle changes, to avoid surprises after refresh
  const saveBonCumulate = async (value: boolean) => {
    // Optimistic update to avoid flicker
    setBonCumulate(value);
    setRefreshing(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      // Persist just the changed flag
      let res: Response | null = null;
      try {
        res = await fetch('/api/admin/config/map-keys', {
          method: 'POST',
          headers,
          body: JSON.stringify({ bonCumulate: value }),
        });
      } catch (_) {
        res = null;
      }
      if (!res || !res.ok) {
        const res2 = await fetch('http://localhost:5003/api/admin/config/map-keys', {
          method: 'POST',
          headers,
          body: JSON.stringify({ bonCumulate: value }),
        });
        if (!res2.ok) throw new Error(`Save failed (${res2.status})`);
        // Prefer value returned by API if provided
        let body2: any = null;
        try { body2 = await res2.json(); } catch { body2 = null; }
        const persisted2 = (body2 && body2.config && typeof body2.config.bonCumulate === 'boolean') ? body2.config.bonCumulate : value;
        setBonCumulate(persisted2);
      } else {
        // Prefer value returned by API if provided
        let body: any = null;
        try { body = await res.json(); } catch { body = null; }
        const persisted = (body && body.config && typeof body.config.bonCumulate === 'boolean') ? body.config.bonCumulate : value;
        setBonCumulate(persisted);
      }
      toast({ title: 'Succès', description: 'Paramètre cumuler/supprimer enregistré.' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err?.message || 'Échec de la sauvegarde du paramètre', variant: 'destructive' });
      // Roll back optimistic update only if we know it failed
      setBonCumulate((prev) => prev); // keep current state
    } finally {
      setRefreshing(false);
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
            <div className="space-y-2 pt-2">
              <Label htmlFor="map-default-zoom">Zoom de la carte (1–20)</Label>
              <Input
                id="map-default-zoom"
                type="number"
                min={1}
                max={20}
                value={mapDefaultZoom}
                onChange={(e) => {
                  const val = Math.round(Number(e.target.value));
                  if (!Number.isFinite(val)) return;
                  setMapDefaultZoom(Math.max(1, Math.min(20, val)));
                }}
                disabled={loading || refreshing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bon-cumulate">Cumuler les bon ?</Label>
              <div className="flex items-center gap-3">
                <Switch
                  id="bon-cumulate"
                  checked={bonCumulate}
                  onCheckedChange={saveBonCumulate}
                  disabled={loading || refreshing}
                />
                <span className="text-sm text-muted-foreground">
                  {bonCumulate ? 'Cumuler les bons (ne pas supprimer)' : 'Réinitialiser: supprimer les anciens'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Activer pour conserver les anciens bons lors des synchronisations. Désactiver pour supprimer les anciens bons avant d’ajouter les nouveaux.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
