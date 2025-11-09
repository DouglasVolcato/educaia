import jestConfig from "./jest.config.js";
export default {
  ...jestConfig,
  testRegex: ".*\\.test\\.ts$",
};