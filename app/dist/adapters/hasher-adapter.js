import bcrypt from "bcryptjs";
export class HasherAdapter {
    constructor() {
        this.saltRounds = 15;
    }
    async hash(content) {
        return await bcrypt.hash(content, this.saltRounds);
    }
    async compareHash(input) {
        return await bcrypt.compare(input.content, input.hash);
    }
}
