import { describe, expect, it } from 'vitest';
import { fromGemini1000 } from './geometry';

describe('fromGemini1000', () => {
  it('reorders [ymin,xmin,ymax,xmax] 0–1000 into [x0,y0,x1,y1] 0–1', () => {
    expect(fromGemini1000([560, 200, 800, 330])).toEqual([0.2, 0.56, 0.33, 0.8]);
  });
  it('clamps out-of-range values', () => {
    expect(fromGemini1000([-20, 0, 1200, 1000])).toEqual([0, 0, 1, 1]);
  });
  it('fixes swapped min/max', () => {
    expect(fromGemini1000([800, 330, 560, 200])).toEqual([0.2, 0.56, 0.33, 0.8]);
  });
  it('rejects malformed input', () => {
    expect(() => fromGemini1000([1, 2, 3])).toThrow();
    expect(() => fromGemini1000([1, 2, 3, NaN])).toThrow();
  });
});
