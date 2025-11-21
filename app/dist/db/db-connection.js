import { Pool } from "pg";
export class DbConnection {
    static async connect() {
        const databasePool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT),
        });
        if (!DbConnection.connection) {
            DbConnection.connection = await databasePool.connect();
        }
    }
    static async disconnect() {
        await DbConnection.connection.release();
    }
    static async open() {
        if (!DbConnection.connection) {
            throw new Error("Database connection has not been initialized");
        }
        await DbConnection.connection.query("BEGIN");
    }
    static async startTransaction() {
        await DbConnection.open();
    }
    static async commit() {
        await DbConnection.connection.query("COMMIT");
    }
    static async rollback() {
        await DbConnection.connection.query("ROLLBACK");
    }
    static async query(query) {
        if (!DbConnection.connection) {
            throw new Error("Database connection has not been initialized");
        }
        const result = await DbConnection.connection.query(query.sql, query.params);
        return result.rows;
    }
}
