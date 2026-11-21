// 标注列表操作（纯函数）。编号始终保持 1…n 连续。
import type { Annotation, AnnotationIntent, Box } from '@/types';

export interface AnnotationInput {
  imageId: string;
  entityId: string;
  region: Box;
  intent: AnnotationIntent;
  comment?: string;
}

export function findAnnotation(list: Annotation[], imageId: string, entityId: string): Annotation | undefined {
  return list.find((a) => a.imageId === imageId && a.entityId === entityId);
}

/** 同一张图的同一个实体只保留一条：已存在则更新，否则追加并编号为最大编号 + 1 */
export function upsertAnnotation(
  list: Annotation[],
  input: AnnotationInput,
  makeId: () => string = () => `ann_${crypto.randomUUID()}`,
): Annotation[] {
  const comment = input.comment?.trim() || undefined;
  const existing = findAnnotation(list, input.imageId, input.entityId);
  if (existing) {
    return list.map((a) => {
      if (a !== existing) return a;
      const { comment: _old, ...rest } = a;
      return { ...rest, region: input.region, intent: input.intent, ...(comment ? { comment } : {}) };
    });
  }
  const number = list.reduce((m, a) => Math.max(m, a.number), 0) + 1;
  return [
    ...list,
    {
      id: makeId(),
      number,
      imageId: input.imageId,
      entityId: input.entityId,
      region: input.region,
      intent: input.intent,
      ...(comment ? { comment } : {}),
    },
  ];
}

/** 删除后按原编号顺序重新编号为 1…n */
export function removeAnnotation(list: Annotation[], id: string): Annotation[] {
  return list
    .filter((a) => a.id !== id)
    .sort((a, b) => a.number - b.number)
    .map((a, i) => (a.number === i + 1 ? a : { ...a, number: i + 1 }));
}

export function isBox(region: Annotation['region']): region is Box {
  return region.length === 4 && typeof region[0] === 'number';
}
