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
  ChevronLeft,
  History,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  role: 'ADMIN' | 'SALES' | 'MANAGE';
  userName: string;
}

// Navigation links for each role
const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/livestock', label: 'Hewan', icon: Beef },
  { href: '/admin/users', label: 'Kelola User', icon: Users },
  { href: '/admin/pricing', label: 'Harga', icon: DollarSign },
  { href: '/admin/logs', label: 'Log Aktivitas', icon: History },
];

const salesLinks = [
  { href: '/sales', label: 'Entry Saya', icon: ClipboardList },
  { href: '/sales/new', label: 'Tambah Entry', icon: Beef },
];

const manageLinks = [{ href: '/manage', label: 'Katalog', icon: Beef }];

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // Mobile menu state
  const router = useRouter();
  const links =
    role === 'ADMIN'
      ? adminLinks
      : role === 'MANAGE'
        ? manageLinks
        : salesLinks;

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
        <Menu className="h-5 w-5" />
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
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-sidebar-primary">
              Millenials Farm
            </span>
          </Link>
          <button onClick={() => setOpen(false)} className="md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links — different links based on role */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map((link) => {
            // Determine if this link is active (current page)
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
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: user info + navigation + logout */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/50 truncate">
            {userName}
          </div>
          {/* <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Ke Website
          </Link> */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
