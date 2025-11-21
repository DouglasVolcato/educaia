import { UuidGeneratorAdapter } from "./uuid-generator-adapter.ts";
import { v6 as uuidv6, type Version6Options } from "uuid";
import { FakeData } from "../tests/fake-data.ts";

jest.mock("uuid", () => ({
    v6: jest.fn(),
}));

describe("UuidGeneratorAdapter", () => {
    type UuidV6StringFn = (
        options?: Version6Options,
        buffer?: undefined,
        offset?: number
    ) => string;
    const uuidMock = uuidv6 as jest.MockedFunction<UuidV6StringFn>;

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
