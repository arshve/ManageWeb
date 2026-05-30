/**
 * One-time helper: promote an existing user to the OWNER role.
 *
 * OWNER is the top-level white-label role (branding + data export/import).
 * There is no self-service UI to create the first owner — run this once after
 * deploying:
 *
 *   npx tsx prisma/promote-owner.ts <username>
 *
 * Subsequent owners can be created through the normal user-management UI by an
 * existing OWNER.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma/client';

const localPath = path.join(process.cwd(), '.env.local');
config({
  path: existsSync(localPath) ? localPath : path.join(process.cwd(), '.env'),
  override: true,
});

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npx tsx prisma/promote-owner.ts <username>');
    process.exit(1);
  }

  const user = await prisma.profile.findUnique({ where: { username } });
  if (!user) {
    console.error(`User "${username}" not found.`);
    process.exit(1);
  }

  if (user.role === 'OWNER') {
    console.log(`User "${username}" is already OWNER. Nothing to do.`);
    return;
  }

  await prisma.profile.update({
    where: { username },
    data: { role: 'OWNER' },
  });
  console.log(`Promoted "${username}" (${user.name}) from ${user.role} → OWNER.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
