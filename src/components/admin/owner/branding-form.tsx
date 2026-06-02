'use client';

// Owner branding editor. Edits the singleton AppConfig: company/legal, app
// metadata, logo upload, and the single brand color (auto-expanded to the
// full scale server-side). Submits to updateAppConfig and refreshes.

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { updateAppConfig } from '@/app/actions/config';
import { toast } from 'sonner';
import { Upload, Loader2, ImagePlus, ArrowUp, ArrowDown, X } from 'lucide-react';
import type { AppConfig } from '@/lib/config/get-config';

type SalesOption = { id: string; name: string; username: string; isActive: boolean };

export function BrandingForm({ config, salesUsers = [] }: { config: AppConfig; salesUsers?: SalesOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(config.logoUrl ?? '');
  const [signatureUrl, setSignatureUrl] = useState(config.signatureUrl ?? '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [brandHex, setBrandHex] = useState(config.brandHex ?? '#14201d');
  // Only a hex value belongs in the cover picker. Legacy rows may hold a
  // derived OKLCH string — ignore those so submitting won't fail validation.
  const [coverColor, setCoverColor] = useState(
    /^#[0-9a-fA-F]{6}$/.test(config.coverColor ?? '') ? config.coverColor! : '',
  );
  type SlideState = { desktop: string; tab: string; mobile: string; alt: string };
  const [slides, setSlides] = useState<SlideState[]>(
    (config.carouselSlides ?? []).map((s) => ({
      desktop: s.desktop ?? '', tab: s.tab ?? '', mobile: s.mobile ?? '', alt: s.alt ?? '',
    })),
  );
  // tracks which slide/variant is mid-upload, e.g. "0:desktop"
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState(config.paymentEnabled);
  const [midtransIsProduction, setMidtransIsProduction] = useState(config.midtransIsProduction);
  const [paymentMock, setPaymentMock] = useState(config.paymentMock);
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  function addSlide() {
    setSlides((prev) => [...prev, { desktop: '', tab: '', mobile: '', alt: '' }]);
  }
  async function uploadSlideImage(i: number, field: 'desktop' | 'tab' | 'mobile', file: File) {
    const slot = `${i}:${field}`;
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/upload?folder=carousel', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload gagal');
      setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: json.url } : s)));
      toast.success('Gambar diunggah');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploadingSlot(null);
    }
  }
  function clearSlideImage(i: number, field: 'desktop' | 'tab' | 'mobile') {
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: '' } : s)));
  }
  function moveSlide(i: number, dir: -1 | 1) {
    setSlides((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removeSlide(i: number) {
    setSlides((prev) => prev.filter((_, idx) => idx !== i));
  }
  function setSlideAlt(i: number, alt: string) {
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, alt } : s)));
  }

  async function uploadFile(
    file: File,
    setUrl: (u: string) => void,
    setBusy: (b: boolean) => void,
    label: string,
  ) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/upload?folder=branding', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload gagal');
      setUrl(json.url);
      toast.success(`${label} terunggah`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('logoUrl', logoUrl);
    fd.set('signatureUrl', signatureUrl);
    fd.set('brandHex', brandHex);
    fd.set('coverColor', coverColor);
    fd.set('carouselSlides', JSON.stringify(slides.filter((s) => s.desktop.trim())));
    startTransition(async () => {
      const res = await updateAppConfig(fd);
      if (res && 'error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Konfigurasi tersimpan');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-3xl">
      {/* Brand identity */}
      <Section title="Identitas" desc="Nama tampilan dipakai di sidebar & login (singkat). Nama perusahaan (lengkap/legal) dipakai di dokumen PDF.">
        <Grid>
          <FieldText name="brandName" label="Nama Tampilan (singkat)" defaultValue={config.brandName} />
          <FieldText name="companyName" label="Nama Perusahaan (legal, untuk PDF)" defaultValue={config.companyName} />
          <FieldText name="tagline" label="Tagline" defaultValue={config.tagline} />
          <FieldText name="instagram" label="Instagram" defaultValue={config.instagram ?? ''} />
          <FieldText name="appTitle" label="Judul Aplikasi (tab browser)" defaultValue={config.appTitle} className="sm:col-span-2" />
          <FieldArea name="appDescription" label="Deskripsi" defaultValue={config.appDescription} className="sm:col-span-2" />
        </Grid>
      </Section>

      {/* Logo + signature */}
      <Section title="Logo & Tanda Tangan" desc="Logo tampil di sidebar, login, dan PDF. Tanda tangan CEO dipakai di invoice & kwitansi.">
        <div className="flex flex-wrap items-start gap-8">
          <ImageUpload
            label="Logo"
            url={logoUrl}
            busy={uploadingLogo}
            inputRef={logoRef}
            onPick={(f) => uploadFile(f, setLogoUrl, setUploadingLogo, 'Logo')}
            onClear={() => setLogoUrl('')}
          />
          <ImageUpload
            label="Tanda Tangan CEO"
            url={signatureUrl}
            busy={uploadingSig}
            inputRef={sigRef}
            onPick={(f) => uploadFile(f, setSignatureUrl, setUploadingSig, 'Tanda tangan')}
            onClear={() => setSignatureUrl('')}
            wide
          />
        </div>
      </Section>

      {/* Colors */}
      <Section title="Warna" desc="Warna brand menghasilkan skema lengkap. Warna latar laporan mengatur sampul/latar di halaman Laporan.">
        <div className="flex flex-wrap items-center gap-8">
          <ColorField label="Warna brand" value={brandHex} fallback="#14201d" onChange={setBrandHex} placeholder="#0C4C3C" />
          <ColorField label="Latar laporan (cover)" value={coverColor} fallback="#14201d" onChange={setCoverColor} placeholder="kosong = ikut brand" clearable />
        </div>
      </Section>

      {/* Hero carousel */}
      <Section title="Carousel Halaman Depan" desc="Slide hero halaman utama. Tiap slide punya 3 ukuran: Desktop (wajib), Tablet & Mobile (opsional — kalau kosong ikut Desktop). Kosongkan semua untuk pakai bawaan.">
        <div className="flex flex-col gap-3">
          {slides.length === 0 && (
            <p className="text-xs text-muted-foreground">Belum ada slide khusus — memakai carousel bawaan.</p>
          )}
          {slides.map((slide, i) => (
            <div key={i} className="rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">Slide {i + 1}</span>
                <div className="flex items-center gap-1">
                  <IconBtn title="Naik" disabled={i === 0} onClick={() => moveSlide(i, -1)}><ArrowUp className="size-3.5" /></IconBtn>
                  <IconBtn title="Turun" disabled={i === slides.length - 1} onClick={() => moveSlide(i, 1)}><ArrowDown className="size-3.5" /></IconBtn>
                  <IconBtn title="Hapus slide" onClick={() => removeSlide(i)} danger><X className="size-3.5" /></IconBtn>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['desktop', 'tab', 'mobile'] as const).map((field) => (
                  <SlideSlot
                    key={field}
                    label={{ desktop: 'Desktop *', tab: 'Tablet', mobile: 'Mobile' }[field]}
                    url={slide[field]}
                    busy={uploadingSlot === `${i}:${field}`}
                    onPick={(f) => uploadSlideImage(i, field, f)}
                    onClear={() => clearSlideImage(i, field)}
                  />
                ))}
              </div>
              <Input
                value={slide.alt}
                onChange={(e) => setSlideAlt(i, e.target.value)}
                placeholder="Keterangan (alt, opsional)"
                className="mt-3"
              />
            </div>
          ))}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={addSlide} className="gap-1.5">
              <ImagePlus className="size-3.5" /> Tambah Slide
            </Button>
          </div>
        </div>
      </Section>

      {/* Legal + bank */}
      <Section title="Legal & Bank" desc="Dipakai di invoice, kwitansi, dan surat jalan.">
        <Grid>
          <FieldArea name="address" label="Alamat" defaultValue={config.address} className="sm:col-span-2" />
          <FieldText name="city" label="Kota" defaultValue={config.city} />
          <FieldText name="signer" label="Penandatangan" defaultValue={config.signer} />
          <FieldText name="bankName" label="Bank" defaultValue={config.bankName} />
          <FieldText name="bankAccountName" label="Atas Nama" defaultValue={config.bankAccountName} />
          <FieldText name="bankAccountNo" label="No. Rekening" defaultValue={config.bankAccountNo} />
        </Grid>
      </Section>

      {/* Online payment + public sales */}
      <Section title="Pembayaran & Penjualan Publik" desc="Aktifkan checkout online (QRIS / Virtual Account / e-wallet) lewat Midtrans, dan pilih akun sales yang menaungi pesanan dari katalog publik.">
        <input type="hidden" name="paymentEnabled" value={paymentEnabled ? 'true' : 'false'} />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Pembayaran online</p>
            <p className="text-xs text-muted-foreground">
              Saat aktif: keranjang muncul di katalog & tombol &quot;Tagih Online&quot; aktif di entry.
            </p>
          </div>
          <Switch checked={paymentEnabled} onCheckedChange={setPaymentEnabled} />
        </div>

        <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t">
          <label htmlFor="publicSalesId" className="text-sm font-medium">Sales untuk pesanan katalog</label>
          <p className="text-xs text-muted-foreground -mt-1 mb-1">Pesanan dari katalog publik dicatat atas nama akun ini.</p>
          <select
            id="publicSalesId" name="publicSalesId" defaultValue={config.publicSalesId ?? ''}
            className="h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">— Pilih akun sales —</option>
            {salesUsers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{!s.isActive ? ' (nonaktif)' : ''} · @{s.username}
              </option>
            ))}
          </select>
        </div>

        {/* Midtrans credentials */}
        <div className="mt-4 pt-4 border-t flex flex-col gap-3">
          <p className="text-sm font-medium">Kredensial Midtrans</p>
          <input type="hidden" name="midtransIsProduction" value={midtransIsProduction ? 'true' : 'false'} />
          <input type="hidden" name="paymentMock" value={paymentMock ? 'true' : 'false'} />

          <div className="grid sm:grid-cols-2 gap-3">
            <FieldText
              name="midtransServerKey"
              label="Server Key (rahasia)"
              type="password"
              placeholder={config.hasMidtransServerKey ? '•••••••• tersimpan (kosongkan = tetap)' : 'Mid-server-…'}
              defaultValue=""
            />
            <FieldText name="midtransClientKey" label="Client Key" defaultValue={config.midtransClientKey ?? ''} placeholder="Mid-client-…" />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Ambil di dashboard.midtrans.com → Settings → Access Keys. Server Key tidak pernah ditampilkan ulang & tidak ikut diekspor.
          </p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Mode produksi</p>
              <p className="text-xs text-muted-foreground">Aktif = live (kunci produksi). Nonaktif = sandbox.</p>
            </div>
            <Switch checked={midtransIsProduction} onCheckedChange={setMidtransIsProduction} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Mode simulasi (mock)</p>
              <p className="text-xs text-muted-foreground">Uji alur tanpa kunci asli — pembayaran disimulasikan via /mock-pay.</p>
            </div>
            <Switch checked={paymentMock} onCheckedChange={setPaymentMock} />
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="gap-1.5">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Simpan Perubahan
        </Button>
        <span className="text-xs text-muted-foreground">Perubahan warna/logo langsung berlaku setelah simpan.</span>
      </div>
    </form>
  );
}

/* ── pieces ──────────────────────────────────────────────────────────── */
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {desc && <p className="text-xs text-muted-foreground mt-0.5 mb-4">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}
// Controlled so Base UI doesn't warn when the parent re-supplies a new
// `config` (e.g. after router.refresh()); still submits via `name` in FormData.
function FieldText({ name, label, defaultValue, className, type, placeholder }: { name: string; label: string; defaultValue?: string; className?: string; type?: string; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue ?? '');
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Input name={name} type={type} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}
function FieldArea({ name, label, defaultValue, className }: { name: string; label: string; defaultValue?: string; className?: string }) {
  const [value, setValue] = useState(defaultValue ?? '');
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Textarea name={name} value={value} onChange={(e) => setValue(e.target.value)} rows={2} />
    </div>
  );
}
function ImageUpload({
  label, url, busy, inputRef, onPick, onClear, wide,
}: {
  label: string;
  url: string;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File) => void;
  onClear: () => void;
  wide?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-4">
        <div className={`${wide ? 'h-16 w-28' : 'size-16'} rounded-xl border bg-card flex items-center justify-center overflow-hidden`}>
          {url
            ? <Image src={url} alt={label} width={wide ? 104 : 56} height={56} className="object-contain" />
            : <span className="text-[10px] text-muted-foreground px-2 text-center">Belum ada</span>}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-1.5">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {url ? 'Ganti' : 'Unggah'}
          </Button>
          {url && (
            <button type="button" className="ml-2 text-xs text-muted-foreground hover:text-destructive" onClick={onClear}>
              Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// A single responsive-variant upload tile inside a carousel slide.
function SlideSlot({ label, url, busy, onPick, onClear }: { label: string; url: string; busy: boolean; onPick: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">{label}</label>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ''; }} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="relative w-full aspect-video rounded-lg border bg-card overflow-hidden flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[10px]"><Upload className="size-3.5" />Unggah</span>
        )}
      </button>
      {url && !busy && (
        <button type="button" onClick={onClear} className="mt-1 text-[10px] text-muted-foreground hover:text-destructive">
          Hapus
        </button>
      )}
    </div>
  );
}
function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`size-7 inline-flex items-center justify-center rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${danger ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/5' : 'text-muted-foreground hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}
function ColorField({
  label, value, fallback, onChange, placeholder, clearable,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 rounded-md border bg-transparent cursor-pointer p-0"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-44 font-mono" />
        {clearable && value && (
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => onChange('')}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
