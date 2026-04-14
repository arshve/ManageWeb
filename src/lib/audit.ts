import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { AuditAction } from '@/generated/prisma/client';

type Actor = { id: string; name: string } | null;

type LogInput = {
  actor: Actor;
  action: AuditAction;
  entity:
    | 'Entry'
    | 'Livestock'
    | 'Profile'
    | 'Pricing'
    | 'Delivery'
    | 'DriverAvailability';
  entityId: string;
  label?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function logAudit(input: LogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? 'system',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        label: input.label ?? null,
        before: sanitize(input.before),
        after: sanitize(input.after),
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
  }
}

function sanitize(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if (key === 'password') return '[REDACTED]';
      if (val instanceof Date) return val.toISOString();
      return val;
    }),
  ) as Prisma.InputJsonValue;
}
