import { Pool } from "pg";
export class DbConnection {
    static async connect() {
        if (!DbConnection.pool) {
            DbConnection.pool = new Pool({
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                password: process.env.DB_PASSWORD,
                port: Number(process.env.DB_PORT),
                ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
            });
        }
    }
    static async disconnect() {
        if (DbConnection.transactionClient) {
            DbConnection.transactionClient.release();
            DbConnection.transactionClient = undefined;
        }
        if (DbConnection.pool) {
            await DbConnection.pool.end();
            DbConnection.pool = undefined;
        }
    }
    static ensurePool() {
        if (!DbConnection.pool) {
            throw new Error("Database connection has not been initialized");
        }
    }
    static async open() {
        DbConnection.ensurePool();
        if (!DbConnection.transactionClient) {
            DbConnection.transactionClient = await DbConnection.pool.connect();
        }
        await DbConnection.transactionClient.query("BEGIN");
    }
    static async startTransaction() {
        await DbConnection.open();
    }
    static async commit() {
        if (!DbConnection.transactionClient) {
            throw new Error("No transaction is currently open");
        }
        await DbConnection.transactionClient.query("COMMIT");
        DbConnection.transactionClient.release();
        DbConnection.transactionClient = undefined;
    }
    static async rollback() {
        if (!DbConnection.transactionClient) {
            throw new Error("No transaction is currently open");
        }
        await DbConnection.transactionClient.query("ROLLBACK");
        DbConnection.transactionClient.release();
        DbConnection.transactionClient = undefined;
    }
    static async query(query) {
        DbConnection.ensurePool();
        const client = DbConnection.transactionClient ?? DbConnection.pool;
        const result = await client.query(query.sql, query.params);
        return result.rows;
    }
}
