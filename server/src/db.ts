import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// DATE columns ko string ki tarah return karo (YYYY-MM-DD)
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});