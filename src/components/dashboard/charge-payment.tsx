'use client';

// Sales/admin in-app charge: creates a Midtrans transaction for an entry and
// redirects to the payment page (hosted Snap page when live, /mock-pay in demo).
// No Midtrans key touches the browser — `canCharge` (server-resolved) gates it.

import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { createPayment } from '@/app/actions/payments';

export function ChargePayment({
  entryId, totalBayar, paymentStatus, buyerName, canCharge,
}: {
  entryId: string;
  totalBayar: number | null;
  paymentStatus: string;
  buyerName: string;
  canCharge?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(totalBayar ? String(totalBayar) : '');
  const [loading, setLoading] = useState(false);

  // Hidden when payment isn't active/configured, already settled, or no total.
  if (!canCharge || paymentStatus === 'LUNAS' || !totalBayar || totalBayar <= 0) return null;

  async function handleCharge() {
    const nominal = Number(amount);
    if (!nominal || nominal <= 0) { toast.error('Masukkan nominal'); return; }
    setLoading(true);
    try {
      const res = await createPayment(entryId, nominal);
      if (res.error || !res.redirectUrl) { toast.error(res.error ?? 'Gagal membuat tagihan'); return; }
      window.location.href = res.redirectUrl; // mock → /mock-pay, live → hosted Snap page
    } catch {
      toast.error('Gagal membuat tagihan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="mt-1 h-7 gap-1 text-[11px]" />}>
        <CreditCard className="size-3" /> Tagih Online
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tagih via Midtrans</DialogTitle>
          <DialogDescription>
            Tagihan untuk {buyerName}. Buyer bayar via QRIS / Virtual Account / e-wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="charge-amount">Nominal (DP atau pelunasan)</Label>
          <RupiahInput value={amount} onValueChange={setAmount} placeholder="0" />
        </div>
        <DialogFooter>
          <Button onClick={handleCharge} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Buat Tagihan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
