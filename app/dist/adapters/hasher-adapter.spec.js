import { HasherAdapter } from "./hasher-adapter";
import { FakeData } from "@tests/fake-data";
import bcrypt from "bcryptjs";
jest.mock("bcryptjs", () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));
describe("HasherAdapter", () => {
    const hashMock = bcrypt.hash;
    const compareMock = bcrypt.compare;
    let sut;
    beforeEach(() => {
        jest.clearAllMocks();
        sut = new HasherAdapter();
    });
    test("hash should call bcrypt.hash with the provided content and salt rounds", async () => {
        const content = FakeData.password();
        const hashedValue = FakeData.uuid();
        hashMock.mockResolvedValueOnce(hashedValue);
        const result = await sut.hash(content);
        expect(hashMock).toHaveBeenCalledTimes(1);
        expect(hashMock).toHaveBeenCalledWith(content, 15);
        expect(result).toBe(hashedValue);
    });
    test("hash should throw if bcrypt.hash rejects", async () => {
        const content = FakeData.password();
        const error = new Error(FakeData.phrase());
        hashMock.mockRejectedValueOnce(error);
        await expect(sut.hash(content)).rejects.toThrow(error);
    });
    test("compareHash should call bcrypt.compare with the provided params", async () => {
        const input = { content: FakeData.password(), hash: FakeData.uuid() };
        compareMock.mockResolvedValueOnce(true);
        const result = await sut.compareHash(input);
        expect(compareMock).toHaveBeenCalledTimes(1);
        expect(compareMock).toHaveBeenCalledWith(input.content, input.hash);
        expect(result).toBe(true);
    });
    test("compareHash should throw if bcrypt.compare rejects", async () => {
        const input = { content: FakeData.password(), hash: FakeData.uuid() };
        const error = new Error(FakeData.phrase());
        compareMock.mockRejectedValueOnce(error);
        await expect(sut.compareHash(input)).rejects.toThrow(error);
    });
});
