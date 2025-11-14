import bcrypt from "bcryptjs";

export class HasherAdapter {
    private saltRounds: number;

    public constructor() {
        this.saltRounds = 15;
    }

    public async hash(content: string): Promise<string> {
        return await bcrypt.hash(content, this.saltRounds);
    }

    public async compareHash(input: {
        content: string;
        hash: string;
    }): Promise<boolean> {
        return await bcrypt.compare(input.content, input.hash);
    }
}