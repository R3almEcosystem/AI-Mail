// @vitest-environment node
import { test, expect } from "vitest";
import { spawnSync } from "node:child_process";

test("security integration regressions", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", "tests/security/mail-transport.native.cjs", "tests/security/compose-result.native.mjs", "tests/security/bounded-markup.native.mjs"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 15_000, maxBuffer: 1_000_000,
    env: { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH, NODE_ENV: "test" },
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}, 20_000);
