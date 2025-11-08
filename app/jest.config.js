/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testRegex: ".*\\.(spec|test)\\.ts$",
    coverageDirectory: "coverage",
    testEnvironment: "node",
    preset: "@shelf/jest-mongodb",
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    collectCoverageFrom: [
        "**/src/**/*.(t|j)s",
        "!**/*index.(t|j)s",
        "!**/*test.(t|j)s",
        "!**/dist/**",
    ],
};