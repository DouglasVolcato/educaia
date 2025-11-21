/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    testRegex: ".*\\.(spec|test)\\.ts$",
    coverageDirectory: "coverage",
    testEnvironment: "node",
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    collectCoverageFrom: [
        "**/src/**/*.(t|j)s",
        "!**/*index.(t|j)s",
        "!**/*test.(t|j)s",
        "!**/dist/**",
    ],
    moduleNameMapper: {
        "^@main/(.*)$": "<rootDir>/src/main/$1",
        "^@tests/(.*)$": "<rootDir>/src/tests/$1",
        "^@db/(.*)$": "<rootDir>/src/db/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@controllers/(.*)$": "<rootDir>/src/controllers/$1",
        "^@views/(.*)$": "<rootDir>/src/views/$1",
        "^@usecases/(.*)$": "<rootDir>/src/usecases/$1",
    }
};