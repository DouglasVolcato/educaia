import { v6 as uuidv6 } from "uuid";
import { UuidGeneratorAdapter } from "./uuid-generator-adapter";
import { FakeData } from "@tests/fake-data";
jest.mock("uuid", () => ({
    v6: jest.fn(),
}));
describe("UuidGeneratorAdapter", () => {
    const uuidMock = uuidv6;
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test("generate should return value from uuid v6", () => {
        const uuid = FakeData.uuid();
        uuidMock.mockImplementationOnce(() => uuid);
        const result = UuidGeneratorAdapter.generate();
        expect(uuidMock).toHaveBeenCalledTimes(1);
        expect(result).toBe(uuid);
    });
    test("generate should throw if uuid v6 throws", () => {
        const error = new Error(FakeData.phrase());
        uuidMock.mockImplementationOnce(() => {
            throw error;
        });
        expect(() => UuidGeneratorAdapter.generate()).toThrow(error);
    });
});
