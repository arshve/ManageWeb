'use client';

// Floating cart + checkout for the public catalogue. Lists the chosen animals,
// collects the buyer + delivery data an Entry needs, and checks the whole cart
// out as one order + one Midtrans payment (createPublicOrder), then redirects to
// the hosted Snap page. Delivery essentials (name, phone, address, map point)
// are mandatory; the map point feeds buyerLat/buyerLng into the delivery flow.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  ShoppingCart, Loader2, Trash2, Beef, MapPin, LocateFixed, Check, User, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { formatRupiah, PENGIRIMAN_OPTIONS } from '@/lib/format';
import { toThumbnailUrl } from '@/lib/image';
import { useCart } from '@/components/catalogue/cart-context';
import { createPublicOrder } from '@/app/actions/payments';
import { LocationPicker, type LatLng } from '@/components/catalogue/location-picker-loader';

// Pull lat/lng out of a pasted Google Maps URL (pure, client-side).
function parseMapsLatLng(url: string): LatLng | null {
  const pats = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/];
  for (const p of pats) {
    const m = url.match(p);
    if (m) {
      const lat = Number(m[1]); const lng = Number(m[2]);
      if (isFinite(lat) && isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}
const mapsLink = (c: LatLng) => `https://www.google.com/maps?q=${c.lat},${c.lng}`;

export function CartButton() {
  const cart = useCart();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    buyerName: '', buyerPhone: '', buyerAddress: '', buyerMaps: '', pengiriman: '',
  });
  const [coords, setCoords] = useState<LatLng | null>(null);

  // Returning from a completed Snap payment (finish callback → /catalogue?order=done).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('order') === 'done') {
      cart.clear();
      toast.success('Terima kasih! Pesanan Anda sedang diproses.');
      window.history.replaceState({}, '', '/catalogue');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cart.paymentEnabled || !cart.hydrated || cart.count === 0) return null;

  // A point picked on the map (or via GPS) sets both coords + the Maps link.
  function setPoint(c: LatLng) {
    setCoords(c);
    setForm((f) => ({ ...f, buyerMaps: mapsLink(c) }));
  }

  function onPasteMaps(v: string) {
    setForm((f) => ({ ...f, buyerMaps: v }));
    const parsed = parseMapsLatLng(v);
    setCoords(parsed); // moves/clears the pin; null = short link, server resolves later
  }

  function useMyLocation() {
    if (!navigator.geolocation) { toast.error('Lokasi tidak didukung browser ini'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) });
        setLocating(false);
        toast.success('Lokasi terkunci');
      },
      () => { setLocating(false); toast.error('Gagal ambil lokasi — izinkan akses atau ketuk peta'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!form.buyerName.trim()) return toast.error('Nama wajib diisi');
    if (!form.buyerPhone.trim()) return toast.error('No. WhatsApp wajib diisi');
    if (!form.buyerAddress.trim()) return toast.error('Alamat pengiriman wajib diisi');
    if (!form.buyerMaps.trim()) return toast.error('Titik lokasi pengiriman wajib dipilih');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('items', JSON.stringify(cart.items.map((i) => i.id)));
      fd.set('buyerName', form.buyerName);
      fd.set('buyerPhone', form.buyerPhone);
      fd.set('buyerAddress', form.buyerAddress);
      fd.set('buyerMaps', form.buyerMaps);
      fd.set('pengiriman', form.pengiriman);
      if (coords) { fd.set('buyerLat', String(coords.lat)); fd.set('buyerLng', String(coords.lng)); }
      const res = await createPublicOrder(fd);
      if (res.error || !res.redirectUrl) {
        toast.error(res.error ?? 'Gagal membuat pesanan');
        const gone = (res as { unavailableIds?: string[] }).unavailableIds;
        if (gone?.length) { gone.forEach((id) => cart.remove(id)); router.refresh(); }
        return;
      }
      window.location.href = res.redirectUrl; // hosted Midtrans page
    } catch {
      toast.error('Gagal membuat pesanan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating cart pill */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 pl-4 pr-5 py-3 rounded-full shadow-lg shadow-black/20 bg-primary text-primary-foreground font-semibold active:scale-95 transition-transform"
        aria-label="Buka keranjang"
      >
        <span className="relative">
          <ShoppingCart className="size-5" />
          <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-background text-foreground text-[10px] font-bold flex items-center justify-center">
            {cart.count}
          </span>
        </span>
        <span className="text-sm">{formatRupiah(cart.total)}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-2xl">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b">
            <DialogTitle className="text-lg font-bold tracking-tight">Keranjang</DialogTitle>
            <DialogDescription className="text-xs">
              {cart.count} hewan · bayar online via QRIS, Virtual Account, atau e-wallet.
            </DialogDescription>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
            {/* Items */}
            <ul className="flex flex-col gap-2">
              {cart.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 rounded-xl border bg-card p-2 pr-3">
                  <div className="size-14 shrink-0 rounded-lg overflow-hidden bg-muted relative">
                    {it.photoUrl ? (
                      <Image src={toThumbnailUrl(it.photoUrl, 140)} alt={it.sku} fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Beef className="size-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{it.sku}</p>
                    <p className="text-sm font-bold mt-0.5">{formatRupiah(it.price)}</p>
                  </div>
                  <button type="button" onClick={() => cart.remove(it.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg p-2 transition-colors"
                    aria-label="Hapus">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Form */}
            <form id="checkout-form" onSubmit={checkout} className="flex flex-col gap-5">
              {/* Buyer */}
              <section className="flex flex-col gap-3">
                <SectionLabel icon={<User className="size-3.5" />}>Data Pemesan</SectionLabel>
                <Field label="Nama lengkap" required>
                  <Input value={form.buyerName} onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))} placeholder="Nama penerima" required />
                </Field>
                <Field label="No. WhatsApp" required>
                  <Input type="tel" inputMode="tel" value={form.buyerPhone} onChange={(e) => setForm((f) => ({ ...f, buyerPhone: e.target.value }))} placeholder="08xxxxxxxxxx" required />
                </Field>
              </section>

              {/* Delivery */}
              <section className="flex flex-col gap-3">
                <SectionLabel icon={<Truck className="size-3.5" />}>Pengiriman</SectionLabel>
                <Field label="Alamat" required>
                  <Textarea rows={2} value={form.buyerAddress} onChange={(e) => setForm((f) => ({ ...f, buyerAddress: e.target.value }))} placeholder="Nama jalan, no. rumah, RT/RW, kelurahan, kota" required />
                </Field>

                <Field label="Titik lokasi di peta" required>
                  <div className="relative h-52 w-full rounded-xl overflow-hidden border isolate">
                    <LocationPicker value={coords} onChange={setPoint} />
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={locating}
                      className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 rounded-lg bg-background/95 backdrop-blur px-2.5 py-1.5 text-xs font-medium shadow-md border hover:bg-background disabled:opacity-60"
                    >
                      {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
                      Lokasi saya
                    </button>
                    <div className="absolute bottom-2 left-2 z-[1000] flex items-center gap-1.5 rounded-lg bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] shadow-md border">
                      {coords ? (
                        <><Check className="size-3.5 text-success-fg" /> {coords.lat}, {coords.lng}</>
                      ) : (
                        <><MapPin className="size-3.5 text-muted-foreground" /> Ketuk peta untuk pasang pin</>
                      )}
                    </div>
                  </div>
                  <input
                    value={form.buyerMaps}
                    onChange={(e) => onPasteMaps(e.target.value)}
                    placeholder="…atau tempel link Google Maps"
                    inputMode="url"
                    className="mt-2 h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </Field>

                <Field label="Waktu pengiriman">
                  <select
                    value={form.pengiriman}
                    onChange={(e) => setForm((f) => ({ ...f, pengiriman: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <option value="">— Pilih (opsional) —</option>
                    {PENGIRIMAN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </section>
            </form>
          </div>

          {/* Sticky footer */}
          <div className="border-t px-5 py-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold tracking-tight">{formatRupiah(cart.total)}</span>
            </div>
            <Button form="checkout-form" type="submit" disabled={loading} className="w-full h-11 text-base gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>Bayar {formatRupiah(cart.total)}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="flex items-center justify-center size-6 rounded-md bg-muted">{icon}</span>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
