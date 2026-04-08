/**
 * PricingForm — Dialog form for creating or editing pricing entries.
 *
 * Used in the admin pricing page. When `pricing` prop is provided, it's in
 * edit mode (pre-fills current values). Otherwise, it's in create mode.
 *
 * Uses the "span onClick + controlled Dialog" pattern instead of DialogTrigger
 * to avoid hydration mismatch with Base UI components.
 *
 * Calls the upsertPricing server action which creates or updates based on
 * the unique [animalType, grade] combination.
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { upsertPricing } from "@/app/actions/pricing";
import { toast } from "sonner";

interface PricingFormProps {
  pricing?: {
    id: string;
    animalType: string;
    grade: string;
    hargaBeli: number;
    hargaJual: number;
  };
  trigger: React.ReactNode;
}

export function PricingForm({ pricing, trigger }: PricingFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animalType, setAnimalType] = useState(pricing?.animalType || "KAMBING");
  const [grade, setGrade] = useState(pricing?.grade || "A");
  const [hargaBeli, setHargaBeli] = useState(pricing?.hargaBeli?.toString() || "");
  const [hargaJual, setHargaJual] = useState(pricing?.hargaJual?.toString() || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("animalType", animalType);
      formData.set("grade", grade);
      formData.set("hargaBeli", hargaBeli);
      formData.set("hargaJual", hargaJual);

      const result = await upsertPricing(formData);
      if ("error" in result) {
        toast.error(result.error as string);
      } else {
        toast.success("Harga disimpan");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pricing ? "Edit Harga" : "Tambah Harga"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jenis Hewan</Label>
              <Select
                value={animalType}
                onValueChange={(val) => setAnimalType(val ?? animalType)}
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
            <div className="space-y-2">
              <Label>Grade</Label>
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
          </div>

          <div className="space-y-2">
            <Label>Harga Beli (Modal)</Label>
            <Input
              type="number"
              value={hargaBeli}
              onChange={(e) => setHargaBeli(e.target.value)}
              placeholder="2500000"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Harga Jual</Label>
            <Input
              type="number"
              value={hargaJual}
              onChange={(e) => setHargaJual(e.target.value)}
              placeholder="3500000"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Harga"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
