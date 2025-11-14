import jwt from "jsonwebtoken";

export class TokenHandlerAdapter {
    private secretKey: string;

    public constructor() {
        this.secretKey = process.env.SECRET_KEY || "";
    }

    public generateToken(payload: any): string {
        return jwt.sign(payload, this.secretKey, {
            expiresIn: "1h"
        });
    }

    public verifyToken(token: string): any {
        return jwt.verify(token, this.secretKey);
    }
}