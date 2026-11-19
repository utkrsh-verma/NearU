import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const isSslNeeded = Boolean(
      process.env.DATABASE_URL?.includes('supabase.co') ||
      process.env.DATABASE_URL?.includes('pooler.supabase.com') ||
      process.env.SQL_HOST?.includes('supabase.co') ||
      process.env.NODE_ENV === 'production'
    );

    const poolConfig: PoolConfig = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: isSslNeeded ? { rejectUnauthorized: false } : undefined,
          max: 10,
          connectionTimeoutMillis: 15000,
        }
      : {
          host: process.env.SQL_HOST || 'localhost',
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || '',
          database: process.env.SQL_DB_NAME || 'postgres',
          port: Number(process.env.SQL_PORT) || 5432,
          ssl: isSslNeeded ? { rejectUnauthorized: false } : undefined,
          max: 10,
          connectionTimeoutMillis: 15000,
        };

    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
