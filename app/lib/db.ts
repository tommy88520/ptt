import "server-only";
import { Pool } from "pg";

const globalForPool = globalThis as unknown as { pgPool?: Pool };

// dev 模式 HMR 會重複執行這個模組，掛在 globalThis 上避免每次都開新的連線池
export const db: Pool = globalForPool.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (process.env.NODE_ENV !== "production") globalForPool.pgPool = db;
