/**
 * LivestockForm — Dialog form for creating or editing livestock records.
 *
 * Used in the admin livestock page. When `livestock` prop is provided,
 * it's in edit mode (pre-fills current values). Otherwise, create mode.
 *
 * Fields: SKU, type, grade, condition, weight, tag identifiers (BSD, Kandang, MF),
 * photo URL, and notes. All fields use controlled state (useState) to avoid
 * Base UI uncontrolled component warnings.
 */

'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createLivestock, updateLivestock } from '@/app/actions/livestock';
import { toast } from 'sonner';
import { ImagePlus, X } from 'lucide-react';

interface LivestockFormProps {
  livestock?: {
    id: string;
    sku: string;
    type: string;
    grade: string;
    condition: string;
    weight: number | null;
    hargaJual: number | null;
    tag: string | null;
    photoUrl: string | null;
    notes: string | null;
  };
  trigger: React.ReactNode;
}

export function LivestockForm({ livestock, trigger }: LivestockFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!livestock;

  const [sku, setSku] = useState(livestock?.sku ?? '');
  const [type, setType] = useState(livestock?.type ?? 'KAMBING');
  const [grade, setGrade] = useState(livestock?.grade ?? 'A');
  const [condition, setCondition] = useState(livestock?.condition ?? 'SEHAT');
  const [weight, setWeight] = useState(livestock?.weight?.toString() ?? '');
  const [hargaJual, setHargaJual] = useState(
    livestock?.hargaJual?.toString() ?? '',
  );
  const [tag, setTag] = useState(livestock?.tag ?? '');
  const [notes, setNotes] = useState(livestock?.notes ?? '');

  // Photo state
  // `photoUrl` = the final URL stored in DB (existing or newly uploaded)
  // `photoFile` = the File object picked by the user, pending upload
  // `photoPreview` = local object URL for instant preview before upload
  const [photoUrl, setPhotoUrl] = useState(livestock?.photoUrl ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(
    livestock?.photoUrl ?? '',
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Handle file selection: create a local preview URL immediately */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5MB');
      return;
    }

    setPhotoFile(file);

    // Revoke previous object URL to avoid memory leaks
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(URL.createObjectURL(file));
  }

  /** Remove the selected/existing photo */
  function handleRemovePhoto() {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /**
   * Upload the selected file to /api/upload.
   * Returns the remote URL on success, or throws on failure.
   */
  async function uploadPhoto(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? 'Gagal mengunggah foto');
    }

    const { url } = await res.json();
    return url as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // If a new file was picked, upload it first and get the URL
      let finalPhotoUrl = photoUrl;
      if (photoFile) {
        try {
          finalPhotoUrl = await uploadPhoto(photoFile);
          setPhotoUrl(finalPhotoUrl); // keep state in sync
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Gagal mengunggah foto',
          );
          setLoading(false);
          return;
        }
      }

      const formData = new FormData();
      formData.set('sku', sku);
      formData.set('type', type);
      formData.set('grade', grade);
      formData.set('condition', condition);
      formData.set('weight', weight);
      formData.set('hargaJual', hargaJual);
      formData.set('tag', tag);
      formData.set('photoUrl', finalPhotoUrl);
      formData.set('notes', notes);

      const result = isEdit
        ? await updateLivestock(livestock!.id, formData)
        : await createLivestock(formData);

      if ('error' in result) {
        toast.error(result.error as string);
      } else {
        toast.success(isEdit ? 'Hewan diperbarui' : 'Hewan ditambahkan');
        setOpen(false);
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }

    setLoading(false);
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Edit Hewan' : 'Tambah Hewan Baru'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Kode</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="MF-001K-A"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Jenis Hewan</Label>
                <Select
                  value={type}
                  onValueChange={(val) => setType(val ?? type)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KAMBING">Kambing</SelectItem>
                    <SelectItem value="DOMBA">Domba</SelectItem>
                    <SelectItem value="SAPI">Sapi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade">Grade</Label>
                <Select
                  value={grade}
                  onValueChange={(val) => setGrade(val ?? grade)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER">Super</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Kondisi</Label>
                <Select
                  value={condition}
                  onValueChange={(val) => setCondition(val ?? condition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEHAT">Sehat</SelectItem>
                    <SelectItem value="SAKIT">Sakit</SelectItem>
                    <SelectItem value="MATI">Mati</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Berat (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hargaJual">Harga Jual</Label>
                <Input
                  id="hargaJual"
                  type="number"
                  value={hargaJual}
                  onChange={(e) => setHargaJual(e.target.value)}
                  placeholder="3500000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag">Tag</Label>
              <Input
                id="tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="BSD-01 / K-01 / MF-01"
              />
            </div>

            {/* ── Photo Upload ── */}
            <div className="space-y-2">
              <Label>Foto Hewan</Label>

              {photoPreview ? (
                /* Preview card — shown when a photo is selected or already exists */
                <div className="relative w-full rounded-lg overflow-hidden border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Preview foto hewan"
                    className="w-full h-48 object-cover"
                  />
                  {/* Overlay: change or remove buttons */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4 mr-1" />
                      Ganti Foto
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleRemovePhoto}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Hapus
                    </Button>
                  </div>
                  {/* Badge: shows "Foto baru" when a new file is staged but not yet uploaded */}
                  {photoFile && (
                    <span className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Foto baru
                    </span>
                  )}
                </div>
              ) : (
                /* Drop zone — shown when no photo is selected */
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 hover:bg-muted/70 hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-sm font-medium">
                    Klik untuk pilih foto
                  </span>
                  <span className="text-xs">JPG, PNG, WEBP — maks. 5MB</span>
                </button>
              )}

              {/* Hidden native file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Menyimpan...'
                : isEdit
                  ? 'Simpan Perubahan'
                  : 'Tambah Hewan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
