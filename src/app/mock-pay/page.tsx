// Local payment simulator (mock mode only). Stands in for the Midtrans hosted
// Snap page so the whole flow can be demoed without real keys. Settling here
// drives the Payment + recomputes the entry, exactly like the live webhook.

import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { isMockPayment } from '@/lib/payments/midtrans';
import { formatRupiah } from '@/lib/format';
import { MockPayControls } from './mock-pay-controls';

export const dynamic = 'force-dynamic';

export default async function MockPayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; return?: string }>;
}) {
  const { order, return: returnPath = '/catalogue' } = await searchParams;

  if (!(await isMockPayment())) {
    return <Shell><p className="text-sm text-muted-foreground">Mode simulasi tidak aktif.</p></Shell>;
  }

  // The order id is either an entry payment or a sales setoran.
  const payment = order
    ? await prisma.payment.findUnique({
        where: { orderId: order },
        include: { entry: { select: { invoiceNo: true, buyerName: true } } },
      })
    : null;
  const setoran = order && !payment
    ? await prisma.setoran.findUnique({
        where: { orderId: order },
        include: { sales: { select: { name: true } } },
      })
    : null;

  if (!payment && !setoran) {
    return <Shell><p className="text-sm text-muted-foreground">Pesanan tidak ditemukan.</p></Shell>;
  }

  const isSetoran = !!setoran;
  const amount = payment?.grossAmount ?? setoran!.amount;
  const status = payment?.status ?? setoran!.status;
  const orderId = payment?.orderId ?? setoran!.orderId!;
  const already = isSetoran ? status !== 'PENDING' : status !== 'PENDING';

  return (
    <Shell>
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 mb-5">
        <FlaskConical className="size-4 shrink-0" />
        Mode simulasi — bukan pembayaran asli. Pilih hasil di bawah untuk meniru gateway Midtrans.
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isSetoran ? 'Setoran' : 'Pembayaran'}
      </p>
      <p className="text-3xl font-bold tracking-tight mt-1">{formatRupiah(amount)}</p>
      <dl className="mt-4 flex flex-col gap-1.5 text-sm border-t pt-4">
        {isSetoran ? (
          <Row label="Sales" value={setoran!.sales.name} />
        ) : (
          <>
            <Row label="Invoice" value={payment!.entry.invoiceNo} mono />
            <Row label="Pemesan" value={payment!.entry.buyerName} />
          </>
        )}
        <Row label="Order ID" value={orderId} mono />
        <Row label="Metode" value="QRIS / VA / e-wallet (simulasi)" />
      </dl>

      <div className="mt-6">
        {already ? (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            Sudah berstatus <strong>{status}</strong>.
            <Link href={returnPath} className="block mt-3 text-primary font-medium underline underline-offset-2">
              Kembali
            </Link>
          </div>
        ) : (
          <MockPayControls orderId={orderId} returnPath={returnPath} />
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card shadow-xl p-6">{children}</div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-xs' : ''} truncate max-w-[60%]`}>{value}</dd>
    </div>
  );
}
