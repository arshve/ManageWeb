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

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createLivestock, updateLivestock } from "@/app/actions/livestock";
import { toast } from "sonner";

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

  const [sku, setSku] = useState(livestock?.sku ?? "");
  const [type, setType] = useState(livestock?.type ?? "KAMBING");
  const [grade, setGrade] = useState(livestock?.grade ?? "A");
  const [condition, setCondition] = useState(livestock?.condition ?? "SEHAT");
  const [weight, setWeight] = useState(livestock?.weight?.toString() ?? "");
  const [hargaJual, setHargaJual] = useState(livestock?.hargaJual?.toString() ?? "");
  const [tag, setTag] = useState(livestock?.tag ?? "");
  const [photoUrl, setPhotoUrl] = useState(livestock?.photoUrl ?? "");
  const [notes, setNotes] = useState(livestock?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("sku", sku);
      formData.set("type", type);
      formData.set("grade", grade);
      formData.set("condition", condition);
      formData.set("weight", weight);
      formData.set("hargaJual", hargaJual);
      formData.set("tag", tag);
      formData.set("photoUrl", photoUrl);
      formData.set("notes", notes);

      const result = isEdit
        ? await updateLivestock(livestock!.id, formData)
        : await createLivestock(formData);

      if ("error" in result) {
        toast.error(result.error as string);
      } else {
        toast.success(isEdit ? "Hewan diperbarui" : "Hewan ditambahkan");
        setOpen(false);
      }
    } catch {
      toast.error("Terjadi kesalahan");
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
            {isEdit ? "Edit Hewan" : "Tambah Hewan Baru"}
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
              <Select value={type} onValueChange={(val) => setType(val ?? type)}>
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
              <Select value={grade} onValueChange={(val) => setGrade(val ?? grade)}>
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
              <Select value={condition} onValueChange={(val) => setCondition(val ?? condition)}>
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

          <div className="space-y-2">
            <Label htmlFor="photoUrl">URL Foto</Label>
            <Input
              id="photoUrl"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
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
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Hewan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
