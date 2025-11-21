import jwt from "jsonwebtoken";
import { TokenHandlerAdapter } from "./token-handler-adapter";
import { FakeData } from "../tests/fake-data";

jest.mock("jsonwebtoken", () => ({
    sign: jest.fn(),
    verify: jest.fn(),
}));

describe("TokenHandlerAdapter", () => {
    const signMock = jest.mocked(jwt.sign) as unknown as jest.MockedFunction<
        (payload: any, secretOrPrivateKey: jwt.Secret, options?: jwt.SignOptions) => string
    >;
    const verifyMock = jest.mocked(jwt.verify) as unknown as jest.MockedFunction<
        (token: string, secretOrPublicKey: jwt.Secret) => any
    >;
    const originalEnv = process.env;
    let sut: TokenHandlerAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.JWT_SECRET = FakeData.uuid();
        sut = new TokenHandlerAdapter();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test("generateToken should sign payload with secret and default expiresIn", () => {
        const payload = { id: FakeData.uuid(), email: FakeData.email() };
        const token = FakeData.uuid();
        signMock.mockReturnValueOnce(token);

        const result = sut.generateToken(payload);

        expect(signMock).toHaveBeenCalledTimes(1);
        expect(signMock).toHaveBeenCalledWith(payload, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });
        expect(result).toBe(token);
    });

    test("generateToken should throw if jwt.sign throws", () => {
        const payload = { id: FakeData.uuid() };
        const error = new Error(FakeData.phrase());
        signMock.mockImplementationOnce(() => {
            throw error;
        });

        expect(() => sut.generateToken(payload)).toThrow(error);
    });

    test("verifyToken should verify token with secret key and return payload", () => {
        const token = FakeData.uuid();
        const decoded = { user: FakeData.uuid() };
        verifyMock.mockReturnValueOnce(decoded);

        const result = sut.verifyToken(token);

        expect(verifyMock).toHaveBeenCalledTimes(1);
        expect(verifyMock).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
        expect(result).toBe(decoded);
    });

    test("verifyToken should throw if jwt.verify throws", () => {
        const token = FakeData.uuid();
        const error = new Error(FakeData.phrase());
        verifyMock.mockImplementationOnce(() => {
            throw error;
        });

        expect(() => sut.verifyToken(token)).toThrow(error);
    });
});
