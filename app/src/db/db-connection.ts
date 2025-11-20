import { AsyncLocalStorage } from "async_hooks";
import { Pool, PoolClient, QueryResult } from "pg";

export class DbConnection {
    private static pool: Pool | undefined;
    private static transactionContext = new AsyncLocalStorage<PoolClient>();

    private static ensurePool(): Pool {
        if (!DbConnection.pool) {
            throw new Error("Database connection has not been initialized");
        }
        return DbConnection.pool;
    }

    public static async connect() {
        if (!DbConnection.pool) {
            const pool = new Pool({
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                password: process.env.DB_PASSWORD,
                port: Number(process.env.DB_PORT),
            });

            pool.on("error", (error) => {
                console.error("Unexpected database error", error);
            });

            DbConnection.pool = pool;
        }

        await DbConnection.pool.query("SELECT 1");
    }

    public static async disconnect() {
        if (DbConnection.pool) {
            await DbConnection.pool.end();
            DbConnection.pool = undefined;
        }
    }

    public static async runInTransaction<T>(handler: () => Promise<T>) {
        const pool = DbConnection.ensurePool();
        const client = await pool.connect();

        return DbConnection.transactionContext.run(client, async () => {
            await client.query("BEGIN");

            try {
                const result = await handler();
                await client.query("COMMIT");
                return result;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public static async query(query: {
        sql: string;
        params: any[];
    }): Promise<any[]> {
        const pool = DbConnection.ensurePool();

        const transactionClient = DbConnection.transactionContext.getStore();

        const client: { query: (sql: string, params: any[]) => Promise<QueryResult> } =
            transactionClient ?? pool;

        const result = await client.query(query.sql, query.params);
        return result.rows;
    }
}
