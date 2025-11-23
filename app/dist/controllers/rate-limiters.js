import rateLimit from "express-rate-limit";
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
export const defaultRateLimiter = rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    max: 70,
    standardHeaders: true,
    legacyHeaders: false,
});
export const authRateLimiter = rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
export const deckGenerateRateLimiter = rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});
