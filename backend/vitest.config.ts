import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    // registerCompany does a real bcrypt(12) hash plus a live network call
    // to the Ethereal test SMTP relay, which alone can take 3-5s; the
    // default 5000ms timeout is too tight on a loaded CI runner.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
