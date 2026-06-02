'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { mockSettlePayment } from '@/app/actions/payments';

type Outcome = 'settlement' | 'pending' | 'failure';

export function MockPayControls({ orderId, returnPath }: { orderId: string; returnPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Outcome | null>(null);

  async function settle(outcome: Outcome) {
    setBusy(outcome);
    const res = await mockSettlePayment(orderId, outcome);
    if (res.error) { toast.error(res.error); setBusy(null); return; }
    toast[outcome === 'settlement' ? 'success' : outcome === 'pending' ? 'info' : 'error'](
      outcome === 'settlement' ? 'Pembayaran berhasil' : outcome === 'pending' ? 'Pembayaran pending' : 'Pembayaran gagal',
    );
    router.push(returnPath);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button" disabled={busy !== null} onClick={() => settle('settlement')}
        className="flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-600 text-white font-semibold active:scale-[0.98] transition disabled:opacity-60"
      >
        {busy === 'settlement' ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
        Bayar berhasil (settlement)
      </button>
      <button
        type="button" disabled={busy !== null} onClick={() => settle('pending')}
        className="flex items-center justify-center gap-2 h-11 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-medium active:scale-[0.98] transition disabled:opacity-60"
      >
        {busy === 'pending' ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
        Tandai pending
      </button>
      <button
        type="button" disabled={busy !== null} onClick={() => settle('failure')}
        className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border text-muted-foreground font-medium active:scale-[0.98] transition disabled:opacity-60"
      >
        {busy === 'failure' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
        Gagal / batal
      </button>
    </div>
  );
}
