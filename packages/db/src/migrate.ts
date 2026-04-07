import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadEnv({ path: resolve(__dirname, '../../../.env') });

await runMigrations();
console.log('Database migrations completed successfully.');
