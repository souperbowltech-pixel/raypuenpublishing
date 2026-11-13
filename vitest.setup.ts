import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

/**
 * The local stores (scouts, families, patrols) read and rewrite whole JSON files.
 * Test files run in parallel, so a shared data/ folder loses writes between them
 * and made the referral and patrol tests fail at random. Each file gets its own.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "puen-test-data-"));
process.env.LOCAL_DATA_DIR = dir;

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
