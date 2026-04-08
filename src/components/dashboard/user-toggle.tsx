/**
 * UserToggle — Switch component to activate/deactivate a user account.
 *
 * Displays a toggle switch in the user management table.
 * When toggled, it calls the toggleUserActive server action.
 * Uses optimistic UI: immediately updates the switch state, then
 * reverts if the server action fails.
 *
 * Deactivated users cannot log in — this is a soft-delete mechanism.
 */

"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleUserActive } from "@/app/actions/users";
import { toast } from "sonner";

export function UserToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [checked, setChecked] = useState(isActive);

  /**
   * Handles toggle change with optimistic update.
   * Sets the new state immediately, then calls the server.
   * If the server action fails, reverts to the previous state.
   */
  async function handleToggle(value: boolean) {
    setChecked(value); // Optimistic update
    const result = await toggleUserActive(userId, value);
    if ("error" in result) {
      toast.error(String(result.error));
      setChecked(!value); // Revert on error
    } else {
      toast.success(value ? "User diaktifkan" : "User dinonaktifkan");
    }
  }

  return <Switch checked={checked} onCheckedChange={handleToggle} />;
}
