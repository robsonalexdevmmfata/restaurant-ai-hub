import { describe, expect, it } from "vitest";
import { validateImageUpload } from "./media-validation";

describe("restaurant image upload", () => {
  it("accepts PNG, JPEG and WebP", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) expect(validateImageUpload({ type, size: 100 })).toBeNull();
    expect(validateImageUpload({ type: "image/svg+xml", size: 100 })).not.toBeNull();
  });
  it("limits uploads to one megabyte", () => {
    expect(validateImageUpload({ type: "image/png", size: 1_000_000 })).toBeNull();
    expect(validateImageUpload({ type: "image/png", size: 1_000_001 })).not.toBeNull();
  });
});