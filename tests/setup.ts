Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/codex_ops",
  DATABASE_URL_TEST: "postgresql://postgres:postgres@localhost:5433/codex_ops_test",
  NEXTAUTH_SECRET: "test-secret-test-secret-test-secret-123",
  NEXTAUTH_URL: "http://localhost:3300",
  TEST_CODEX_API_KEY: "test-key-123456789012345678901234",
});
