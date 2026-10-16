import { describe, expect, test } from "bun:test";
import { monochromePixels } from "./thermal-settings";

describe("logo térmica", () => {
  test("converte cores escuras em preto puro", () => {
    expect([...monochromePixels(new Uint8ClampedArray([20, 90, 40, 255]))]).toEqual([0, 0, 0, 255]);
  });
  test("converte cores claras em branco puro", () => {
    expect([...monochromePixels(new Uint8ClampedArray([240, 230, 220, 255]))]).toEqual([255, 255, 255, 255]);
  });
  test("preserva fundo transparente como branco, não preto", () => {
    expect([...monochromePixels(new Uint8ClampedArray([0, 0, 0, 0]))]).toEqual([255, 255, 255, 255]);
  });
});