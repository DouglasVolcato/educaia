import { DbConnection } from "@db/db-connection";
import { FakeData } from "@tests/fake-data";
import { Pool } from "pg";
const mockPoolClient = () => {
    return {};
};
const mockConnect = jest.fn(mockPoolClient);
jest.mock("pg", () => ({
    Pool: jest.fn(() => ({
        connect: mockConnect
    }))
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
    };
};
describe("DbConnection", () => {
    beforeEach(() => {
        DbConnection.connection = undefined;
        jest.clearAllMocks();
    });
    describe("Connect", () => {
        test("Connect should create a new pool with right values", async () => {
            const envVars = mockEnvVars();
            const sut = DbConnection;
            await sut.connect();
            expect(Pool).toHaveBeenCalledTimes(1);
            expect(Pool).toHaveBeenCalledWith(envVars);
        });
        test("Connect should connect to database", async () => {
            const sut = DbConnection;
            await sut.connect();
            expect(mockConnect).toHaveBeenCalledTimes(1);
            expect(mockConnect).toHaveBeenCalledWith();
        });
        test("Should throw if connection throws", async () => {
            const sut = DbConnection;
            mockConnect.mockImplementationOnce(() => {
                throw new Error(FakeData.phrase());
            });
            expect(async () => await sut.connect()).rejects.toThrow();
        });
        test("Should save the new connection", async () => {
            const sut = DbConnection;
            await sut.connect();
            expect(sut.connection).toEqual(mockPoolClient());
        });
        test("Should not create a new connection is a connection already existed", async () => {
            const newConnection = FakeData.uuid();
            const sut = DbConnection;
            expect(sut.connection).toBeUndefined();
            mockConnect.mockImplementationOnce(() => newConnection);
            await sut.connect();
            expect(sut.connection).toBe(newConnection);
            mockConnect.mockImplementationOnce(() => FakeData.uuid());
            await sut.connect();
            expect(sut.connection).toBe(newConnection);
        });
    });
    describe("Disconnect", () => {
        test("Should call connection release", async () => {
            const releaseSpy = jest.fn().mockResolvedValue(undefined);
            DbConnection.connection = {
                release: releaseSpy,
            };
            await DbConnection.disconnect();
            expect(releaseSpy).toHaveBeenCalledTimes(1);
            expect(releaseSpy).toHaveBeenCalledWith();
        });
        test("Should throw if connection throws", async () => {
            const error = new Error(FakeData.phrase());
            const releaseSpy = jest.fn().mockRejectedValue(error);
            DbConnection.connection = {
                release: releaseSpy,
            };
            await expect(DbConnection.disconnect()).rejects.toThrow(error);
        });
    });
    describe("StartTransaction", () => {
        test("Should call connection query with begin", async () => {
            const querySpy = jest.fn().mockResolvedValue(undefined);
            DbConnection.connection = {
                query: querySpy,
            };
            await DbConnection.startTransaction();
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith("BEGIN");
        });
        test("Should throw if connection throws", async () => {
            const error = new Error(FakeData.phrase());
            const querySpy = jest.fn().mockRejectedValue(error);
            DbConnection.connection = {
                query: querySpy,
            };
            await expect(DbConnection.startTransaction()).rejects.toThrow(error);
        });
    });
    describe("Commit", () => {
        test("Should call connection query with commit", async () => {
            const querySpy = jest.fn().mockResolvedValue(undefined);
            DbConnection.connection = {
                query: querySpy,
            };
            await DbConnection.commit();
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith("COMMIT");
        });
        test("Should throw if connection throws", async () => {
            const error = new Error(FakeData.phrase());
            const querySpy = jest.fn().mockRejectedValue(error);
            DbConnection.connection = {
                query: querySpy,
            };
            await expect(DbConnection.commit()).rejects.toThrow(error);
        });
    });
    describe("Rollback", () => {
        test("Should call connection query with rollback", async () => {
            const querySpy = jest.fn().mockResolvedValue(undefined);
            DbConnection.connection = {
                query: querySpy,
            };
            await DbConnection.rollback();
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith("ROLLBACK");
        });
        test("Should throw if connection throws", async () => {
            const error = new Error(FakeData.phrase());
            const querySpy = jest.fn().mockRejectedValue(error);
            DbConnection.connection = {
                query: querySpy,
            };
            await expect(DbConnection.rollback()).rejects.toThrow(error);
        });
    });
    describe("Query", () => {
        test("Should call connection query with received params", async () => {
            const querySpy = jest.fn().mockResolvedValue({ rows: [] });
            DbConnection.connection = {
                query: querySpy,
            };
            const queryParams = {
                sql: FakeData.phrase(),
                params: [FakeData.numberInteger(), FakeData.word()],
            };
            await DbConnection.query(queryParams);
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith(queryParams.sql, queryParams.params);
        });
        test("Should throw if connection throws", async () => {
            const error = new Error(FakeData.phrase());
            const querySpy = jest.fn().mockRejectedValue(error);
            DbConnection.connection = {
                query: querySpy,
            };
            await expect(DbConnection.query({
                sql: FakeData.phrase(),
                params: [FakeData.word()],
            })).rejects.toThrow(error);
        });
        test("Should return query rows", async () => {
            const rows = [
                { id: FakeData.uuid() },
                { id: FakeData.uuid() },
            ];
            const querySpy = jest.fn().mockResolvedValue({ rows });
            DbConnection.connection = {
                query: querySpy,
            };
            const result = await DbConnection.query({
                sql: FakeData.phrase(),
                params: [FakeData.word()],
            });
            expect(result).toEqual(rows);
        });
    });
});
