import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, UserPlus, Edit } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  auth_user_id?: string;
  start_time?: string;
  end_time?: string;
  enabled?: boolean;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
    password: '',
    start_time: '',
    end_time: '',
    enabled: true
  });
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        // Update existing user via edge function
        const { data, error } = await supabase.functions.invoke('admin-user-management?action=update', {
          body: {
            userId: editingUser.id,
            name: formData.name,
            email: formData.email,
            role: formData.role,
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
            enabled: formData.enabled
          }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast({
          title: "Success",
          description: "User updated successfully!",
        });
      } else {
        // Create new user via edge function
        const { data, error } = await supabase.functions.invoke('admin-user-management?action=create', {
          body: {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role,
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
            enabled: formData.enabled
          }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast({
          title: "Success",
          description: "User created successfully!",
        });
      }

      resetForm();
      fetchUsers();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, enabled: boolean) => {
    // Find the user to check if they're an admin
    const user = users.find(u => u.id === userId);
    
    // Prevent disabling admin users
    if (user?.role === 'admin' && !enabled) {
      toast({
        title: "Error",
        description: "Admin users cannot be disabled",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management?action=update', {
        body: {
          userId,
          enabled
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `User ${enabled ? 'enabled' : 'disabled'} successfully!`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: string, authUserId?: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management?action=delete', {
        body: {
          userId,
          authUserId
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: "User deleted successfully!",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'user',
      password: '',
      start_time: '',
      end_time: '',
      enabled: true
    });
    setEditingUser(null);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      start_time: user.start_time ? new Date(user.start_time).toISOString().slice(0, 16) : '',
      end_time: user.end_time ? new Date(user.end_time).toISOString().slice(0, 16) : '',
      enabled: user.enabled !== false // Fix: properly handle the enabled state
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(term.toLowerCase()) ||
        user.email.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  };

  useEffect(() => {
    handleSearch(searchTerm);
  }, [users]);

  if (loading && users.length === 0) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage system users and their roles
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Edit User' : 'Add New User'}
                </DialogTitle>
                <DialogDescription>
                  {editingUser 
                    ? 'Update user information and role.'
                    : 'Create a new user account with email and password.'
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                    disabled={editingUser?.role === 'admin'}
                  />
                  <Label htmlFor="enabled">User Enabled</Label>
                  {editingUser?.role === 'admin' && (
                    <span className="text-xs text-muted-foreground">(Admin users cannot be disabled)</span>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : editingUser ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="mb-4">
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{user.name}</h4>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    user.enabled !== false
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.enabled !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(user.created_at).toLocaleDateString()}
                </p>
                {user.start_time && (
                  <p className="text-xs text-muted-foreground">
                    Start: {new Date(user.start_time).toLocaleString()}
                  </p>
                )}
                {user.end_time && (
                  <p className="text-xs text-muted-foreground">
                    End: {new Date(user.end_time).toLocaleString()}
                  </p>
                )}
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {user.role}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={user.enabled !== false}
                    onCheckedChange={(checked) => handleToggleUserStatus(user.id, checked)}
                    disabled={loading || user.role === 'admin'}
                  />
                  <span className="text-sm text-muted-foreground">
                    {user.enabled !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditDialog(user)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {user.auth_user_id !== currentUser?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(user.id, user.auth_user_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && users.length > 0 && (
            <p className="text-center text-muted-foreground py-8">
              No users match your search criteria.
            </p>
          )}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No users found. Add your first user to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};