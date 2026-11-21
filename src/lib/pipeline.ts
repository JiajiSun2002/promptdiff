// 管线中与模型无关的处理（纯函数）：短语 → 字符区间、检查问题依赖、n/a 传播。
import type { Requirement, SceneGraph, Span, Verdict } from '@/types';

function occurrences(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

/**
 * 在 text 中定位一个元素的各段短语（按阅读顺序），返回 [start, end) 区间。
 * - 多段短语（如「在…下」）取顺序不变、整体跨度最小的一组位置，
 *   避免单字「在」误配到前面的「坐在」
 * - 同一短语列出多次时依次取后续位置
 * - 英文忽略大小写；找不到的短语放进 missing
 */
export function findSpans(text: string, phrases: string[]): { spans: Span[]; missing: string[] } {
  const hay = text.toLowerCase();
  const missing: string[] = [];
  const parts: { needle: string; len: number; occ: number[] }[] = [];
  for (const raw of phrases) {
    const p = raw.trim();
    if (!p) continue;
    const occ = occurrences(hay, p.toLowerCase());
    if (occ.length === 0) missing.push(p);
    else parts.push({ needle: p.toLowerCase(), len: p.length, occ });
  }
  if (parts.length === 0) return { spans: [], missing };

  /** 从第一段的某个位置出发，后续每段贪心取前一段结束后的第一个位置 */
  const chainFrom = (start: number): number[] | null => {
    const pos = [start];
    let end = start + parts[0]!.len;
    for (const part of parts.slice(1)) {
      const at = part.occ.find((o) => o >= end);
      if (at === undefined) return null;
      pos.push(at);
      end = at + part.len;
    }
    return pos;
  };

  let best: number[] | null = null;
  let bestExtent = Infinity;
  for (const start of parts[0]!.occ) {
    const pos = chainFrom(start);
    if (!pos) continue;
    const extent = pos[pos.length - 1]! + parts[parts.length - 1]!.len - start;
    if (extent < bestExtent) [best, bestExtent] = [pos, extent];
  }

  // 顺序无法满足（模型给的顺序与原文不同）时，退回到逐段独立查找
  if (!best) {
    const nextFrom = new Map<string, number>();
    best = parts.map((part) => {
      const from = nextFrom.get(part.needle) ?? 0;
      const at = part.occ.find((o) => o >= from) ?? part.occ[0]!;
      nextFrom.set(part.needle, at + part.len);
      return at;
    });
  }

  const spans = best.map((at, i): Span => [at, at + parts[i]!.len]).sort((a, b) => a[0] - b[0]);
  return { spans, missing };
}

/** 按 DSG 规则推出依赖：属性依赖其实体的存在问题，关系依赖主语和宾语的存在问题 */
export function deriveDependsOn(graph: SceneGraph, requirements: Requirement[]): Requirement[] {
  const existence = new Map<string, string>();
  for (const r of requirements) if (r.kind === 'entity') existence.set(r.refId, r.id);
  const reqsOf = (entityIds: string[]) =>
    entityIds.map((e) => existence.get(e)).filter((id): id is string => id != null);

  return requirements.map((r) => {
    let deps: string[] = [];
    if (r.kind === 'attribute') {
      const a = graph.attributes.find((x) => x.id === r.refId);
      if (a) deps = reqsOf([a.entityId]);
    } else if (r.kind === 'relation') {
      const rel = graph.relations.find((x) => x.id === r.refId);
      if (rel) deps = reqsOf([rel.subjectId, rel.objectId]);
    }
    const { dependsOn: _old, ...rest } = r;
    return deps.length ? { ...rest, dependsOn: [...new Set(deps)] } : rest;
  });
}

/** 父要求为 no（或已是 n/a）时，子要求记为 n/a。支持多层依赖。 */
export function applyDependencies(requirements: Requirement[], verdicts: Record<string, Verdict>): Record<string, Verdict> {
  const out = { ...verdicts };
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of requirements) {
      if (out[r.id] === 'n/a' || !r.dependsOn?.length) continue;
      if (r.dependsOn.some((p) => out[p] === 'no' || out[p] === 'n/a')) {
        out[r.id] = 'n/a';
        changed = true;
      }
    }
  }
  return out;
}
