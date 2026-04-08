/**
 * EntryTable — Interactive table for managing sale entries.
 *
 * Displays all sale entries with inline editing. When the admin clicks the
 * pencil icon on a row, that row expands to show editable fields directly
 * in the table (no popup modal).
 *
 * Features:
 * - Inline edit: Click pencil → row expands with input fields → Save/Cancel
 * - Approve/Reject: Only shown for PENDING entries
 * - Delete: Removes entry and marks livestock as available again
 * - Live profit calculation in the edit row
 *
 * Each row is its own component (EntryRow) with isolated state for editing.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, Trash2, Pencil, Save, XCircle } from 'lucide-react';
import {
  updateEntry,
  approveEntry,
  rejectEntry,
  deleteEntry,
} from '@/app/actions/entries';
import { toast } from 'sonner';
import { formatRupiah, formatDateTime } from '@/lib/format';

export interface EntryData {
  id: string;
  invoiceNo: string;
  status: string;
  hargaJual: number;
  hargaModal: number | null;
  resellerCut: number | null;
  hpp: number | null;
  profit: number | null;
  dp: number | null;
  totalBayar: number | null;
  paymentStatus: string;
  buyerName: string;
  buyerPhone: string | null;
  buyerWa: string | null;
  buyerAddress: string | null;
  buyerMaps: string | null;
  notes: string | null;
  isSent: boolean;
  createdAt: string;
  livestock: { sku: string; type: string; grade: string };
  sales: { name: string };
}

export function EntryTable({ entries }: { entries: EntryData[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-center p-3 font-medium">Invoice</th>
            <th className="text-center p-3 font-medium">Hewan</th>
            <th className="text-center p-3 font-medium">Pembeli</th>
            <th className="text-center p-3 font-medium">Sales</th>
            <th className="text-center p-3 font-medium">Sales Cut</th>
            <th className="text-center p-3 font-medium">Harga Jual</th>
            <th className="text-center p-3 font-medium">Modal</th>
            <th className="text-center p-3 font-medium">Profit</th>
            <th className="text-center p-3 font-medium">Bayar</th>
            <th className="text-center p-3 font-medium">Kirim</th>
            <th className="text-center p-3 font-medium">Status</th>
            <th className="text-center p-3 font-medium">Tanggal</th>
            <th className="text-center p-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isEditing={editingId === entry.id}
              onEdit={() => setEditingId(entry.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => setEditingId(null)}
            />
          ))}
          {entries.length === 0 && (
            <tr>
              <td
                colSpan={12}
                className="p-8 text-center text-muted-foreground"
              >
                Belum ada entry penjualan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EntryRow({
  entry,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  entry: EntryData;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    buyerName: entry.buyerName,
    buyerPhone: entry.buyerPhone ?? '',
    buyerWa: entry.buyerWa ?? '',
    buyerAddress: entry.buyerAddress ?? '',
    buyerMaps: entry.buyerMaps ?? '',
    hargaJual: entry.hargaJual.toString(),
    hargaModal: entry.hargaModal?.toString() ?? '',
    resellerCut: entry.resellerCut?.toString() ?? '',
    dp: entry.dp?.toString() ?? '',
    totalBayar: entry.totalBayar?.toString() ?? '',
    paymentStatus: entry.paymentStatus,
    isSent: entry.isSent,
    notes: entry.notes ?? '',
  });

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('buyerName', form.buyerName);
      formData.set('buyerPhone', form.buyerPhone);
      formData.set('buyerWa', form.buyerWa);
      formData.set('buyerAddress', form.buyerAddress);
      formData.set('buyerMaps', form.buyerMaps);
      formData.set('hargaJual', form.hargaJual);
      formData.set('hargaModal', form.hargaModal);
      formData.set('resellerCut', form.resellerCut);
      formData.set('dp', form.dp);
      formData.set('totalBayar', form.totalBayar);
      formData.set('paymentStatus', form.paymentStatus);
      formData.set('isSent', form.isSent.toString());
      formData.set('notes', form.notes);

      const result = await updateEntry(entry.id, formData);
      if ('error' in result) {
        toast.error(String(result.error));
      } else {
        toast.success('Entry diperbarui');
        onSaved();
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
    setLoading(false);
  }

  async function handleApprove() {
    const result = await approveEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry disetujui');
  }

  async function handleReject() {
    if (!confirm('Yakin ingin menolak entry ini?')) return;
    const result = await rejectEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry ditolak');
  }

  async function handleDelete() {
    if (!confirm('Yakin ingin menghapus entry ini?')) return;
    const result = await deleteEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry dihapus');
  }

  return (
    <>
      {/* Main row */}
      <tr
        className={`border-b last:border-0 ${isEditing ? 'bg-muted/30' : ''}`}
      >
        <td className="p-3 font-mono text-xs">{entry.invoiceNo}</td>
        <td className="p-3">
          {entry.livestock.type} {entry.livestock.grade}
          <div className="text-xs text-muted-foreground">
            {entry.livestock.sku}
          </div>
        </td>
        <td className="p-3">
          {entry.buyerName}
          {entry.buyerPhone && (
            <div className="text-xs text-muted-foreground">
              {entry.buyerPhone}
            </div>
          )}
        </td>
        <td className="p-3">{entry.sales.name}</td>
        <td className="p-3 text-center">
          {entry.resellerCut ? formatRupiah(entry.resellerCut) : '-'}
        </td>
        <td className="p-3 text-center">{formatRupiah(entry.hargaJual)}</td>
        <td className="p-3 text-center">
          {entry.hargaModal ? formatRupiah(entry.hargaModal) : '-'}
        </td>
        <td className="p-3 text-center">
          {entry.profit ? (
            <span
              className={
                entry.profit >= 0 ? 'text-primary' : 'text-destructive'
              }
            >
              {formatRupiah(entry.profit)}
            </span>
          ) : (
            '-'
          )}
        </td>
        <td className="p-3 text-center">
          <Badge
            variant={
              entry.paymentStatus === 'LUNAS'
                ? 'default'
                : entry.paymentStatus === 'DP'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {entry.paymentStatus === 'BELUM_BAYAR'
              ? 'Belum'
              : entry.paymentStatus}
          </Badge>
        </td>
        <td className="p-3 text-center">
          {entry.isSent ? (
            <Badge variant="default">Ya</Badge>
          ) : (
            <Badge variant="outline">Belum</Badge>
          )}
        </td>
        <td className="p-3 text-center">
          <Badge
            variant={
              entry.status === 'APPROVED'
                ? 'default'
                : entry.status === 'PENDING'
                  ? 'secondary'
                  : 'destructive'
            }
          >
            {entry.status}
          </Badge>
        </td>
        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap text-center">
          {formatDateTime(new Date(entry.createdAt))}
        </td>
        <td className="p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary"
                  onClick={handleSave}
                  disabled={loading}
                  title="Simpan"
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onCancel}
                  title="Batal"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {entry.status === 'PENDING' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      onClick={handleApprove}
                      title="Setujui"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={handleReject}
                      title="Tolak"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleDelete}
                  title="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Inline edit row */}
      {isEditing && (
        <tr className="border-b bg-muted/20">
          <td colSpan={12} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Buyer */}
              <div className="space-y-1">
                <Label className="text-xs">Nama Pembeli</Label>
                <Input
                  value={form.buyerName}
                  onChange={(e) => update('buyerName', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telepon</Label>
                <Input
                  value={form.buyerPhone}
                  onChange={(e) => update('buyerPhone', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  value={form.buyerWa}
                  onChange={(e) => update('buyerWa', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Google Maps</Label>
                <Input
                  value={form.buyerMaps}
                  onChange={(e) => update('buyerMaps', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Pricing */}
              <div className="space-y-1">
                <Label className="text-xs">Harga Jual</Label>
                <Input
                  type="number"
                  value={form.hargaJual}
                  onChange={(e) => update('hargaJual', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Harga Modal</Label>
                <Input
                  type="number"
                  value={form.hargaModal}
                  onChange={(e) => update('hargaModal', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reseller Cut</Label>
                <Input
                  type="number"
                  value={form.resellerCut}
                  onChange={(e) => update('resellerCut', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status Bayar</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(val) =>
                    update('paymentStatus', val ?? form.paymentStatus)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                    <SelectItem value="DP">DP</SelectItem>
                    <SelectItem value="LUNAS">Lunas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment */}
              <div className="space-y-1">
                <Label className="text-xs">DP</Label>
                <Input
                  type="number"
                  value={form.dp}
                  onChange={(e) => update('dp', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Dibayar</Label>
                <Input
                  type="number"
                  value={form.totalBayar}
                  onChange={(e) => update('totalBayar', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sudah Dikirim</Label>
                <div className="pt-1">
                  <Switch
                    checked={form.isSent}
                    onCheckedChange={(val) => update('isSent', val)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alamat</Label>
                <Input
                  value={form.buyerAddress}
                  onChange={(e) => update('buyerAddress', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Notes - full width */}
              <div className="col-span-2 md:col-span-4 space-y-1">
                <Label className="text-xs">Catatan</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
