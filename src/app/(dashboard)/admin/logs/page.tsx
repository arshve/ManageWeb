import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { LogsClient } from '@/components/dashboard/logs-client';
import type { Prisma } from '@/generated/prisma/client';

type SearchParams = {
  entity?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  q?: string;
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const where: Prisma.AuditLogWhereInput = {};

  if (params.entity && params.entity !== 'ALL') {
    where.entity = params.entity;
  }
  if (
    params.action &&
    ['CREATE', 'UPDATE', 'DELETE'].includes(params.action)
  ) {
    where.action = params.action as 'CREATE' | 'UPDATE' | 'DELETE';
  }
  if (params.actorId && params.actorId !== 'ALL') {
    where.actorId = params.actorId;
  }
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) {
      const d = new Date(params.from);
      if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (params.to) {
      const d = new Date(params.to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
  }
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    where.OR = [
      { label: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q, mode: 'insensitive' } },
      { actorName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [logs, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.profile.findMany({
      where: { role: { in: ['ADMIN', 'MANAGE', 'SALES'] } },
      select: { id: true, name: true, username: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const serialized = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    actorId: log.actorId,
    actorName: log.actorName,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    label: log.label,
    before: log.before,
    after: log.after,
  }));

  return (
    <DashboardShell
      title="Log Aktivitas"
      description={`${logs.length} catatan perubahan${logs.length === 500 ? ' (maks 500 terbaru)' : ''}`}
    >
      <Card>
        <CardContent className="p-0">
          <LogsClient
            logs={serialized}
            actors={actors}
            initial={{
              entity: params.entity ?? 'ALL',
              action: params.action ?? 'ALL',
              actorId: params.actorId ?? 'ALL',
              from: params.from ?? '',
              to: params.to ?? '',
              q: params.q ?? '',
            }}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
