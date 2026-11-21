// zod schema，与 src/types.ts 保持一致。fixture 和（以后的）LLM 输出都经这里校验。
import { z } from 'zod';
import type { Session } from '@/types';

const bi = <T extends z.ZodType>(t: T) => z.object({ src: t, en: t });

export const spanSchema = z.tuple([z.number(), z.number()]);
export const boxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const spansSchema = bi(z.array(spanSchema));

export const sceneGraphSchema = z.object({
  entities: z.array(z.object({ id: z.string(), label: bi(z.string()), spans: spansSchema })),
  attributes: z.array(
    z.object({ id: z.string(), entityId: z.string(), value: bi(z.string()), spans: spansSchema }),
  ),
  relations: z.array(
    z.object({
      id: z.string(),
      subjectId: z.string(),
      objectId: z.string(),
      predicate: bi(z.string()),
      spans: spansSchema,
    }),
  ),
});

export const requirementSchema = z.object({
  id: z.string(),
  kind: z.enum(['entity', 'attribute', 'relation']),
  refId: z.string(),
  dependsOn: z.array(z.string()).optional(),
  question: z.string(),
});

const langSchema = z.enum(['src', 'en', 'refined']);

export const checkSchema = z.object({
  imageId: z.string(),
  requirementId: z.string(),
  verdict: z.enum(['yes', 'no', 'unsure', 'n/a']),
  reason: z.string(),
  boxes: z.record(z.string(), boxSchema).optional(),
  userOverride: z.enum(['yes', 'no']).optional(),
});

export const generatedImageSchema = z.object({
  id: z.string(),
  lang: langSchema,
  sampleIndex: z.number(),
  promptUsed: z.string(),
  model: z.string(),
  params: z.record(z.string(), z.unknown()),
  promptTemplateVersion: z.string(),
  url: z.string().optional(),
  blobKey: z.string().optional(),
  createdAt: z.string(),
});

export const annotationSchema = z.object({
  id: z.string(),
  number: z.number(),
  imageId: z.string(),
  region: z.union([boxSchema, z.array(z.tuple([z.number(), z.number()]))]),
  entityId: z.string().optional(),
  intent: z.enum(['keep_appearance', 'keep_position', 'change', 'remove']),
  comment: z.string().optional(),
});

export const iterationSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  images: z.array(generatedImageSchema),
  checks: z.array(checkSchema),
  annotations: z.array(annotationSchema),
  instruction: z.string().optional(),
  createdAt: z.string(),
});

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  srcLang: z.string(),
  srcPrompt: z.string(),
  enPrompt: z.string(),
  graph: sceneGraphSchema,
  requirements: z.array(requirementSchema),
  iterations: z.array(iterationSchema),
  createdAt: z.string(),
});

// 编译期保证 schema 推断类型与 types.ts 双向兼容
type Inferred = z.infer<typeof sessionSchema>;
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _sessionTypeCheck: AssertEqual<Inferred, Session> = true;
void _sessionTypeCheck;

export function parseSession(data: unknown): Session {
  return sessionSchema.parse(data);
}
