import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
// Supabase removed: use backend API endpoints
import { Edit, Trash2 } from 'lucide-react';

interface Phone {
  id: string;
  phone_id: string;
  name: string;
  user_id: string;
  last_update: string;
}

interface UserPhoneActionsProps {
  phone: Phone;
  onUpdate: () => void;
}

export const UserPhoneActions = ({ phone, onUpdate }: UserPhoneActionsProps) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [phoneName, setPhoneName] = useState(phone.name);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdatePhone = async () => {
    if (!phoneName.trim()) {
      toast({
        title: "Error",
        description: "Phone name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/phones/${phone.phone_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: phoneName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update phone');
      }

      toast({
        title: "Success",
        description: "Phone name updated successfully",
      });
      
      setEditDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating phone:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update phone name",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhone = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/phones/${phone.phone_id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete phone');
      }

      toast({
        title: "Success",
        description: "Phone deleted successfully",
      });
      
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting phone:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete phone",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1">
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Phone Name</DialogTitle>
            <DialogDescription>
              Update the name for your phone "{phone.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone-name">Phone Name</Label>
              <Input
                id="phone-name"
                value={phoneName}
                onChange={(e) => setPhoneName(e.target.value)}
                placeholder="Enter phone name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePhone} disabled={loading}>
                {loading ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{phone.name}"? This action cannot be undone and will remove all associated location data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhone}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};