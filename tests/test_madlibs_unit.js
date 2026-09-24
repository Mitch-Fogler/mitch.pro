import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MADLIBS_FILE = join(process.cwd(), "data", "madlibs.json");

test("data/madlibs.json exists and contains valid templates", () => {
  assert.ok(existsSync(MADLIBS_FILE), "madlibs.json must exist");
  const raw = readFileSync(MADLIBS_FILE, "utf8");
  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data), "madlibs data must be an array");
  assert.ok(data.length >= 80, "Expected at least 80 templates, got " + data.length);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    assert.ok(typeof item.title === "string" && item.title.length > 0, "Template #" + i + " must have title");
    assert.ok(Array.isArray(item.text), "Template #" + i + " text must be array");
    assert.ok(Array.isArray(item.blanks), "Template #" + i + " blanks must be array");
    assert.ok(item.blanks.length > 0, "Template #" + i + " must have at least one blank");
    assert.equal(
      item.text.length,
      item.blanks.length + 1,
      "Template #" + i + " (" + item.title + "): text length (" + item.text.length + ") must be blanks length + 1 (" + (item.blanks.length + 1) + ")"
    );
  }
});
