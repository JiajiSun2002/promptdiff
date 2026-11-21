import { describe, expect, it } from 'vitest';
import { diffAll, diffRequirement, effectiveVerdict, isLanguageGap } from './diff';
import { getDemoSession } from '@/ai/mock';
import type { Check, GeneratedImage, Lang, Verdict } from '@/types';

const img = (id: string, lang: Lang, sampleIndex = 0): GeneratedImage => ({
  id,
  lang,
  sampleIndex,
  promptUsed: '',
  model: 'test',
  params: {},
  promptTemplateVersion: 'test',
  createdAt: '',
});
const chk = (imageId: string, verdict: Verdict, userOverride?: 'yes' | 'no'): Check => ({
  imageId,
  requirementId: 'r',
  verdict,
  reason: '',
  ...(userOverride ? { userOverride } : {}),
});
const one = [img('s', 'src'), img('e', 'en')];

describe('diffAll on cat-dog-svg fixture', () => {
  const session = getDemoSession('svg');
  const d = diffAll(session, session.iterations[0]!);
  it('covers the documented categories', () => {
    expect(d.q4!.category).toBe('both_fail');
    expect(d.q6!.category).toBe('uncertain');
    expect(d.q9!.category).toBe('src_only_fail');
    for (const q of ['q1', 'q2', 'q3', 'q5', 'q7', 'q8']) expect(d[q]!.category).toBe('both_pass');
  });
  it('reports pass rates', () => {
    expect(d.q9!.passRate).toEqual({ src: 0, en: 1 });
  });
});

describe('diffRequirement', () => {
  it('en_only_fail', () => {
    expect(diffRequirement('r', one, [chk('s', 'yes'), chk('e', 'no')]).category).toBe('en_only_fail');
  });
  it('userOverride wins over model verdict', () => {
    expect(effectiveVerdict(chk('s', 'no', 'yes'))).toBe('yes');
    expect(diffRequirement('r', one, [chk('s', 'no', 'yes'), chk('e', 'yes')]).category).toBe('both_pass');
    // 覆盖 unsure 后不再是 uncertain
    expect(diffRequirement('r', one, [chk('s', 'yes'), chk('e', 'unsure', 'no')]).category).toBe('en_only_fail');
  });
  it('uses pass rate with threshold 0.5 for multiple samples', () => {
    const imgs = [img('s0', 'src', 0), img('s1', 'src', 1), img('s2', 'src', 2), img('e0', 'en', 0), img('e1', 'en', 1)];
    const r = diffRequirement('r', imgs, [
      chk('s0', 'yes'),
      chk('s1', 'no'),
      chk('s2', 'no'), // src 1/3 → fail
      chk('e0', 'yes'),
      chk('e1', 'no'), // en 1/2 → 恰好阈值，pass
    ]);
    expect(r.passRate.src).toBeCloseTo(1 / 3);
    expect(r.passRate.en).toBe(0.5);
    expect(r.category).toBe('src_only_fail');
  });
  it('treats n/a as not passed', () => {
    expect(diffRequirement('r', one, [chk('s', 'n/a'), chk('e', 'yes')]).category).toBe('src_only_fail');
  });
  it('is uncertain when a language has no result', () => {
    const r = diffRequirement('r', one, [chk('s', 'yes')]);
    expect(r.category).toBe('uncertain');
    expect(r.passRate).toEqual({ src: 1 });
  });
  it('ignores refined images', () => {
    const imgs = [...one, img('x', 'refined')];
    expect(diffRequirement('r', imgs, [chk('s', 'yes'), chk('e', 'yes'), chk('x', 'no')]).category).toBe('both_pass');
  });
});

describe('isLanguageGap', () => {
  it('only single-language failures', () => {
    expect(isLanguageGap('src_only_fail')).toBe(true);
    expect(isLanguageGap('en_only_fail')).toBe(true);
    expect(isLanguageGap('both_fail')).toBe(false);
    expect(isLanguageGap('uncertain')).toBe(false);
  });
});

describe('diffAll on cat-dog photo fixture', () => {
  it('prompt matches the photos: every requirement passes in both languages', () => {
    const session = getDemoSession('photo');
    const d = diffAll(session, session.iterations[0]!);
    for (const q of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']) expect(d[q]!.category).toBe('both_pass');
  });
});
