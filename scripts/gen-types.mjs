// Regenerates src/lib/database.types.ts from the local database. Writes the file only when the
// Supabase CLI succeeds, so a stopped database can't replace the types with an error message.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Run the CLI's entry script with this Node binary (no shell needed on any platform).
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, 'gen', 'types', 'typescript', '--local', '--schema', 'public'], {
  encoding: 'utf8',
});

if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error(result.stderr || result.stdout || 'supabase gen types failed');
  console.error('Types not updated. Is the local database running? (npm run db:start)');
  process.exit(1);
}

writeFileSync(new URL('../src/lib/database.types.ts', import.meta.url), result.stdout);
console.log('Updated src/lib/database.types.ts');
