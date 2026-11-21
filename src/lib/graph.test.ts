import { describe, expect, it } from 'vitest';
import { entitiesFor, promptSegments, related, segment, spansFor } from './graph';
import { getDemoSession } from '@/ai/mock';

const { graph, requirements, srcPrompt, enPrompt } = getDemoSession('svg');

describe('segment', () => {
  it('merges overlapping spans and keeps plain text', () => {
    expect(segment('abcdef', [[1, 3], [2, 4]])).toEqual([
      ['a', false],
      ['bcd', true],
      ['ef', false],
    ]);
  });
  it('returns whole text when no spans', () => {
    expect(segment('abc', [])).toEqual([['abc', false]]);
  });
});

describe('spansFor / entitiesFor', () => {
  it('fixture spans point at the right words', () => {
    const s = spansFor(graph, requirements, 'e_cat');
    expect(srcPrompt.slice(...s.src[0]!)).toBe('猫');
    expect(enPrompt.slice(...s.en[0]!)).toBe('cat');
  });
  it('resolves requirement → relation → both entities', () => {
    expect(entitiesFor(graph, requirements, 'q9')).toEqual(['e_dog', 'e_tree']);
  });
  it('resolves attribute → owner entity', () => {
    expect(entitiesFor(graph, requirements, 'a_dog_blue')).toEqual(['e_dog']);
  });
});

describe('related', () => {
  it('entity → all requirements involving it', () => {
    const r = related(graph, requirements, 'e_cat');
    expect([...r.elementIds]).toEqual(['e_cat']);
    expect([...r.entityIds]).toEqual(['e_cat']);
    expect([...r.requirementIds].sort()).toEqual(['q1', 'q4', 'q5', 'q7', 'q8']);
  });
  it('requirement → its relation, entities and itself', () => {
    const r = related(graph, requirements, 'q9');
    expect([...r.elementIds]).toEqual(['r_dog_under_tree']);
    expect([...r.entityIds]).toEqual(['e_dog', 'e_tree']);
    expect([...r.requirementIds]).toEqual(['q9']);
  });
  it('empty for null', () => {
    expect(related(graph, requirements, null).requirementIds.size).toBe(0);
  });
});

describe('promptSegments', () => {
  it('reassembles the original text', () => {
    for (const lang of ['src', 'en'] as const) {
      const text = lang === 'src' ? srcPrompt : enPrompt;
      expect(promptSegments(text, graph, lang).map((s) => s.text).join('')).toBe(text);
    }
  });
  it('tags entity, attribute and shared relation spans', () => {
    const segs = promptSegments(enPrompt, graph, 'en');
    const find = (t: string) => segs.find((s) => s.text === t)!;
    expect(find('cat').items).toEqual([{ id: 'e_cat', kind: 'entity', entityId: 'e_cat' }]);
    expect(find('red').items[0]).toMatchObject({ id: 'a_cat_red', entityId: 'e_cat' });
    // 两条 under 关系共用同一个 span
    expect(find('under').items.map((i) => i.id)).toEqual(['r_cat_under_tree', 'r_dog_under_tree']);
  });
});
