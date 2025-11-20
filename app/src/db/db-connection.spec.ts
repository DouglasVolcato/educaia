import { DbConnection } from "./db-connection";
import { FakeData } from "../tests/fake-data";
import { AsyncLocalStorage } from "async_hooks";
import { Pool, PoolClient } from "pg";

const mockPoolClient = (): jest.Mocked<PoolClient> => ({
    query: jest.fn(),
    release: jest.fn(),
} as any);

const mockPoolQuery = jest.fn();
const mockPoolConnect = jest.fn(mockPoolClient);
const mockPoolEnd = jest.fn();
const mockPoolOn = jest.fn();

jest.mock("pg", () => ({
    Pool: jest.fn(() => ({
        query: mockPoolQuery,
        connect: mockPoolConnect,
        end: mockPoolEnd,
        on: mockPoolOn,
    })),
}));

const mockEnvVars = () => {
    const user = FakeData.word();
    const host = FakeData.url();
    const database = FakeData.phrase();
    const password = FakeData.password();
    const port = FakeData.numberInteger();

    process.env.DB_USER = user;
    process.env.DB_HOST = host;
    process.env.DB_NAME = database;
    process.env.DB_PASSWORD = password;
    process.env.DB_PORT = String(port);

    return {
        user,
        host,
        database,
        password,
        port,
    }
}

describe("DbConnection", () => {
    beforeEach(() => {
        (DbConnection as any).pool = undefined;
        (DbConnection as any).transactionContext = new AsyncLocalStorage<PoolClient>();
        jest.clearAllMocks();
    });

    describe("Connect", () => {
        test("Connect should create a new pool with right values", async () => {
            const envVars = mockEnvVars()
            const sut = DbConnection
            mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any)
            await sut.connect()
            expect(Pool).toHaveBeenCalledTimes(1)
            expect(Pool).toHaveBeenCalledWith(envVars)
        })

        test("Connect should ping the database", async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any)
            await DbConnection.connect()
            expect(mockPoolQuery).toHaveBeenCalledTimes(1)
            expect(mockPoolQuery).toHaveBeenCalledWith("SELECT 1")
        })

        test("Should not create a new pool if one already exists", async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] } as any)
            await DbConnection.connect()
            await DbConnection.connect()
            expect(Pool).toHaveBeenCalledTimes(1)
        })
    })

    describe("Disconnect", () => {
        test("Should call pool end when pool exists", async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] } as any)
            await DbConnection.connect();
            await DbConnection.disconnect();
            expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        })

        test("Should throw if pool end throws", async () => {
            const error = new Error(FakeData.phrase());
            mockPoolEnd.mockRejectedValueOnce(error);
            (DbConnection as any).pool = { end: mockPoolEnd } as unknown as Pool;
            await expect(DbConnection.disconnect()).rejects.toThrow(error);
        })
    })

    describe("runInTransaction", () => {
        test("Should wrap handler in a transaction and release the client", async () => {
            const beginSpy = jest.fn().mockResolvedValue(undefined);
            const commitSpy = jest.fn().mockResolvedValue(undefined);
            const releaseSpy = jest.fn().mockResolvedValue(undefined);
            const pool = {
                connect: jest.fn().mockResolvedValue({
                    query: jest
                        .fn()
                        .mockImplementationOnce(beginSpy)
                        .mockImplementationOnce(commitSpy),
                    release: releaseSpy,
                }),
            } as unknown as Pool;

            (DbConnection as any).pool = pool;

            const result = await DbConnection.runInTransaction(async () => FakeData.numberInteger());

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(beginSpy).toHaveBeenCalledWith("BEGIN");
            expect(commitSpy).toHaveBeenCalledWith("COMMIT");
            expect(releaseSpy).toHaveBeenCalledTimes(1);
            expect(result).toBeDefined();
        });

        test("Should rollback and rethrow when handler fails", async () => {
            const beginSpy = jest.fn().mockResolvedValue(undefined);
            const rollbackSpy = jest.fn().mockResolvedValue(undefined);
            const releaseSpy = jest.fn().mockResolvedValue(undefined);
            const pool = {
                connect: jest.fn().mockResolvedValue({
                    query: jest
                        .fn()
                        .mockImplementationOnce(beginSpy)
                        .mockImplementationOnce(rollbackSpy),
                    release: releaseSpy,
                }),
            } as unknown as Pool;

            (DbConnection as any).pool = pool;

            const expectedError = new Error("handler failure");

            await expect(
                DbConnection.runInTransaction(async () => {
                    throw expectedError;
                }),
            ).rejects.toThrow(expectedError);

            expect(beginSpy).toHaveBeenCalledWith("BEGIN");
            expect(rollbackSpy).toHaveBeenCalledWith("ROLLBACK");
            expect(releaseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("Query", () => {
        test("Should call pool query with received params", async () => {
            const querySpy = jest.fn().mockResolvedValue({ rows: [] });
            (DbConnection as any).pool = {
                query: querySpy,
            } as unknown as Pool;
            const queryParams = {
                sql: FakeData.phrase(),
                params: [FakeData.numberInteger(), FakeData.word()],
            };
            await DbConnection.query(queryParams);
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith(queryParams.sql, queryParams.params);
        })

        test("Should use the transaction client when called inside a transaction", async () => {
            const poolQuerySpy = jest.fn().mockResolvedValue({ rows: [] });
            const transactionQuerySpy = jest.fn().mockResolvedValue({ rows: [] });
            const releaseSpy = jest.fn().mockResolvedValue(undefined);

            (DbConnection as any).pool = {
                query: poolQuerySpy,
                connect: jest.fn().mockResolvedValue({ query: transactionQuerySpy, release: releaseSpy }),
            } as unknown as Pool;

            const queryParams = {
                sql: FakeData.phrase(),
                params: [FakeData.word()],
            };

            await DbConnection.runInTransaction(() => DbConnection.query(queryParams));

            expect(poolQuerySpy).not.toHaveBeenCalled();
            expect(transactionQuerySpy).toHaveBeenCalledWith(queryParams.sql, queryParams.params);
            expect(releaseSpy).toHaveBeenCalledTimes(1);
        })

        test("Should throw if pool is not initialized", async () => {
            await expect(
                DbConnection.query({
                    sql: FakeData.phrase(),
                    params: [FakeData.word()],
                })
            ).rejects.toThrow();
        })

        test("Should return query rows", async () => {
            const rows = [
                { id: FakeData.uuid() },
                { id: FakeData.uuid() },
            ];
            const querySpy = jest.fn().mockResolvedValue({ rows });
            (DbConnection as any).pool = {
                query: querySpy,
            } as unknown as Pool;
            const result = await DbConnection.query({
                sql: FakeData.phrase(),
                params: [FakeData.word()],
            });
            expect(result).toEqual(rows);
        })
    })
})
