/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = require("./jest.config");
module.exports = {
  ...jestConfig,
  testRegex: ".*\\.test\\.ts$",
};