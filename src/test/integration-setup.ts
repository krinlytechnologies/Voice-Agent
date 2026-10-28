// Runs before every integration test file. Points the app's Prisma client at the test
// database and refuses any database whose name does not end in "_test", so these tests
// can never truncate or clean up a development database.
const testUrl = process.env["DATABASE_URL_TEST"];
if (!testUrl) {
  throw new Error("DATABASE_URL_TEST is required to run integration tests (see .env.example).");
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, "");
if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run integration tests against "${databaseName}". Use a database whose name ends in _test.`,
  );
}
process.env["DATABASE_URL"] = testUrl;
