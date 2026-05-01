import { config } from 'dotenv';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

// Always read .env (prod credentials), never .env.local
config({ path: path.join(process.cwd(), '.env'), override: true });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Backup failed: DIRECT_URL (or DATABASE_URL) is not set in .env');
  process.exit(1);
}

const masked = url.replace(/:\/\/[^@]+@/, '://***@');
console.log(`Backing up: ${masked}`);

const stamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
const outDir = path.join(process.cwd(), 'backups');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `prod-${stamp}.sql`);

console.log(`Output:  ${outFile}`);

const result = spawnSync(
  'pg_dump',
  ['--no-owner', '--no-privileges', '--clean', '--if-exists', url, '-f', outFile],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(`pg_dump not found: ${result.error.message}`);
  console.error('Install PostgreSQL client tools (pg_dump must be on your PATH).');
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`pg_dump exited with status ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log('');
console.log('Backup complete.');
console.log('');
console.log('To restore if something goes wrong:');
console.log(`  psql "$DIRECT_URL" -f ${outFile}`);
console.log('');
console.log('Warning: the backup file contains full database contents including hashed passwords.');
console.log('Keep it local — never commit or share.');
