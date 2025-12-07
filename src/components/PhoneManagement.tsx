import { useState, useEffect } from 'react';
// Supabase removed: use backend API endpoints
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Smartphone, Plus } from 'lucide-react';

interface Phone {
  id: string;
  phone_id: string;
  name: string;
  user_id: string;
  last_update: string;
  created_at: string;
  users?: {
    name: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
}

export const PhoneManagement = () => {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [filteredPhones, setFilteredPhones] = useState<Phone[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    phone_id: '',
    name: '',
    user_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPhones();
    fetchUsers();
  }, []);

  const fetchPhones = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/phones', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch phones');
      const data = await res.json();
      setPhones(Array.isArray(data) ? data : []);
      setFilteredPhones(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
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
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/phones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone_id: formData.phone_id,
          name: formData.name,
          user_id: formData.user_id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to add phone');
      }

      toast({
        title: "Success",
        description: "Phone added successfully!",
      });

      resetForm();
      fetchPhones();
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

  const handleDelete = async (phoneId: string) => {
    if (!confirm('Are you sure you want to delete this phone?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/phones/${phoneId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete phone');
      }

      toast({
        title: "Success",
        description: "Phone deleted successfully!",
      });

      fetchPhones();
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
      phone_id: '',
      name: '',
      user_id: ''
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredPhones(phones);
    } else {
      const filtered = phones.filter(phone => 
        phone.name.toLowerCase().includes(term.toLowerCase()) ||
        phone.phone_id.toLowerCase().includes(term.toLowerCase()) ||
        phone.users?.name.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredPhones(filtered);
    }
  };

  useEffect(() => {
    handleSearch(searchTerm);
  }, [phones]);

  if (loading && phones.length === 0) {
    return <div className="p-4">Loading phones...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Phone Management</CardTitle>
            <CardDescription>
              Manage phones assigned to users
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Phone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Phone</DialogTitle>
                <DialogDescription>
                  Add a new phone and assign it to a user.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_id">Phone ID</Label>
                  <Input
                    id="phone_id"
                    value={formData.phone_id}
                    onChange={(e) => setFormData({ ...formData, phone_id: e.target.value })}
                    placeholder="Enter unique phone identifier"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Phone Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., John's iPhone"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_id">Assign to User</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    {loading ? 'Adding...' : 'Add Phone'}
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
              placeholder="Search by name, phone ID, or owner..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {filteredPhones.map((phone) => (
            <div
              key={phone.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium">{phone.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    ID: {phone.phone_id} • Owner: {phone.users?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(phone.created_at).toLocaleDateString()}
                  </p>
                  {phone.last_update && (
                    <p className="text-xs text-muted-foreground">
                      Last update: {new Date(phone.last_update).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(phone.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {filteredPhones.length === 0 && phones.length > 0 && (
            <p className="text-center text-muted-foreground py-8">
              No phones match your search criteria.
            </p>
          )}
          {phones.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No phones found. Add your first phone to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
