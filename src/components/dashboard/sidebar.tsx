/**
 * Sidebar — Main navigation for the dashboard.
 *
 * Displays different navigation links based on the user's role:
 * - ADMIN: Dashboard, Hewan, Entry Penjualan, Kelola User, Harga
 * - SALES: Entry Saya, Tambah Entry
 *
 * Features:
 * - Responsive: hidden on mobile with hamburger menu toggle
 * - Active link highlighting based on current pathname
 * - User name display at the bottom
 * - Logout button that clears the session cookie
 * - "Ke Website" link to go back to the public landing page
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Beef,
  ClipboardList,
  Users,
  DollarSign,
  LogOut,
  Menu,
  X,
  History,
  Truck,
  Wallet,
  ListChecks,
  FileBarChart,
  Palette,
  DatabaseBackup,
  HandCoins,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ChangePasswordButton } from '@/components/dashboard/change-password-form';
import { EditProfileButton } from '@/components/dashboard/edit-profile-form';

interface SidebarProps {
  role: 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'SALES' | 'MANAGE' | 'DRIVER';
  userName: string;
  brandName?: string;
  logoUrl?: string | null;
  setoranEnabled?: boolean;
  rekBank?: string | null;
}

// Navigation links for each role
const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/livestock', label: 'Hewan', icon: Beef },
  { href: '/admin/deliveries', label: 'Delivery', icon: Truck },
  { href: '/admin/antrian', label: 'Antrian', icon: ListChecks },
  { href: '/admin/setoran', label: 'Setoran', icon: HandCoins },
  { href: '/admin/users', label: 'Kelola User', icon: Users },
];

const superAdminExtras = [
  { href: '/admin/pricing', label: 'Harga', icon: DollarSign },
  { href: '/admin/finance', label: 'Keuangan', icon: Wallet },
  { href: '/admin/laporan', label: 'Laporan', icon: FileBarChart },
  { href: '/admin/logs', label: 'Log Aktivitas', icon: History },
];

// OWNER-only — white-label configuration + data tools.
const ownerExtras = [
  { href: '/admin/owner/branding', label: 'Branding & Config', icon: Palette },
  { href: '/admin/owner/data', label: 'Data', icon: DatabaseBackup },
];

const salesLinks = [
  { href: '/sales', label: 'Entry Saya', icon: ClipboardList },
  { href: '/sales/new', label: 'Tambah Entry', icon: Beef },
  { href: '/sales/catalogue', label: 'Katalog', icon: Beef },
  { href: '/sales/deliveries', label: 'Delivery', icon: Truck },
  { href: '/sales/setoran', label: 'Setoran', icon: HandCoins },
];

const manageLinks = [{ href: '/manage', label: 'Katalog', icon: Beef }];

const driverLinks = [
  { href: '/driver', label: 'Rute Hari Ini', icon: Truck },
];

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard };
type NavSection = { label?: string; items: NavLink[] };

const ROLE_LABEL: Record<SidebarProps['role'], string> = {
  OWNER: 'Owner',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SALES: 'Sales',
  MANAGE: 'Manage',
  DRIVER: 'Driver',
};

export function Sidebar({ role, userName, brandName = 'Millenials Farm', logoUrl, setoranEnabled, rekBank }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // Mobile menu state
  const router = useRouter();
  // Drop the Setoran link when the feature is switched off in config.
  const visible = (items: NavLink[]) =>
    setoranEnabled ? items : items.filter((l) => l.href !== '/admin/setoran' && l.href !== '/sales/setoran');
  // Owner-only links sit in their own labelled section below the admin links,
  // so OWNER is visually distinct from SUPER_ADMIN (who shares the top group).
  const sections: NavSection[] =
    role === 'OWNER'
      ? [{ items: visible([...adminLinks, ...superAdminExtras]) }, { label: 'Owner', items: ownerExtras }]
      : role === 'SUPER_ADMIN'
        ? [{ items: visible([...adminLinks, ...superAdminExtras]) }]
        : role === 'ADMIN'
          ? [{ items: visible(adminLinks) }]
          : role === 'MANAGE'
            ? [{ items: manageLinks }]
            : role === 'DRIVER'
              ? [{ items: driverLinks }]
              : [{ items: visible(salesLinks) }];

  /**
   * Handles logout: calls the logout API to clear the session cookie,
   * then redirects to the login page.
   */
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Mobile hamburger toggle — only visible on small screens */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-sidebar text-sidebar-foreground p-2 rounded-lg shadow-lg"
      >
        <Menu className="size-5" />
      </button>

      {/* Dark overlay when mobile menu is open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel — slides in on mobile, always visible on desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 md:translate-x-0 md:static md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header with brand name */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image src={logoUrl || '/logo.png'} alt={brandName} width={32} height={32} className="object-contain shrink-0" />
            <span className="text-lg font-bold text-sidebar-primary truncate">
              {brandName}
            </span>
          </Link>
          <button onClick={() => setOpen(false)} className="md:hidden">
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation links — grouped into sections; labelled sections (e.g.
            Owner) get a heading + divider to set them apart. */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {sections.map((section, si) => (
            <div key={section.label ?? si} className={cn('flex flex-col gap-1', section.label && 'mt-3 pt-3 border-t border-sidebar-border')}>
              {section.label && (
                <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-primary/70">
                  {section.label}
                </span>
              )}
              {section.items.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== '/admin' &&
                    link.href !== '/sales' &&
                    pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                    )}
                  >
                    <link.icon className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: user info + navigation + logout */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 flex items-center gap-2 min-w-0">
            <span className="text-xs text-sidebar-foreground/50 truncate">{userName}</span>
            <span
              className={cn(
                'shrink-0 text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded',
                role === 'OWNER'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'border border-sidebar-border text-sidebar-foreground/60',
              )}
            >
              {ROLE_LABEL[role]}
            </span>
          </div>
          {/* <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          >
            <ChevronLeft className="size-4" />
            Ke Website
          </Link> */}
          {role !== 'ADMIN' && role !== 'SUPER_ADMIN' && (
            <>
              <EditProfileButton name={userName} rekBank={rekBank ?? null} />
              <ChangePasswordButton />
            </>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
