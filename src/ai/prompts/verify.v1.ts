// ④ 逐条检查。修改提示词时新建 verify.v2.ts。
import { z } from 'zod';
import type { Requirement, SceneGraph } from '@/types';

export const VERIFY_VERSION = 'verify.v1';

export const verifyOutputSchema = z.object({
  results: z.array(
    z.object({
      requirementId: z.string(),
      verdict: z.enum(['yes', 'no', 'unsure']),
      reason: z.string(),
    }),
  ),
  objects: z.array(
    z.object({
      entityId: z.string(),
      /** Gemini 原生格式 [ymin, xmin, ymax, xmax]，0–1000 */
      box_2d: z.array(z.number()).length(4),
    }),
  ),
});

export type VerifyOutput = z.infer<typeof verifyOutputSchema>;

export function buildVerifyPrompt(graph: SceneGraph, requirements: Requirement[]): string {
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
  "reason": one short sentence in Simplified Chinese describing what you see.
- "objects": for every entity that is visible, its bounding box as "box_2d": [ymin, xmin, ymax, xmax], integers normalized to 0–1000.
  Omit entities that are not in the image.

Judge only what is visible. Do not assume.`;
}
