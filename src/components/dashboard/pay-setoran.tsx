'use client';

// Sales pays their setoran via the same Midtrans gateway (money → company).
// Mock mode routes to /mock-pay; live returns a Snap redirect URL.

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { createSetoranPayment } from '@/app/actions/setoran';

export function PaySetoran({ outstanding }: { outstanding: number }) {
  const [amount, setAmount] = useState<string>(outstanding > 0 ? String(outstanding) : '');
  const [loading, setLoading] = useState(false);

  if (outstanding <= 0) {
    return <p className="text-sm text-success-fg font-medium">Tidak ada setoran tertunggak. 🎉</p>;
  }

  async function pay() {
    const n = Number(amount);
    if (!n || n <= 0) { toast.error('Masukkan nominal'); return; }
    setLoading(true);
    try {
      const res = await createSetoranPayment(n);
      if (res.error || !res.redirectUrl) { toast.error(res.error ?? 'Gagal'); return; }
      window.location.href = res.redirectUrl;
    } catch {
      toast.error('Gagal membuat setoran');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
        <label className="text-xs text-muted-foreground">Nominal setoran</label>
        <RupiahInput value={amount} onValueChange={setAmount} />
      </div>
      <Button onClick={pay} disabled={loading} className="gap-2 h-10">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />}
        Bayar Setoran
      </Button>
    </div>
  );
}
