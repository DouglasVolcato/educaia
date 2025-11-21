import { v6 } from "uuid";
export class UuidGeneratorAdapter {
    static generate() {
        return v6();
    }
}
