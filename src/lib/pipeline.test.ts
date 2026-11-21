import { describe, expect, it } from 'vitest';
import { applyDependencies, deriveDependsOn, findSpans } from './pipeline';
import { getDemoSession } from '@/ai/mock';

const demo = getDemoSession('svg');

describe('findSpans', () => {
  it('locates Chinese and English phrases', () => {
    expect(findSpans(demo.srcPrompt, ['猫']).spans).toEqual([[5, 6]]);
    expect(findSpans(demo.enPrompt, ['to the left of']).spans).toEqual([[15, 29]]);
  });
  it('is case-insensitive', () => {
    expect(findSpans('A red cat', ['a']).spans).toEqual([[0, 1]]);
  });
  it('takes successive occurrences for repeated phrases', () => {
    expect(findSpans('一只猫和一只狗', ['一只', '一只']).spans).toEqual([
      [0, 2],
      [4, 6],
    ]);
  });
  it('matches discontinuous phrases like 在…下 as separate parts', () => {
    expect(findSpans(demo.srcPrompt, ['在', '下']).spans).toEqual([
      [17, 18],
      [19, 20],
    ]);
  });
  it('reports missing phrases', () => {
    const r = findSpans('a cat', ['dog', 'cat']);
    expect(r.spans).toEqual([[2, 5]]);
    expect(r.missing).toEqual(['dog']);
  });
});

describe('deriveDependsOn', () => {
  it('reproduces the fixture dependencies', () => {
    const stripped = demo.requirements.map(({ dependsOn: _d, ...r }) => r);
    expect(deriveDependsOn(demo.graph, stripped)).toEqual(demo.requirements);
  });
});

describe('applyDependencies', () => {
  it('marks children n/a when a parent is no, transitively', () => {
    const reqs = [
      { id: 'a', kind: 'entity' as const, refId: 'x', question: '' },
      { id: 'b', kind: 'attribute' as const, refId: 'y', question: '', dependsOn: ['a'] },
      { id: 'c', kind: 'relation' as const, refId: 'z', question: '', dependsOn: ['b'] },
    ];
    expect(applyDependencies(reqs, { a: 'no', b: 'yes', c: 'yes' })).toEqual({ a: 'no', b: 'n/a', c: 'n/a' });
    expect(applyDependencies(reqs, { a: 'unsure', b: 'yes', c: 'no' })).toEqual({ a: 'unsure', b: 'yes', c: 'no' });
  });
});

describe('findSpans ordering', () => {
  it('falls back to independent lookup when order is reversed', () => {
    expect(findSpans('cat and dog', ['dog', 'cat']).spans).toEqual([
      [0, 3],
      [8, 11],
    ]);
  });
});
