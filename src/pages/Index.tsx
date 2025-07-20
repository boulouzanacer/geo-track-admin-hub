import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Smartphone, Users, Shield } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <MapPin className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Geo Track Admin Hub</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Professional location tracking and fleet management system
          </p>
          <Button onClick={() => navigate('/auth')} size="lg">
            Get Started
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-center">Real-time Tracking</CardTitle>
              <CardDescription className="text-center">
                Monitor phone locations in real-time with automatic updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Live location updates</li>
                <li>• Historical tracking data</li>
                <li>• Offline status monitoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-center">User Management</CardTitle>
              <CardDescription className="text-center">
                Manage users and their associated devices with role-based access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Add/edit/delete users</li>
                <li>• Device assignment</li>
                <li>• Role-based permissions</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-center">Admin Dashboard</CardTitle>
              <CardDescription className="text-center">
                Comprehensive admin interface for complete system control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Interactive map view</li>
                <li>• Device management</li>
                <li>• Analytics dashboard</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to start tracking?</h2>
          <p className="text-muted-foreground mb-8">
            Sign in to access your dashboard or create a new account
          </p>
          <div className="space-x-4">
            <Button onClick={() => navigate('/auth')} variant="outline">
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth')}>
              Create Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
