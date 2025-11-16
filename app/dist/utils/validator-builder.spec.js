import { FakeData } from "@tests/fake-data";
import { ValidatorBuilder, ValidatorTypeEnum } from "./validator-builder";
const makeValidator = ({ field, types, message, }) => {
    const builder = new ValidatorBuilder().setField(field).setMessage(message);
    for (const type of types) {
        builder.addType(type);
    }
    return builder.build();
};
describe("ValidatorBuilder", () => {
    test("should allow chaining field, types and message before build", () => {
        const field = FakeData.word();
        const message = FakeData.phrase();
        const validator = new ValidatorBuilder()
            .setField(field)
            .addType(ValidatorTypeEnum.REQUIRED)
            .addType(ValidatorTypeEnum.STRING)
            .setMessage(message)
            .build();
        const result = validator.validate({ [field]: FakeData.word() });
        expect(result).toBeUndefined();
    });
    test("should return message when required field is missing", () => {
        const field = FakeData.word();
        const message = FakeData.phrase();
        const validator = makeValidator({
            field,
            types: [ValidatorTypeEnum.REQUIRED],
            message,
        });
        const result = validator.validate({});
        expect(result).toBe(message);
    });
    test("should not return message when required field is zero or empty string", () => {
        const field = FakeData.word();
        const message = FakeData.phrase();
        const validator = makeValidator({
            field,
            types: [ValidatorTypeEnum.REQUIRED],
            message,
        });
        expect(validator.validate({ [field]: "" })).toBeUndefined();
        expect(validator.validate({ [field]: 0 })).toBeUndefined();
    });
    test("should validate email format", () => {
        const field = FakeData.word();
        const message = FakeData.phrase();
        const validator = makeValidator({
            field,
            types: [ValidatorTypeEnum.EMAIL],
            message,
        });
        expect(validator.validate({ [field]: "invalid-email" })).toBe(message);
        expect(validator.validate({ [field]: FakeData.email() })).toBeUndefined();
    });
    test("should ensure string type receives strings only", () => {
        const field = FakeData.word();
        const message = FakeData.phrase();
        const validator = makeValidator({
            field,
            types: [ValidatorTypeEnum.STRING],
            message,
        });
        expect(validator.validate({ [field]: 123 })).toBe(message);
        expect(validator.validate({ [field]: FakeData.word() })).toBeUndefined();
    });
    test("should validate numeric values even when provided as strings", () => {
        const field = FakeData.word();
        const message = FakeData.phrase();
        const validator = makeValidator({
            field,
            types: [ValidatorTypeEnum.NUMBER],
            message,
        });
        expect(validator.validate({ [field]: "abc" })).toBe(message);
        expect(validator.validate({ [field]: FakeData.numberInteger() })).toBeUndefined();
        expect(validator.validate({ [field]: String(FakeData.numberInteger()) })).toBeUndefined();
    });
});
