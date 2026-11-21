import type { SceneGraph } from '@/types';

/**
 * 实体语义色（取自原型）：第 1 个实体红、第 2 个蓝、第 3 个绿……
 * text = 文字色，tint = 浅底，solid = 描边 / 实底
 */
const PALETTE = [
  { text: '#b83b48', tint: '#fff0f1', solid: '#e44355' },
  { text: '#245ac4', tint: '#edf3ff', solid: '#245ef5' },
  { text: '#27805a', tint: '#eaf8f1', solid: '#26a269' },
  { text: '#a65f00', tint: '#fff6e5', solid: '#e09a00' },
  { text: '#0f766e', tint: '#e6f6f4', solid: '#14a39a' },
  { text: '#a3387a', tint: '#fcedf6', solid: '#d1499b' },
];

/** 关系统一用紫色 */
export const RELATION_COLOR = { text: '#7652b2', tint: '#f4effc', solid: '#7652b2' };

export interface EntityColor {
  text: string;
  tint: string;
  solid: string;
}

export function entityColor(graph: SceneGraph, entityId: string): EntityColor {
  const i = graph.entities.findIndex((e) => e.id === entityId);
  return i < 0 ? { text: '#53617a', tint: '#f4f6fa', solid: '#8a95a7' } : PALETTE[i % PALETTE.length]!;
}
