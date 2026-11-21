// scene graph 查询辅助（纯函数），供联动高亮使用。
import type { Bi, Requirement, SceneGraph, Span } from '@/types';

/** 解析选中 id：可能是实体 / 属性 / 关系，或者指向它们的要求 */
function resolveRef(requirements: Requirement[], id: string): string {
  return requirements.find((r) => r.id === id)?.refId ?? id;
}

/** 选中项在两个 prompt 中对应的字符区间 */
export function spansFor(graph: SceneGraph, requirements: Requirement[], id: string | null): Bi<Span[]> {
  if (!id) return { src: [], en: [] };
  const ref = resolveRef(requirements, id);
  const el =
    graph.entities.find((e) => e.id === ref) ??
    graph.attributes.find((a) => a.id === ref) ??
    graph.relations.find((r) => r.id === ref);
  return el ? el.spans : { src: [], en: [] };
}

/** 选中项涉及的实体 id（用于在图像上高亮边界框） */
export function entitiesFor(graph: SceneGraph, requirements: Requirement[], id: string | null): string[] {
  if (!id) return [];
  const ref = resolveRef(requirements, id);
  if (graph.entities.some((e) => e.id === ref)) return [ref];
  const attr = graph.attributes.find((a) => a.id === ref);
  if (attr) return [attr.entityId];
  const rel = graph.relations.find((r) => r.id === ref);
  if (rel) return [rel.subjectId, rel.objectId];
  return [];
}

/** 把文本按区间切成 [文本, 是否高亮] 片段；区间可重叠、无序 */
export function segment(text: string, spans: Span[]): [string, boolean][] {
  const marks = new Array<boolean>(text.length).fill(false);
  for (const [s, e] of spans) for (let i = Math.max(0, s); i < Math.min(e, text.length); i++) marks[i] = true;
  const out: [string, boolean][] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last[1] === marks[i]) last[0] += text[i];
    else out.push([text[i]!, marks[i]!]);
  }
  return out;
}

// ---------- Compare 页联动 ----------

export interface Related {
  /** 直接选中的 scene graph 元素（实体 / 属性 / 关系） */
  elementIds: Set<string>;
  /** 涉及的实体（图像上要高亮的框） */
  entityIds: Set<string>;
  /** 矩阵中要高亮的要求 */
  requirementIds: Set<string>;
}

/** 由 selectedId 推出三处需要高亮的内容 */
export function related(graph: SceneGraph, requirements: Requirement[], id: string | null): Related {
  const out: Related = { elementIds: new Set(), entityIds: new Set(), requirementIds: new Set() };
  if (!id) return out;
  const ref = resolveRef(requirements, id);
  out.elementIds.add(ref);
  for (const e of entitiesFor(graph, requirements, ref)) out.entityIds.add(e);
  const isEntity = graph.entities.some((e) => e.id === ref);
  for (const r of requirements) {
    const hit = isEntity ? entitiesFor(graph, requirements, r.refId).includes(ref) : r.refId === ref;
    if (hit) out.requirementIds.add(r.id);
  }
  return out;
}

export type ElementKind = 'entity' | 'attribute' | 'relation';

export interface SegmentItem {
  id: string;
  kind: ElementKind;
  /** 用于着色的实体：实体本身 / 属性所属实体 / 关系的主语 */
  entityId: string;
}

export interface PromptSegment {
  text: string;
  /** 覆盖该片段的元素，按优先级 实体 > 属性 > 关系 排序；空数组 = 普通文本 */
  items: SegmentItem[];
}

/** 把 prompt 切成不重叠片段，每段带覆盖它的 scene graph 元素 */
export function promptSegments(text: string, graph: SceneGraph, lang: 'src' | 'en'): PromptSegment[] {
  const all: { item: SegmentItem; spans: Span[] }[] = [
    ...graph.entities.map((e) => ({ item: { id: e.id, kind: 'entity' as const, entityId: e.id }, spans: e.spans[lang] })),
    ...graph.attributes.map((a) => ({
      item: { id: a.id, kind: 'attribute' as const, entityId: a.entityId },
      spans: a.spans[lang],
    })),
    ...graph.relations.map((r) => ({
      item: { id: r.id, kind: 'relation' as const, entityId: r.subjectId },
      spans: r.spans[lang],
    })),
  ];
  const cover: SegmentItem[][] = Array.from({ length: text.length }, () => []);
  for (const { item, spans } of all)
    for (const [s, e] of spans) for (let i = Math.max(0, s); i < Math.min(e, text.length); i++) cover[i]!.push(item);

  const key = (items: SegmentItem[]) => items.map((it) => it.id).join('|');
  const out: PromptSegment[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && key(last.items) === key(cover[i]!)) last.text += text[i];
    else out.push({ text: text[i]!, items: cover[i]! });
  }
  return out;
}
