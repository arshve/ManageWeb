'use client';

// Admin records a manual setoran hand-over (cash/transfer) as paid.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RupiahInput } from '@/components/ui/rupiah-input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { markSetoranPaid } from '@/app/actions/setoran';

export function MarkSetoran({ salesId, salesName, outstanding }: { salesId: string; salesName: string; outstanding: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const n = Number(amount);
    if (!n || n <= 0) { toast.error('Masukkan nominal'); return; }
    setLoading(true);
    const res = await markSetoranPaid(salesId, n, note);
    setLoading(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Setoran dicatat');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
        <Check className="size-3.5" /> Tandai disetor
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Catat setoran manual</DialogTitle>
          <DialogDescription>{salesName} menyerahkan uang ke perusahaan (tunai/transfer).</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nominal</Label>
            <RupiahInput value={amount} onValueChange={setAmount} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setoran-note">Catatan (opsional)</Label>
            <Input id="setoran-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. tunai, transfer BCA…" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
