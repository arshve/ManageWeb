'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Pencil,
  Search,
  Users as UsersIcon,
  UserCheck,
  Wallet,
  Package,
  CreditCard,
  ChevronDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { UserToggle } from '@/components/dashboard/user-toggle';
import { UserForm } from '@/components/dashboard/user-form';

interface UserRow {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  rekBank: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  _count: { entries: number };
}

// DM Serif Display — the app's editorial display face (see DashboardShell).
const serif = { fontFamily: 'var(--font-dm-serif)' } as const;

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SALES: 'Sales',
  MANAGE: 'Manage',
  DRIVER: 'Driver',
};

// Per-role palette: badge surface, the leading dot, the monogram tint, and the
// raw accent colour (CSS var) used for the ledger-style left bar. All reference
// design tokens so the white-label theme stays in control.
const ROLE_STYLE: Record<
  string,
  { badge: string; dot: string; avatar: string; accent: string }
> = {
  OWNER: { badge: 'bg-foreground text-background', dot: 'bg-background', avatar: 'bg-foreground text-background', accent: 'var(--foreground)' },
  SUPER_ADMIN: { badge: 'bg-foreground/80 text-background', dot: 'bg-background', avatar: 'bg-foreground/80 text-background', accent: 'var(--foreground)' },
  ADMIN: { badge: 'bg-info-bg text-info-fg', dot: 'bg-info-ring', avatar: 'bg-info-bg text-info-fg', accent: 'var(--info-ring)' },
  SALES: { badge: 'bg-success-bg text-success-fg', dot: 'bg-success-ring', avatar: 'bg-success-bg text-success-fg', accent: 'var(--success-ring)' },
  DRIVER: { badge: 'bg-warning-bg text-warning-fg', dot: 'bg-warning-ring', avatar: 'bg-warning-bg text-warning-fg', accent: 'var(--warning-ring)' },
  MANAGE: { badge: 'bg-neutral-bg text-neutral-fg', dot: 'bg-neutral-ring', avatar: 'bg-neutral-bg text-neutral-fg', accent: 'var(--neutral-ring)' },
};
const fallbackStyle = { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', avatar: 'bg-muted text-muted-foreground', accent: 'var(--muted-foreground)' };
const roleStyle = (r: string) => ROLE_STYLE[r] ?? fallbackStyle;

const ROLES = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'SALES', 'MANAGE', 'DRIVER'] as const;

function initials(name: string): string {
  // Drop "[Role]"-style tag prefixes, then any leftover punctuation, so
  // "[Admin] Dhito" → "D" and "Budi [VIP] Santoso" → "BS".
  const clean = name
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  return (
    (clean || name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

function RoleBadge({ role }: { role: string }) {
  const s = roleStyle(role);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide', s.badge)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold ring-1 ring-foreground/10 ring-inset',
        roleStyle(role).avatar,
      )}
    >
      {initials(name)}
    </span>
  );
}

function Rek({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <CreditCard className="size-3.5 shrink-0 text-muted-foreground" />
      {value}
    </span>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  chip,
  accent,
  delay,
}: {
  label: string;
  value: number;
  icon: typeof UsersIcon;
  chip: string;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl leading-none tabular-nums" style={serif}>
            {value.toLocaleString('id-ID')}
          </div>
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', chip)}>
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function UserCard({ user, isSuperAdmin, isOwner, delay }: { user: UserRow; isSuperAdmin: boolean; isOwner: boolean; delay: number }) {
  const s = roleStyle(user.role);
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-card p-3 pl-4 ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300',
        !user.isActive && 'opacity-55',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.accent }} />
      <div className="flex items-start gap-3">
        <Avatar name={user.name} role={user.role} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{user.name}</span>
            <RoleBadge role={user.role} />
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">@{user.username}</div>
          {user.phone && <div className="mt-0.5 text-xs text-muted-foreground">{user.phone}</div>}
          <div className="mt-1">
            <Rek value={user.rekBank} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{user._count.entries} entry</span>
            <span>·</span>
            <span>{formatDate(user.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <UserToggle userId={user.id} isActive={user.isActive} />
          <UserForm
            user={user}
            isSuperAdmin={isSuperAdmin}
            isOwner={isOwner}
            trigger={
              <Button variant="ghost" size="icon" className="size-8">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}

export function UsersAdminView({
  users,
  isSuperAdmin,
  isOwner,
}: {
  users: UserRow[];
  isSuperAdmin: boolean;
  isOwner: boolean;
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (!showInactive) list = list.filter((u) => u.isActive);
    if (roleFilter.size > 0) list = list.filter((u) => roleFilter.has(u.role));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.phone?.toLowerCase().includes(q) ?? false) ||
          (u.rekBank?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [users, search, roleFilter, showInactive]);

  const visibleRoles = ROLES.filter((r) => {
    if (r === 'OWNER') return isOwner;
    if (r === 'SUPER_ADMIN') return isSuperAdmin;
    return true;
  });

  function resetAll() {
    setSearch('');
    setRoleFilter(new Set());
    setShowInactive(false);
  }

  const hasFilter = search || roleFilter.size > 0 || showInactive;

  // Headline figures for the registry strip.
  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length;
    const sales = users.filter((u) => u.role === 'SALES').length;
    const entries = users.reduce((s, u) => s + u._count.entries, 0);
    return { total: users.length, active, sales, entries };
  }, [users]);

  return (
    <div className="space-y-4">
      {/* Registry headline strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total User" value={stats.total} icon={UsersIcon} chip="bg-foreground/10 text-foreground" accent="var(--foreground)" delay={0} />
        <StatTile label="Aktif" value={stats.active} icon={UserCheck} chip="bg-success-bg text-success-fg" accent="var(--success-ring)" delay={60} />
        <StatTile label="Sales" value={stats.sales} icon={Wallet} chip="bg-info-bg text-info-fg" accent="var(--info-ring)" delay={120} />
        <StatTile label="Total Entry" value={stats.entries} icon={Package} chip="bg-warning-bg text-warning-fg" accent="var(--warning-ring)" delay={180} />
      </div>

      <Card className="overflow-hidden p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b bg-muted/20 p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, username, telepon, rekening…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
            />
          </div>

          {/* Role multi-select dropdown */}
          <div ref={roleDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setRoleDropdownOpen((o) => !o)}
              className={cn(
                'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 dark:bg-input/30',
                roleFilter.size > 0 && 'font-medium ring-1 ring-foreground/20',
              )}
            >
              {roleFilter.size === 0 ? 'Semua Role' : Array.from(roleFilter).map((r) => ROLE_LABELS[r] ?? r).join(', ')}
              <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', roleDropdownOpen && 'rotate-180')} />
            </button>
            {roleDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-card py-1 shadow-lg dark:bg-popover">
                {visibleRoles.map((role) => {
                  const checked = roleFilter.has(role);
                  return (
                    <label key={role} className="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setRoleFilter((prev) => {
                            const next = new Set(prev);
                            if (checked) next.delete(role);
                            else next.add(role);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 rounded border-border accent-foreground"
                      />
                      <span className={cn('size-1.5 rounded-full', roleStyle(role).dot)} />
                      {ROLE_LABELS[role]}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-foreground"
            />
            Tampilkan nonaktif
          </label>

          {hasFilter && (
            <button type="button" onClick={resetAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3" /> Reset
            </button>
          )}

          <span className="ml-auto inline-flex items-baseline gap-1 rounded-full bg-muted px-3 py-1 text-muted-foreground">
            <span className="text-sm leading-none text-foreground" style={serif}>
              {filtered.length}
            </span>
            <span className="text-xs">/ {users.length}</span>
          </span>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-2.5 pl-5 pr-4 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Telepon</th>
                <th className="px-4 py-2.5 font-semibold">Rekening</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 text-center font-semibold">Entry</th>
                <th className="px-4 py-2.5 font-semibold">Terdaftar</th>
                <th className="px-4 py-2.5 text-center font-semibold">Aktif</th>
                <th className="px-4 py-2.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => {
                const s = roleStyle(user.role);
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      'group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300',
                      !user.isActive && 'opacity-55',
                    )}
                    style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                  >
                    <td className="relative py-2.5 pl-5 pr-4">
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.accent }} />
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} role={user.role} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{user.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {user.phone || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Rek value={user.rekBank} />
                    </td>
                    <td className="px-4 py-2.5">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-2.5 text-center font-medium tabular-nums">{user._count.entries}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <UserToggle userId={user.id} isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <UserForm
                        user={user}
                        isSuperAdmin={isSuperAdmin}
                        isOwner={isOwner}
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8 opacity-60 transition-opacity group-hover:opacity-100">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
                      <UsersIcon className="size-5 text-muted-foreground/50" />
                    </span>
                    <p className="mt-3 text-sm text-muted-foreground">Tidak ada user ditemukan.</p>
                    {hasFilter && (
                      <button type="button" onClick={resetAll} className="mt-1 text-xs text-foreground underline-offset-2 hover:underline">
                        Reset filter
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-2 p-3 md:hidden">
          {filtered.map((user, i) => (
            <UserCard key={user.id} user={user} isSuperAdmin={isSuperAdmin} isOwner={isOwner} delay={Math.min(i * 30, 250)} />
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
                <UsersIcon className="size-5 text-muted-foreground/50" />
              </span>
              <p className="mt-3 text-sm text-muted-foreground">Tidak ada user ditemukan.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
