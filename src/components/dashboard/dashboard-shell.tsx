/**
 * DashboardShell — Layout wrapper for all dashboard pages.
 *
 * Provides a consistent page structure with:
 * - Title (h1 heading)
 * - Optional description text below the title
 * - Optional action buttons (top-right, e.g., "Tambah Hewan" button)
 * - Content area (children)
 *
 * Used by every admin and sales dashboard page for consistent spacing and layout.
 */

interface DashboardShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({
  title,
  description,
  actions,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pl-12 md:pl-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
