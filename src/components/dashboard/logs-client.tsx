'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StatusToken } from '@/components/ui/status-token';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { formatAuditValue } from '@/lib/audit-format';

export interface LogItem {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  label: string | null;
  before: unknown;
  after: unknown;
}

interface Actor {
  id: string;
  name: string;
  username: string;
}

interface Filters {
  entity: string;
  action: string;
  actorId: string;
  from: string;
  to: string;
  q: string;
}

const ENTITIES = ['Entry', 'Livestock', 'Profile', 'Pricing', 'Delivery', 'DriverAvailability', 'EntryEditRequest'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;

export function LogsClient({
  logs,
  actors,
  page,
  totalPages,
  totalCount,
  initial,
}: {
  logs: LogItem[];
  actors: Actor[];
  page: number;
  totalPages: number;
  totalCount: number;
  initial: Filters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(initial);

  function buildQs(f: Filters, p?: number) {
    const params = new URLSearchParams();
    if (f.entity !== 'ALL') params.set('entity', f.entity);
    if (f.action !== 'ALL') params.set('action', f.action);
    if (f.actorId !== 'ALL') params.set('actorId', f.actorId);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (f.q.trim()) params.set('q', f.q.trim());
    if (p && p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/admin/logs${qs ? `?${qs}` : ''}`;
  }

  function apply(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    startTransition(() => {
      router.push(buildQs(merged));
    });
  }

  function goToPage(p: number) {
    startTransition(() => {
      router.push(buildQs(filters, p));
    });
  }

  function reset() {
    apply({
      entity: 'ALL',
      action: 'ALL',
      actorId: 'ALL',
      from: '',
      to: '',
      q: '',
    });
  }

  const hasFilters =
    filters.entity !== 'ALL' ||
    filters.action !== 'ALL' ||
    filters.actorId !== 'ALL' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.q.trim() !== '';

  return (
    <div>
      {/* Filter bar */}
      <div className="p-3 border-b flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply({ q: filters.q });
            }}
            onBlur={() => {
              if (filters.q !== initial.q) apply({ q: filters.q });
            }}
            placeholder="Cari label / id / actor"
            className="h-8 text-xs pl-7"
          />
        </div>
        <Select
          value={filters.entity}
          onValueChange={(val) => apply({ entity: val ?? 'ALL' })}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue>
              {filters.entity === 'ALL' ? 'All Entities' : filters.entity}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entities</SelectItem>
            {ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.action}
          onValueChange={(val) => apply({ action: val ?? 'ALL' })}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue>
              {filters.action === 'ALL' ? 'All Actions' : filters.action}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.actorId}
          onValueChange={(val) => apply({ actorId: val ?? 'ALL' })}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue>
              {filters.actorId === 'ALL' ? 'Semua Aktor' : (actors.find((a) => a.id === filters.actorId)?.name ?? filters.actorId)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Aktor</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => apply({ from: e.target.value })}
          className="h-8 w-[140px] text-xs"
          aria-label="Dari tanggal"
        />
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => apply({ to: e.target.value })}
          className="h-8 w-[140px] text-xs"
          aria-label="Sampai tanggal"
        />
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Log list */}
      <ul className="divide-y">
        {logs.map((log) => (
          <LogRow key={log.id} log={log} />
        ))}
        {logs.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Tidak ada log yang cocok dengan filter.
          </li>
        )}
      </ul>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * 50 + 1}–{Math.min(page * 50, totalCount)} dari {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: LogItem }) {
  const [open, setOpen] = useState(false);
  const diff = computeDiff(log.before, log.after);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <ActionBadge action={log.action} />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">
            <span className="font-medium">{log.entity}</span>
            {log.label && (
              <span className="text-muted-foreground"> — {log.label}</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {log.actorName} · {formatDateTime(new Date(log.createdAt))} ·{' '}
            <span className="font-mono">{log.entityId.slice(0, 8)}</span>
          </div>
        </div>
        <ChevronDown
          className={`size-4 text-muted-foreground shrink-0 mt-1 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pl-16">
          {diff.length === 0 ? (
            <FallbackPayload payload={log.after ?? log.before} />
          ) : (
            <dl className="text-[11px] rounded border divide-y bg-muted/20">
              {diff.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] gap-2 px-2 py-1.5"
                >
                  <dt className="font-mono text-muted-foreground truncate">
                    {row.key}
                  </dt>
                  <dd className="text-destructive/90 whitespace-pre overflow-x-auto">
                    {row.before}
                  </dd>
                  <dd className="text-primary whitespace-pre overflow-x-auto">
                    {row.after}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </li>
  );
}

function FallbackPayload({ payload }: { payload: unknown }) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const entries = Object.entries(payload as Record<string, unknown>).filter(
      ([k]) => !SKIP_KEYS.has(k),
    );
    if (entries.length > 0) {
      return (
        <dl className="text-[11px] rounded border divide-y bg-muted/20">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,4fr)] gap-2 px-2 py-1.5">
              <dt className="font-mono text-muted-foreground truncate">{k}</dt>
              <dd className="text-foreground whitespace-pre overflow-x-auto">{formatAuditValue(k, v)}</dd>
            </div>
          ))}
        </dl>
      );
    }
  }
  return (
    <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre">
      {JSON.stringify(payload ?? {}, null, 2)}
    </pre>
  );
}

const ACTION_STATUS = {
  CREATE: { intent: 'info',    label: 'CREATE' },
  UPDATE: { intent: 'warning', label: 'UPDATE' },
  DELETE: { intent: 'danger',  label: 'DELETE' },
} as const;

function ActionBadge({ action }: { action: LogItem['action'] }) {
  const ds = ACTION_STATUS[action] ?? ACTION_STATUS.UPDATE;
  return (
    <StatusToken intent={ds.intent} size="sm" className="shrink-0 mt-0.5 font-mono">
      {ds.label}
    </StatusToken>
  );
}

const SKIP_KEYS = new Set(['createdAt', 'updatedAt', 'id']);

function computeDiff(
  before: unknown,
  after: unknown,
): { key: string; before: string; after: string }[] {
  const a = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>;
  const b = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const rows: { key: string; before: string; after: string }[] = [];
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const av = a[key];
    const bv = b[key];
    if (JSON.stringify(av) === JSON.stringify(bv)) continue;
    rows.push({ key, before: formatAuditValue(key, av), after: formatAuditValue(key, bv) });
  }
  return rows;
}
