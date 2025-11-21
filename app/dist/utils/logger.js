import * as path from "path";
import * as fs from "fs";
function getCallerLocation(stackDepth = 3) {
    const stack = new Error().stack;
    if (!stack)
        return "Unknown location";
    const lines = stack.split("\n").slice(stackDepth);
    for (const line of lines) {
        const match = line.match(/\(?(.+):(\d+):(\d+)\)?$/);
        if (match) {
            const [, filePath, lineNumber, columnNumber] = match;
            return `${path.resolve(filePath)}:${lineNumber}:${columnNumber}`;
        }
    }
    return "Unknown location";
}
export class Logger {
    static writeLog(filePath, log) {
        const time = new Date().toISOString().split(".")[0].replace("T", " ");
        fs.appendFile(filePath, `${time} ${log}\n\n`, (err) => {
            if (err) {
                console.error("Failed to write to log file:", err);
            }
        });
    }
    static error(error) {
        if (process.env.ENABLE_LOGS) {
            const location = getCallerLocation();
            const errorType = error?.name || "UnknownError";
            const errorMessage = error?.message || String(error);
            const errorStack = error?.stack || "No stack trace";
            const log = `[ERROR] at ${location}\nType: ${errorType}\nMessage: ${errorMessage}\nStack:\n${errorStack}`;
            this.writeLog("logs/errors.txt", log);
        }
    }
    static dbQuery(query) {
        if (process.env.ENABLE_LOGS) {
            const location = getCallerLocation();
            const log = `[DB QUERY] at ${location}\nSQL: ${query.sql}\nParams: ${JSON.stringify(query.params)}`;
            this.writeLog("logs/db.txt", log);
        }
    }
    static dbResponse(response) {
        if (process.env.ENABLE_LOGS) {
            const location = getCallerLocation();
            const log = `[DB RESPONSE] at ${location}\n${JSON.stringify(response)}`;
            this.writeLog("logs/db.txt", log);
        }
    }
    static apiRequest(request) {
        if (process.env.ENABLE_LOGS) {
            const location = getCallerLocation();
            const log = `[API REQUEST] at ${location}\nPath: ${request.path}\nData: ${JSON.stringify(request.data)}`;
            this.writeLog("logs/api.txt", log);
        }
    }
    static apiResponse(input) {
        if (process.env.ENABLE_LOGS) {
            const location = getCallerLocation();
            const log = `[API RESPONSE] at ${location}\n${JSON.stringify(input.response)}`;
            this.writeLog("logs/api.txt", log);
        }
    }
    static cronjob(message) {
        if (process.env.ENABLE_LOGS) {
            const location = getCallerLocation();
            const log = `[CRONJOB] ${message} at ${location}`;
            this.writeLog("logs/cronjobs.txt", log);
        }
    }
}
