import jwt from "jsonwebtoken";

export class TokenHandlerAdapter {
    private readonly secret: string;

    public constructor() {
        const secret = process.env.JWT_SECRET || "";
        this.secret = secret;
    }

    public generateToken(payload: any): string {
        return jwt.sign(payload, this.secret, { expiresIn: "1h" });
    }

    public verifyToken(token: string): any {
        const decoded = jwt.verify(token, this.secret);
        return decoded;
    }
}
