import jwt from "jsonwebtoken";
export class TokenHandlerAdapter {
    constructor() {
        this.secretKey = process.env.SECRET_KEY || "";
    }
    generateToken(payload) {
        return jwt.sign(payload, this.secretKey, {
            expiresIn: "1h"
        });
    }
    verifyToken(token) {
        return jwt.verify(token, this.secretKey);
    }
}
