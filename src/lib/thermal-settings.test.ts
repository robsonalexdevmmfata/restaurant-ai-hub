import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { monochromePixels } from "./thermal-settings";

describe("logo térmica", () => {
  test("converte cores escuras em preto puro", () => {
    assert.deepEqual([...monochromePixels(new Uint8ClampedArray([20, 90, 40, 255]))], [0, 0, 0, 255]);
  });
  test("converte cores claras em branco puro", () => {
    assert.deepEqual([...monochromePixels(new Uint8ClampedArray([240, 230, 220, 255]))], [255, 255, 255, 255]);
  });
  test("preserva fundo transparente como branco, não preto", () => {
    assert.deepEqual([...monochromePixels(new Uint8ClampedArray([0, 0, 0, 0]))], [255, 255, 255, 255]);
  });
});