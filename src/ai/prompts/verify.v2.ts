// ④ 逐条检查 v2：判定理由的语言跟随界面语言（v1 固定为简体中文）。输出 schema 与 v1 相同。
import type { Requirement, SceneGraph } from '@/types';

export { verifyOutputSchema, type VerifyOutput } from './verify.v1';

export const VERIFY_VERSION = 'verify.v2';

/** reasonLanguage：英文语言名，如 "Simplified Chinese" / "English" / "German" */
export function buildVerifyPrompt(graph: SceneGraph, requirements: Requirement[], reasonLanguage: string): string {
  const entities = graph.entities.map((e) => `- ${e.id}: ${e.label.en}`).join('\n');
  const questions = requirements.map((r) => `- ${r.id}: ${r.question}`).join('\n');
  return `You are checking whether the attached image satisfies each requirement of its prompt.

Entities:
${entities}

Requirements:
${questions}

Answer in JSON:
- "results": one item for EVERY requirement id above.
  verdict "yes" if clearly satisfied, "no" if clearly not, "unsure" if the image is ambiguous.
  "reason": one short sentence in ${reasonLanguage} describing what you see.
- "objects": for every entity that is visible, its bounding box as "box_2d": [ymin, xmin, ymax, xmax], integers normalized to 0–1000.
  Omit entities that are not in the image.

Judge only what is visible. Do not assume.`;
}
