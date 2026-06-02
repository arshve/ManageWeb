'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { UserCog } from 'lucide-react';
import { updateOwnProfile } from '@/app/actions/users';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function EditProfileButton({ name, rekBank }: { name: string; rekBank: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setLoading(true);
    const result = await updateOwnProfile(formData);
    if ('error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Profil berhasil diperbarui');
      setOpen(false);
      router.refresh();
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
        <UserCog className="size-4" />
        Edit Profil
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Profil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profileName">Nama</FieldLabel>
              <Input id="profileName" name="name" defaultValue={name} required maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="profileRek">Rek. Bank</FieldLabel>
              <Input
                id="profileRek"
                name="rekBank"
                defaultValue={rekBank ?? ''}
                placeholder="contoh: BCA 1234567890"
                maxLength={120}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
