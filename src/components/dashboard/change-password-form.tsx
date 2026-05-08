'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { KeyRound } from 'lucide-react';
import { changeOwnPassword } from '@/app/actions/users';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    if (formData.get('newPassword') !== formData.get('confirmPassword')) {
      toast.error('Password baru tidak cocok');
      return;
    }

    setLoading(true);
    const result = await changeOwnPassword(formData);
    if ('error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Password berhasil diubah');
      setOpen(false);
      form.reset();
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          />
        }
      >
        <KeyRound className="size-4" />
        Ubah Password
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ubah Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">Password Lama</FieldLabel>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                minLength={4}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">Password Baru</FieldLabel>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={4}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Konfirmasi Password Baru</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={4}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Password'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
