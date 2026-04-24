/**
 * UserForm — Dialog form for creating or editing user accounts.
 *
 * Used in the admin users page. When `user` prop is provided, it's in
 * edit mode (username is not editable). In create mode, username and
 * password are required.
 *
 * In edit mode, the password field is optional — leave empty to keep
 * the current password unchanged.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createUser, updateUser } from '@/app/actions/users';
import { toast } from 'sonner';

interface UserFormProps {
  user?: {
    id: string;
    name: string;
    username: string;
    phone: string | null;
    rekBank: string | null;
    role: string;
    isActive: boolean;
  };
  trigger: React.ReactNode;
  isSuperAdmin?: boolean;
}

export function UserForm({ user, trigger, isSuperAdmin = false }: UserFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!user;

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [rekBank, setRekBank] = useState(user?.rekBank ?? '');
  const [role, setRole] = useState(user?.role ?? 'SALES');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('name', name);
      formData.set('phone', phone);
      formData.set('rekBank', rekBank);
      formData.set('role', role);

      if (isEdit) {
        formData.set('isActive', user!.isActive ? 'true' : 'false');
        if (password) formData.set('newPassword', password);
        const result = await updateUser(user!.id, formData);
        if ('error' in result) {
          toast.error(result.error as string);
        } else {
          toast.success('User diperbarui');
          setOpen(false);
        }
      } else {
        formData.set('username', username);
        formData.set('password', password);
        const result = await createUser(formData);
        if ('error' in result) {
          toast.error(result.error as string);
        } else {
          toast.success('User ditambahkan');
          setOpen(false);
        }
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
    setLoading(false);
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Edit User' : 'Tambah User Baru'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">
                {isEdit
                  ? 'Password Baru (kosongkan jika tidak diubah)'
                  : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isEdit ? 0 : 4}
                required={!isEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rekBank">Rek. Bank</Label>
              <Input
                id="rekBank"
                value={rekBank}
                onChange={(e) => setRekBank(e.target.value)}
                placeholder="BCA 1234567890 a/n Nama"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(val) => setRole(val ?? role)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {{ SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', SALES: 'Sales', MANAGE: 'Manage', DRIVER: 'Driver' }[role] ?? role}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SALES">Sales</SelectItem>
                  <SelectItem value="MANAGE">Manage</SelectItem>
                  <SelectItem value="DRIVER">Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
