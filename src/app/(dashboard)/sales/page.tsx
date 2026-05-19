import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { formatRupiah } from '@/lib/format';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { buttonVariants } from '@/components/ui/button';
import { Plus, Phone, MapPin, Map, Route } from 'lucide-react';
import Link from 'next/link';
import { EntryTable } from '@/components/dashboard/entry-table';
import { StatCard } from '@/components/ui/stat-card';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

export default async function SalesPage() {
  const profile = await requireAuth();

  const [entries] = await Promise.all([
    prisma.entry.findMany({
      where: { salesId: profile.id },
      orderBy: { sortAt: 'desc' },
      include: {
        items: { include: { livestock: true } },
        requests: { where: { isFulfilled: false }, select: { id: true, type: true, grade: true, weightMin: true, weightMax: true, hargaJual: true } },
        editRequests: {
          where: { status: 'PENDING' },
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { proposedBy: { select: { name: true } } },
        },
        sales: { select: { id: true, name: true } },
        delivery: {
          select: { status: true, driver: { select: { name: true } } },
        },
      },
    }),
  ]);

  const pendingEditLivestockIds = entries
    .flatMap((e) => e.editRequests)
    .flatMap((req) => (req.itemChanges as Array<{ entryItemId: string; livestockId: string; hargaJual: number }>).map((ic) => ic.livestockId));
  const pendingLivestocks = pendingEditLivestockIds.length > 0
    ? await prisma.livestock.findMany({
        where: { id: { in: pendingEditLivestockIds } },
        select: { id: true, sku: true, type: true, grade: true, tag: true },
      })
    : [];
  const pendingLivestockMap = Object.fromEntries(pendingLivestocks.map((l) => [l.id, l]));

  const approved = entries.filter((e) => e.status === 'APPROVED');
  const pending = entries.filter((e) => e.status === 'PENDING');

  const noPhone      = entries.filter((e) => !e.buyerPhone).length;
  const noAddress    = entries.filter((e) => !e.buyerAddress?.trim()).length;
  const noMaps       = entries.filter((e) => !e.buyerMaps?.trim()).length;
  const noPengiriman = entries.filter((e) => !e.pengiriman).length;
  const incompleteCount = entries.filter(
    (e) => !e.buyerPhone || !e.buyerAddress?.trim() || !e.buyerMaps?.trim() || !e.pengiriman,
  ).length;
  const totalEarnings = approved.reduce(
    (sum, e) => sum + e.items.reduce((s, i) => s + (i.resellerCut ?? 0), 0),
    0,
  );
  const totalSalesAmount = approved.reduce(
    (sum, e) => sum + e.items.reduce((s, i) => s + i.hargaJual, 0),
    0,
  );

  const serialized = entries.map((entry) => {
    const first = entry.items[0]?.livestock;
    return {
      id: entry.id,
      invoiceNo: entry.invoiceNo,
      status: entry.status,
      hargaJual: entry.items.length > 0
        ? entry.items.reduce((s, i) => s + i.hargaJual, 0)
        : entry.requests.reduce((s, r) => s + r.hargaJual, 0),
      hargaModal: entry.items.reduce((s, i) => s + (i.hargaModal ?? 0), 0),
      resellerCut: entry.items.reduce((s, i) => s + (i.resellerCut ?? 0), 0),
      hpp: entry.items.reduce((s, i) => s + (i.hpp ?? 0), 0),
      profit: entry.items.reduce((s, i) => s + (i.profit ?? 0), 0),
      dp: entry.dp,
      totalBayar: entry.totalBayar,
      paymentStatus: entry.paymentStatus,
      buyerName: entry.buyerName,
      buyerPhone: entry.buyerPhone,
      buyerAddress: entry.buyerAddress,
      buyerMaps: entry.buyerMaps,
      pengiriman: entry.pengiriman,
      notes: entry.notes,
      buktiTransfer: entry.buktiTransfer,
      isSent: entry.isSent,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deleteRequestedAt: entry.deleteRequestedAt?.toISOString() ?? null,
      deleteRequestedById: entry.deleteRequestedById ?? null,
      delivery: entry.delivery
        ? { status: entry.delivery.status, driverName: entry.delivery.driver?.name ?? null }
        : null,
      items: entry.items.map((i) => ({
        id: i.id,
        hargaJual: i.hargaJual,
        hargaModal: i.hargaModal,
        resellerCut: i.resellerCut,
        hpp: i.hpp,
        profit: i.profit,
        livestock: {
          id: i.livestock.id,
          sku: i.livestock.sku,
          type: i.livestock.type,
          grade: i.livestock.grade,
          weightMin: i.livestock.weightMin,
          weightMax: i.livestock.weightMax,
          tag: i.livestock.tag,
          photoUrl: i.livestock.photoUrl,
          condition: i.livestock.condition,
        },
      })),
      livestock: first
        ? {
            id: first.id,
            sku: first.sku,
            type: first.type,
            grade: first.grade,
            weightMin: first.weightMin,
            weightMax: first.weightMax,
            tag: first.tag,
            photoUrl: first.photoUrl,
            condition: first.condition,
          }
        : null,
      requests: entry.requests.map((r) => ({
        id: r.id,
        type: r.type,
        grade: r.grade,
        weightMin: r.weightMin,
        weightMax: r.weightMax,
        hargaJual: r.hargaJual,
      })),
      editRequests: entry.editRequests.map((req) => ({
        id: req.id,
        proposedByName: req.proposedBy.name,
        createdAt: req.createdAt.toISOString(),
        itemChanges: (req.itemChanges as Array<{ entryItemId: string; livestockId: string; hargaJual: number }>).map((ic) => ({
          entryItemId: ic.entryItemId,
          newLivestockId: ic.livestockId,
          newLivestockSku: pendingLivestockMap[ic.livestockId]?.sku ?? ic.livestockId,
          newLivestockType: pendingLivestockMap[ic.livestockId]?.type ?? '',
          newLivestockGrade: pendingLivestockMap[ic.livestockId]?.grade ?? null,
          newHargaJual: ic.hargaJual,
        })),
      })),
      sales: { id: entry.sales.id, name: entry.sales.name },
    };
  });

  return (
    <DashboardShell
      title={`Halo, ${profile.name}`}
      description="Ringkasan entry dan penghasilan kamu"
      actions={
        <Link href="/sales/new" className={buttonVariants()}>
          <Plus className="size-4 mr-2" />
          Tambah Entry
        </Link>
      }
    >
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
        <StatCard accent="success" label="Total Komisi"        value={formatRupiah(totalEarnings)}   sub={`Dari ${approved.length} penjualan disetujui`} />
        <StatCard accent="info"    label="Total Penjualan"     value={formatRupiah(totalSalesAmount)} sub={`${entries.length} entry total`} />
        <StatCard accent={pending.length > 0 ? 'warning' : 'neutral'} label="Menunggu Approval" value={pending.length} sub="Entry belum disetujui" />
        <StatCard accent={incompleteCount > 0 ? 'danger' : 'neutral'} label="Data Belum Lengkap" value={incompleteCount} sub={incompleteCount > 0 ? 'entry perlu dilengkapi' : 'semua data lengkap'} />
      </div>

      {incompleteCount > 0 && (
        <div className="rounded-xl border border-danger-ring/40 bg-danger-bg/20 px-4 py-3 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-danger-fg mb-2">
            Segera Lengkapi Data Pembeli
          </p>
          <p className="text-xs text-muted-foreground mb-2.5">
            Data berikut wajib diisi agar pengiriman bisa dijadwalkan oleh admin.
          </p>
          <div className="flex flex-wrap gap-2">
            {noPhone > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-danger-bg text-danger-fg text-xs font-medium">
                <Phone className="size-3.5 shrink-0" />
                <span>{noPhone} tanpa telepon</span>
              </div>
            )}
            {noAddress > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning-bg text-warning-fg text-xs font-medium">
                <MapPin className="size-3.5 shrink-0" />
                <span>{noAddress} tanpa alamat</span>
              </div>
            )}
            {noMaps > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning-bg text-warning-fg text-xs font-medium">
                <Map className="size-3.5 shrink-0" />
                <span>{noMaps} tanpa link maps</span>
              </div>
            )}
            {noPengiriman > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning-bg text-warning-fg text-xs font-medium">
                <Route className="size-3.5 shrink-0" />
                <span>{noPengiriman} tanpa rute pengiriman</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold" style={{ fontFamily: SERIF }}>
            Entry Saya
          </h2>
        </div>
        <EntryTable entries={serialized} isAdmin={false} />
      </div>
    </DashboardShell>
  );
}
