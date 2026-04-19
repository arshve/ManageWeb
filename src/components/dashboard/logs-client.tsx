'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Search } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

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

const ENTITIES = ['Entry', 'Livestock', 'Profile', 'Pricing'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;

export function LogsClient({
  logs,
  actors,
  initial,
}: {
  logs: LogItem[];
  actors: Actor[];
  initial: Filters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(initial);

  function apply(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    const params = new URLSearchParams();
    if (merged.entity !== 'ALL') params.set('entity', merged.entity);
    if (merged.action !== 'ALL') params.set('action', merged.action);
    if (merged.actorId !== 'ALL') params.set('actorId', merged.actorId);
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    if (merged.q.trim()) params.set('q', merged.q.trim());
    const qs = params.toString();
    startTransition(() => {
      router.push(`/admin/logs${qs ? `?${qs}` : ''}`);
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
              {filters.entity === 'ALL' ? 'Semua Entitas' : filters.entity}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Entitas</SelectItem>
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
              {filters.action === 'ALL' ? 'Semua Aksi' : filters.action}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Aksi</SelectItem>
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
          className={`h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pl-16">
          {diff.length === 0 ? (
            <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(log.after ?? log.before ?? {}, null, 2)}
            </pre>
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
                  <dd className="text-destructive/90 break-all whitespace-pre-wrap">
                    {row.before}
                  </dd>
                  <dd className="text-primary break-all whitespace-pre-wrap">
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

function ActionBadge({ action }: { action: LogItem['action'] }) {
  const map = {
    CREATE: 'bg-primary/10 text-primary',
    UPDATE: 'bg-yellow-500/10 text-yellow-700',
    DELETE: 'bg-destructive/10 text-destructive',
  } as const;
  return (
    <Badge
      variant="outline"
      className={`${map[action]} text-[10px] shrink-0 mt-0.5`}
    >
      {action}
    </Badge>
  );
}

function computeDiff(
  before: unknown,
  after: unknown,
): { key: string; before: string; after: string }[] {
  const a = (before && typeof before === 'object' ? before : {}) as Record<
    string,
    unknown
  >;
  const b = (after && typeof after === 'object' ? after : {}) as Record<
    string,
    unknown
  >;
  const keys = Array.from(
    new Set([...Object.keys(a), ...Object.keys(b)]),
  ).sort();
  const rows: { key: string; before: string; after: string }[] = [];
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    const av = a[key];
    const bv = b[key];
    if (JSON.stringify(av) === JSON.stringify(bv)) continue;
    rows.push({
      key,
      before: stringify(av),
      after: stringify(bv),
    });
  }
  return rows;
}

function stringify(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}
