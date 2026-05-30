'use client';

// Owner data tools: export (download JSON) + import (wipe-and-replace restore
// behind a typed confirmation). Import is destructive — the user must type the
// exact phrase before the button enables.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CONFIRM_PHRASE = 'HAPUS & GANTI';
const WIPE_PHRASE = 'HAPUS DATA';

export function DataTransferView() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [wipeText, setWipeText] = useState('');
  const [wiping, setWiping] = useState(false);
  const [wipeSummary, setWipeSummary] = useState<Record<string, number> | null>(null);

  async function onWipe() {
    if (wipeText.trim() !== WIPE_PHRASE) return;
    setWiping(true);
    setWipeSummary(null);
    try {
      const res = await fetch('/api/owner/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Wipe gagal');
      setWipeSummary(json.deleted);
      toast.success('Data bisnis dihapus');
      setWipeText('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wipe gagal');
    } finally {
      setWiping(false);
    }
  }

  async function onImport() {
    if (!file) { toast.error('Pilih file ekspor dulu'); return; }
    if (confirmText.trim() !== CONFIRM_PHRASE) return;
    setImporting(true);
    setSummary(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch('/api/owner/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import gagal');
      setSummary(json.inserted);
      toast.success('Data berhasil di-restore');
      setConfirmText('');
      setFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import gagal');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Export */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Ekspor Data</h2>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">
          Unduh seluruh data aplikasi (semua tabel, termasuk branding/konfigurasi) sebagai satu file JSON. URL gambar tetap menunjuk ke storage saat ini.
        </p>
        <a href="/api/owner/export" className="inline-flex">
          <Button type="button" className="gap-1.5">
            <Download className="size-4" /> Unduh Ekspor JSON
          </Button>
        </a>
      </div>

      {/* Wipe (no restore) */}
      <div className="rounded-xl border border-warning-ring/40 bg-warning-bg/20 p-5">
        <div className="flex items-center gap-2">
          <Trash2 className="size-4 text-warning-fg" />
          <h2 className="text-sm font-semibold text-warning-fg">Hapus Data Bisnis</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Mengosongkan data operasional: <strong>entry, hewan, pengiriman, cashflow, log</strong>. Akun pengguna, harga, dan branding <strong>tetap aman</strong>. Cocok untuk memulai musim baru. Tidak bisa dibatalkan.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Ketik <span className="font-mono font-semibold text-foreground">{WIPE_PHRASE}</span> untuk mengonfirmasi
            </label>
            <Input
              value={wipeText}
              onChange={(e) => setWipeText(e.target.value)}
              placeholder={WIPE_PHRASE}
              className="w-56 font-mono"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="destructive"
              disabled={wiping || wipeText.trim() !== WIPE_PHRASE}
              onClick={onWipe}
              className="gap-1.5"
            >
              {wiping ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Hapus Data Bisnis
            </Button>
          </div>
        </div>
        {wipeSummary && (
          <div className="mt-4 rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold mb-2">Baris dihapus:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(wipeSummary).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{k}</span><span className="tabular-nums text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import */}
      <div className="rounded-xl border border-danger-ring/40 bg-danger-bg/20 p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-danger-fg" />
          <h2 className="text-sm font-semibold text-danger-fg">Impor Data (Hapus & Ganti)</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Restore destruktif: <strong>seluruh data saat ini akan dihapus</strong> lalu diganti dengan isi file — termasuk branding/konfigurasi (logo, warna, perusahaan, carousel). Tidak bisa dibatalkan.
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5 file:text-xs file:cursor-pointer"
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Ketik <span className="font-mono font-semibold text-foreground">{CONFIRM_PHRASE}</span> untuk mengonfirmasi
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="w-56 font-mono"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="destructive"
              disabled={importing || confirmText.trim() !== CONFIRM_PHRASE || !file}
              onClick={onImport}
              className="gap-1.5"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Hapus & Restore
            </Button>
          </div>
        </div>

        {summary && (
          <div className="mt-4 rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold mb-2">Baris terimpor:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(summary).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{k}</span><span className="tabular-nums text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
