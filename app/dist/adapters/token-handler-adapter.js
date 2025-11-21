import jwt from "jsonwebtoken";
export class TokenHandlerAdapter {
    constructor() {
        const secret = process.env.JWT_SECRET || "";
        this.secret = secret;
    }
    generateToken(payload) {
        return jwt.sign(payload, this.secret, { expiresIn: "1h" });
    }
    verifyToken(token) {
        const decoded = jwt.verify(token, this.secret);
        return decoded;
    }
}
