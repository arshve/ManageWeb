/**
 * Utility: className merger
 *
 * Combines multiple class names using clsx (handles conditionals, arrays, etc.)
 * then merges Tailwind classes with tailwind-merge to resolve conflicts.
 * Example: cn("px-4 px-2", "text-red") → "px-2 text-red" (last px wins)
 *
 * Used by all shadcn/ui components for flexible className prop support.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
