import { Pool, PoolClient } from "pg";

export class DbConnection {
    private static connection: PoolClient;

    public static async connect() {
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

    public static async disconnect() {
        await DbConnection.connection.release();
    }

    public static async open() {
        if (!DbConnection.connection) {
            throw new Error("Database connection has not been initialized");
        }
        await DbConnection.connection.query("BEGIN");
    }

    public static async startTransaction() {
        await DbConnection.open();
    }

    public static async commit() {
        await DbConnection.connection.query("COMMIT");
    }

    public static async rollback() {
        await DbConnection.connection.query("ROLLBACK");
    }

    public static async query(query: {
        sql: string;
        params: any[];
    }): Promise<any[]> {
        if (!DbConnection.connection) {
            throw new Error("Database connection has not been initialized");
        }
        const result = await DbConnection.connection.query(
            query.sql,
            query.params
        );
        return result.rows;
    }
}
