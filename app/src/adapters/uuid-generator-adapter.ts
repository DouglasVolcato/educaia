import { v6 } from "uuid";

export class UuidGeneratorAdapter {
    public static generate(): string {
        return v6();
    }
}