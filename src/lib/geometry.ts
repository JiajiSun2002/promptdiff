// 坐标换算（纯函数）。应用内边界框一律是归一化 [x0, y0, x1, y1]（0–1）。
import type { Box } from '@/types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Gemini 的 box_2d：[ymin, xmin, ymax, xmax]，取值 0–1000 → 应用内 Box。
 * 越界值截断到 [0, 1]；min/max 颠倒时自动纠正。
 */
export function fromGemini1000(b: readonly number[]): Box {
  if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) throw new Error(`invalid box_2d: ${JSON.stringify(b)}`);
  const [ymin, xmin, ymax, xmax] = b.map((v) => clamp01(v / 1000)) as [number, number, number, number];
  return [Math.min(xmin, xmax), Math.min(ymin, ymax), Math.max(xmin, xmax), Math.max(ymin, ymax)];
}
