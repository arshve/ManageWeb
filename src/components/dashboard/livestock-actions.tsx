/**
 * LivestockActions — Action buttons for each livestock row in the admin table.
 *
 * Displays edit (pencil) and delete (trash) buttons for each animal.
 * - Edit: Opens the LivestockForm dialog pre-filled with current data
 * - Delete: Shows a confirmation dialog, then deletes the livestock record
 *
 * Note: Delete will fail if the animal has a linked sale entry
 * (Prisma enforces the foreign key constraint).
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteLivestock } from "@/app/actions/livestock";
import { LivestockForm } from "./livestock-form";
import { toast } from "sonner";

interface LivestockActionsProps {
  livestock: {
    id: string;
    sku: string;
    type: string;
    grade: string;
    condition: string;
    weight: number | null;
    tagBsd: string | null;
    tagKandang: string | null;
    tagMf: string | null;
    photoUrl: string | null;
    notes: string | null;
  };
}

export function LivestockActions({ livestock }: LivestockActionsProps) {
  /**
   * Handles livestock deletion with confirmation dialog.
   * Calls the deleteLivestock server action after user confirms.
   */
  async function handleDelete() {
    if (!confirm("Yakin ingin menghapus hewan ini?")) return;
    const result = await deleteLivestock(livestock.id);
    if ("error" in result) {
      toast.error(result.error as string);
    } else {
      toast.success("Hewan dihapus");
    }
  }

  return (
    <div className="flex items-center gap-1">
      {/* Edit button — opens the livestock form dialog with pre-filled data */}
      <LivestockForm
        livestock={livestock}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
      />
      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
