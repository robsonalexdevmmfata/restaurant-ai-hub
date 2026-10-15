import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateImageUpload } from "./media-validation";

describe("restaurant image upload", () => {
  it("accepts PNG, JPEG and WebP", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) assert.equal(validateImageUpload({ type, size: 100 }), null);
    assert.notEqual(validateImageUpload({ type: "image/svg+xml", size: 100 }), null);
  });
  it("limits uploads to one megabyte", () => {
    assert.equal(validateImageUpload({ type: "image/png", size: 1_000_000 }), null);
    assert.notEqual(validateImageUpload({ type: "image/png", size: 1_000_001 }), null);
  });
});