import { TokenHandlerAdapter } from "../../adapters/token-handler-adapter.js";
import { SESSION_COOKIE_NAME } from "../../constants/session.js";
import { usersModel } from "../../db/models/users-model.js";
const PUBLIC_PATHS = new Set(["/login", "/register", "/", "/auth/login", "/auth/register"]);
let jwtAdapter = null;
const getJwtAdapter = () => {
    if (!jwtAdapter) {
        jwtAdapter = new TokenHandlerAdapter();
    }
    return jwtAdapter;
};
const redirectToLogin = (req, res) => {
    const isApiRequest = req.baseUrl?.startsWith("/api");
    if (isApiRequest) {
        res
            .status(401)
            .setHeader("Content-Type", "text/html; charset=utf-8")
            .send('<div class="alert alert-danger" role="alert">Sua sessão expirou. Faça login novamente para continuar.</div>');
        return;
    }
    res.status(403).redirect("/app/login");
};
const extractTokenFromCookies = (req) => {
    const { cookie } = req.headers;
    if (!cookie) {
        return null;
    }
    const cookies = cookie.split(";");
    for (const entry of cookies) {
        const [rawName, ...rest] = entry.trim().split("=");
        if (rawName === SESSION_COOKIE_NAME) {
            return rest.join("=");
        }
    }
    return null;
};
export const authMiddleware = async (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path)) {
        next();
        return;
    }
    try {
        const token = extractTokenFromCookies(req);
        if (!token) {
            redirectToLogin(req, res);
            return;
        }
        const payload = getJwtAdapter().verifyToken(token);
        if (!payload?.userId) {
            redirectToLogin(req, res);
            return;
        }
        const user = await usersModel.findById(payload.userId);
        if (!user) {
            redirectToLogin(req, res);
            return;
        }
        if (!req.body) {
            req.body = {};
        }
        req.body.user = user;
        res.locals.user = user;
        next();
    }
    catch (error) {
        console.error("Failed to authenticate request", error);
        redirectToLogin(req, res);
    }
};
