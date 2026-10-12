/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testTimeout: 60_000,
  globalSetup: "<rootDir>/src/globalSetup.ts",
  globalTeardown: "<rootDir>/src/globalTeardown.ts",
};
