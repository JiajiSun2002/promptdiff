import { describe, expect, it } from 'vitest';
import { findAnnotation, isBox, removeAnnotation, upsertAnnotation } from './annotations';
import type { Annotation, Box } from '@/types';

const box: Box = [0.1, 0.2, 0.3, 0.4];
let n = 0;
const id = () => `a${++n}`;

describe('upsertAnnotation', () => {
  it('numbers new annotations 1, 2, 3', () => {
    let list: Annotation[] = [];
    list = upsertAnnotation(list, { imageId: 'i1', entityId: 'e_dog', region: box, intent: 'change', comment: ' 更蓝 ' }, id);
    list = upsertAnnotation(list, { imageId: 'i2', entityId: 'e_tree', region: box, intent: 'keep_position' }, id);
    list = upsertAnnotation(list, { imageId: 'i2', entityId: 'e_dog', region: box, intent: 'remove' }, id);
    expect(list.map((a) => [a.number, a.imageId, a.entityId])).toEqual([
      [1, 'i1', 'e_dog'],
      [2, 'i2', 'e_tree'],
      [3, 'i2', 'e_dog'],
    ]);
    expect(list[0]!.comment).toBe('更蓝');
    expect(list[1]).not.toHaveProperty('comment');
  });

  it('updates in place for the same image + entity, keeping id and number', () => {
    let list = upsertAnnotation([], { imageId: 'i1', entityId: 'e_dog', region: box, intent: 'change', comment: 'x' }, id);
    const before = list[0]!;
    list = upsertAnnotation(list, { imageId: 'i1', entityId: 'e_dog', region: box, intent: 'remove', comment: '' }, id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: before.id, number: 1, intent: 'remove' });
    expect(list[0]).not.toHaveProperty('comment');
  });

  it('continues after the current max number', () => {
    const list: Annotation[] = [{ id: 'x', number: 5, imageId: 'i', entityId: 'e', region: box, intent: 'change' }];
    expect(upsertAnnotation(list, { imageId: 'i', entityId: 'f', region: box, intent: 'change' }, id)[1]!.number).toBe(6);
  });
});

describe('removeAnnotation', () => {
  it('renumbers the rest to stay continuous', () => {
    let list: Annotation[] = [];
    for (const e of ['a', 'b', 'c']) list = upsertAnnotation(list, { imageId: 'i', entityId: e, region: box, intent: 'change' }, id);
    const out = removeAnnotation(list, list[0]!.id);
    expect(out.map((a) => [a.entityId, a.number])).toEqual([
      ['b', 1],
      ['c', 2],
    ]);
    expect(findAnnotation(out, 'i', 'a')).toBeUndefined();
  });
});

describe('isBox', () => {
  it('distinguishes boxes from freehand paths', () => {
    expect(isBox(box)).toBe(true);
    expect(isBox([[0, 0], [1, 1]])).toBe(false);
  });
});
