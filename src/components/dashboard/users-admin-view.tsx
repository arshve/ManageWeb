'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
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

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SALES: 'Sales',
  MANAGE: 'Manage',
  DRIVER: 'Driver',
};

const ROLES = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'SALES', 'MANAGE', 'DRIVER'] as const;

const ELEVATED_ROLES = new Set(['OWNER', 'SUPER_ADMIN', 'ADMIN']);

function UserCard({ user, isSuperAdmin, isOwner }: { user: UserRow; isSuperAdmin: boolean; isOwner: boolean }) {
  return (
    <div className={cn(
      'border rounded-lg',
      !user.isActive && 'opacity-60 bg-muted/30',
    )}>
      <div className="flex items-start justify-between p-3 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{user.name}</span>
            <Badge variant={ELEVATED_ROLES.has(user.role) ? 'default' : 'secondary'}>
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">@{user.username}</div>
          {user.phone && (
            <div className="text-xs text-muted-foreground mt-0.5">{user.phone}</div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5">
            <span>{user._count.entries} entry</span>
            <span>·</span>
            <span>{formatDate(user.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
          (u.phone?.toLowerCase().includes(q) ?? false),
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

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b">
        <Input
          placeholder="Cari nama / username / telepon"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full sm:max-w-xs"
        />

        {/* Role multi-select dropdown */}
        <div ref={roleDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setRoleDropdownOpen((o) => !o)}
            className={cn(
              'h-8 rounded-md border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-1.5 whitespace-nowrap dark:bg-input/30',
              roleFilter.size > 0 ? 'border-border font-medium' : 'border-border',
            )}
          >
            {roleFilter.size === 0
              ? 'Semua Role'
              : Array.from(roleFilter).map((r) => ROLE_LABELS[r] ?? r).join(', ')}
            <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {roleDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 min-w-[130px] rounded-md border border-border bg-card shadow-md py-1 dark:bg-popover dark:border-border">
              {visibleRoles.map((role) => {
                const checked = roleFilter.has(role);
                return (
                  <label
                    key={role}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent cursor-pointer select-none"
                  >
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
                    {ROLE_LABELS[role]}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Show inactive checkbox */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-foreground"
          />
          Tampilkan nonaktif
        </label>

        {hasFilter && (
          <button
            type="button"
            onClick={resetAll}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Reset
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} dari {users.length}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nama</th>
              <th className="text-left p-3 font-medium">Username</th>
              <th className="text-left p-3 font-medium">Telepon</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-center p-3 font-medium">Entry</th>
              <th className="text-left p-3 font-medium">Terdaftar</th>
              <th className="text-center p-3 font-medium">Aktif</th>
              <th className="text-right p-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className={cn('border-b last:border-0', !user.isActive && 'opacity-60 bg-muted/30')}>
                <td className="p-3 font-medium">{user.name}</td>
                <td className="p-3 text-muted-foreground">{user.username}</td>
                <td className="p-3">{user.phone || '-'}</td>
                <td className="p-3">
                  <Badge variant={ELEVATED_ROLES.has(user.role) ? 'default' : 'secondary'}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </td>
                <td className="p-3 text-center">{user._count.entries}</td>
                <td className="p-3 text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
                <td className="p-3 text-center">
                  <UserToggle userId={user.id} isActive={user.isActive} />
                </td>
                <td className="p-3 text-right">
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
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Tidak ada user ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-3 flex flex-col gap-2">
        {filtered.map((user) => (
          <UserCard key={user.id} user={user} isSuperAdmin={isSuperAdmin} isOwner={isOwner} />
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada user ditemukan.
          </div>
        )}
      </div>
    </Card>
  );
}
