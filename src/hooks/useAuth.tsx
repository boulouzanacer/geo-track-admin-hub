import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ClientUser = {
  id: number;
  name: string;
  statut?: string;
  expire_date?: string | null;
  is_admin?: boolean;
};

interface AuthContextType {
  user: ClientUser | null;
  signIn: (username: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch user');
        const data = await res.json();
        setUser(data);
      } catch (e) {
        localStorage.removeItem('auth_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      // Safely parse JSON; if not JSON, fallback to text to avoid "Unexpected end of JSON input"
      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {
        const text = await res.text().catch(() => '');
        data = text ? { error: text } : {};
      }
      if (!res.ok) {
        const msg = (data && typeof data === 'object' && data.error) ? data.error : `Login failed (${res.status})`;
        return { error: { message: msg } };
      }
      if (data?.token) localStorage.setItem('auth_token', data.token);
      setUser(data?.user || null);
      return {};
    } catch (err: any) {
      return { error: { message: err?.message || 'Unknown error' } };
    }
  };

  // SignUp is not supported via UI; return an error to keep existing call safe
  const signUp = async (_email: string, _password: string, _name: string) => {
    return { error: { message: 'Signup disabled. Please contact administrator.' } };
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const value = {
    user,
    signIn,
    signUp,
    signOut,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};