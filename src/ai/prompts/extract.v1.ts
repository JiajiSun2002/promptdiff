// ② 翻译 + 抽取。修改提示词时新建 extract.v2.ts，不要改本文件（图像元数据会记录版本号）。
import { z } from 'zod';

export const EXTRACT_VERSION = 'extract.v1';

const bi = z.object({ src: z.string().min(1), en: z.string().min(1) });
/** 短语必须逐字摘自对应 prompt；不连续的短语（如「在…下」）拆成多段 */
const phrases = z.object({ src: z.array(z.string()), en: z.array(z.string()) });

export const extractOutputSchema = z.object({
  enPrompt: z.string().min(1),
  entities: z
    .array(z.object({ id: z.string(), label: bi, phrases, question: z.string() }))
    .min(1),
  attributes: z.array(
    z.object({ id: z.string(), entityId: z.string(), value: bi, phrases, question: z.string() }),
  ),
  relations: z.array(
    z.object({
      id: z.string(),
      subjectId: z.string(),
      objectId: z.string(),
      predicate: bi,
      phrases,
      question: z.string(),
    }),
  ),
});

export type ExtractOutput = z.infer<typeof extractOutputSchema>;

export function buildExtractPrompt(srcLang: string, srcPrompt: string): string {
  return `You help compare text-to-image results across languages.

Source language code: ${srcLang}
Source prompt (between the markers):
<<<
${srcPrompt}
>>>

Tasks, all in one JSON answer:
1. "enPrompt": a faithful, natural English translation of the source prompt for an image model. Do not add, drop or embellish details.
2. Extract ONE shared scene graph that describes both prompts. Every element exists once and carries both languages, so IDs are shared across languages.
   - "entities": concrete visible objects. id like "e_cat". label.src in the source language, label.en in English.
   - "attributes": properties of one entity (color, size, material, pose, count…). id like "a_cat_red", entityId must be an entity id.
   - "relations": spatial or action relations between two entities. id like "r_cat_left_dog". subjectId / objectId must be entity ids.
3. For every element, "phrases.src" and "phrases.en" list the exact substrings of the source prompt and of YOUR enPrompt that express it.
   Copy them character for character (same script, same punctuation). If an expression is discontinuous (e.g. Chinese 在…下), list each part separately in reading order. Use [] only if the element is truly implicit in that language.
4. For every element, "question": a short English yes/no question a vision model can answer by looking at the image,
   e.g. "Is there a cat?", "Is the cat red?", "Is the cat to the left of the dog?".

Only include what the prompt states. Do not invent elements.`;
}
