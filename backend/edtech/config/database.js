import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://grid:strongpassword@187.127.139.208:5432/edtech",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

export default pool;