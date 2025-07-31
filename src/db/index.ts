import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '~/env';

// Create postgres client
const client = postgres(env.DATABASE_URL);

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export types for compatibility
export type Database = typeof db;

// Export schema for type inference
export { schema };