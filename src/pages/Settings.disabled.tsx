import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [googleKey, setGoogleKey] = useState('');
  const [mapboxToken, setMapboxToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!user.is_admin) {
      navigate('/dashboard');
      return;
    }
    (async () => {
      try {
        // Try via dev proxy first
        let res = await fetch('/api/config/map-keys');
        if (!res.ok) {
          // Fallback directly to backend if proxy is misconfigured
          res = await fetch('http://localhost:5003/api/config/map-keys');
        }
        if (res.ok) {
          const data = await res.json();
          setGoogleKey(data.googleMapsKey || '');
          setMapboxToken(data.mapboxToken || '');
        }
      } catch {}
    })();
  }, [user, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const payload = { googleMapsKey: googleKey, mapboxToken };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Try via dev proxy first
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

      // Fallback directly to backend if proxy fails or returns 404
      if (!res || !res.ok) {
        const res2 = await fetch('http://localhost:5003/api/admin/config/map-keys', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res2.ok) throw new Error(`Save failed (${res2.status})`);
      }

      // Rafraîchir depuis le serveur pour refléter l’état réellement persisté
      try {
        setRefreshing(true);
        let getRes = await fetch('/api/config/map-keys');
        if (!getRes.ok) {
          getRes = await fetch('http://localhost:5003/api/config/map-keys');
        }
        if (getRes.ok) {
          const data = await getRes.json();
          setGoogleKey(data.googleMapsKey || '');
          setMapboxToken(data.mapboxToken || '');
        }
      } catch {}
      finally {
        setRefreshing(false);
      }

      toast({ title: 'Succès', description: 'Paramètres mis à jour.' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err?.message || 'Échec de la sauvegarde', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Paramètres</CardTitle>
          <CardDescription>Gérer les clés API Google Maps et Mapbox. Les clés doivent être restreintes par référent (localhost).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="google-key">Google Maps API Key</Label>
              <Input id="google-key" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="AIza..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapbox-token">Mapbox Access Token</Label>
              <Input id="mapbox-token" value={mapboxToken} onChange={(e) => setMapboxToken(e.target.value)} placeholder="pk.eyJ..." />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || refreshing}>{loading ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
              {refreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="rechargement" />
                  Rechargement...
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>Retour au tableau de bord</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;