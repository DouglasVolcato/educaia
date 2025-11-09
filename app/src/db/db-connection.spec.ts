import { DbConnection } from "./db-connection";
import { FakeData } from "../tests/fake-data";
import { Pool, PoolClient } from "pg";

const mockPoolClient = (): jest.Mocked<PoolClient> => {
    return {} as any
}
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
    }
}

describe("DbConnection", () => {
    beforeEach(() => {
        (DbConnection as any).connection = undefined
        jest.clearAllMocks();
    });

    test("Connect should create a new pool with right values", async () => {
        const envVars = mockEnvVars()
        const sut = DbConnection
        await sut.connect()
        expect(Pool).toHaveBeenCalledTimes(1)
        expect(Pool).toHaveBeenCalledWith(envVars)
    })

    test("Connect should connect to database", async () => {
        const sut = DbConnection
        await sut.connect()
        expect(mockConnect).toHaveBeenCalledTimes(1)
        expect(mockConnect).toHaveBeenCalledWith()
    })

    test("Should throw if connection throws", async () => {
        const sut = DbConnection;
        mockConnect.mockImplementationOnce(() => {
            throw new Error(FakeData.phrase())
        })
        expect(async () => await sut.connect()).rejects.toThrow()
    })

    test("Should save the new connection", async () => {
        const sut = DbConnection;
        await sut.connect()
        expect((sut as any).connection).toEqual(mockPoolClient())
    })

    test("Should not create a new connection is a connection already existed", async () => {
        const newConnection = FakeData.uuid();
        const sut = DbConnection;
        expect((sut as any).connection).toBeUndefined()
        mockConnect.mockImplementationOnce(() => (newConnection as any))
        await sut.connect()
        expect((sut as any).connection).toBe(newConnection)
        mockConnect.mockImplementationOnce(() => (FakeData.uuid() as any))
        await sut.connect()
        expect((sut as any).connection).toBe(newConnection)
    })
})