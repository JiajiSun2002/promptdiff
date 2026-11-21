// GeminiProvider：所有对 Gemini 的调用都在这里。坐标从 Gemini 格式换算也只在这里做。
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { z } from 'zod';
import type { Box, Check, GeneratedImage, Requirement, SceneGraph, Session, Verdict } from '@/types';
import type { AIProvider, ExtractResult } from './provider';
import { buildExtractPrompt, extractOutputSchema, type ExtractOutput } from './prompts/extract.v1';
import { buildVerifyPrompt, verifyOutputSchema, type VerifyOutput } from './prompts/verify.v2';
import { GENERATE_VERSION, buildGeneratePrompt } from './prompts/generate.v1';
import { applyDependencies, deriveDependsOn, findSpans } from '@/lib/pipeline';
import { fromGemini1000 } from '@/lib/geometry';
import { entitiesFor } from '@/lib/graph';
import { REASON_LANGUAGE, getDict, type Dict, type UiLang } from '@/i18n/dicts';

export interface GeminiOptions {
  apiKey: string;
  textModel: string;
  imageModel: string;
  aspectRatio: string;
  /** 界面语言：决定错误信息和判定理由的语言，默认中文 */
  uiLang?: UiLang;
}

/** 便于测试时注入假的客户端 */
export type GenerateFn = (req: GenerateContentParameters) => Promise<Pick<GenerateContentResponse, 'text' | 'candidates'>>;

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly generate: GenerateFn;
  private readonly lang: UiLang;
  private readonly t: Dict;

  constructor(
    private readonly opts: GeminiOptions,
    generate?: GenerateFn,
    /** 可注入，测试时不用真的等待 */
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.lang = opts.uiLang ?? 'zh';
    this.t = getDict(this.lang);
    if (generate) this.generate = generate;
    else {
      const ai = new GoogleGenAI({ apiKey: opts.apiKey });
      this.generate = (req) => ai.models.generateContent(req);
    }
  }

  async translateAndExtract(srcLang: string, srcPrompt: string): Promise<ExtractResult> {
    const out = await this.callJson(buildExtractPrompt(srcLang, srcPrompt), extractOutputSchema, validateExtract);
    return toExtractResult(out, srcPrompt);
  }

  async generateImages(session: Session, n: number): Promise<GeneratedImage[]> {
    const jobs = (['src', 'en'] as const).flatMap((lang) =>
      Array.from({ length: n }, (_, sampleIndex) => ({ lang, sampleIndex })),
    );
    // 逐个生成（不并发），降低触发每分钟限流的概率
    const out: GeneratedImage[] = [];
    for (const job of jobs) out.push(await this.generateOne(session, job.lang, job.sampleIndex));
    return out;
  }

  private async generateOne(session: Session, lang: 'src' | 'en', sampleIndex: number): Promise<GeneratedImage> {
    const promptUsed = buildGeneratePrompt(lang === 'src' ? session.srcPrompt : session.enPrompt);
    const params = { aspectRatio: this.opts.aspectRatio, responseModalities: ['IMAGE'] };
    const res = await this.request({
      model: this.opts.imageModel,
      contents: promptUsed,
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: this.opts.aspectRatio } },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data)?.inlineData;
    if (!img?.data) {
      const text = parts.map((p) => p.text ?? '').join(' ').trim();
      const why = res.candidates?.[0]?.finishReason;
      throw new Error(this.t.errors.noImageReturned(why, text));
    }
    return {
      id: `img_${lang}_${sampleIndex}_${crypto.randomUUID().slice(0, 8)}`,
      lang,
      sampleIndex,
      promptUsed,
      model: this.opts.imageModel,
      params,
      promptTemplateVersion: GENERATE_VERSION,
      url: `data:${img.mimeType ?? 'image/png'};base64,${img.data}`,
      createdAt: new Date().toISOString(),
    };
  }

  async checkImage(session: Session, image: GeneratedImage): Promise<Check[]> {
    if (!image.url) throw new Error(this.t.errors.imageNoData(image.id));
    const { mimeType, data } = await imageToBase64(image.url);
    const out = await this.callJson(
      [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data } }, { text: buildVerifyPrompt(session.graph, session.requirements, REASON_LANGUAGE[this.lang]) }],
        },
      ],
      verifyOutputSchema,
    );
    return toChecks(out, image.id, session.graph, session.requirements, this.t);
  }

  /** JSON schema 约束输出 → zod 校验 →（可选）语义校验；校验失败重试 1 次 */
  private async callJson<T>(
    contents: GenerateContentParameters['contents'],
    schema: z.ZodType<T>,
    validate?: (data: T) => void,
  ): Promise<T> {
    const jsonSchema = toGeminiJsonSchema(schema);
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.request({
        model: this.opts.textModel,
        contents,
        config: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema, temperature: 0 },
      });
      try {
        const data = schema.parse(JSON.parse(res.text ?? ''));
        validate?.(data);
        return data;
      } catch (e) {
        lastError = e;
        console.warn(`[gemini] output failed validation (attempt ${attempt + 1})`, e, res.text);
      }
    }
    const detail = lastError instanceof z.ZodError ? z.prettifyError(lastError) : String(lastError);
    throw new Error(this.t.errors.validationFailed(detail));
  }

  /** 发请求；遇到 429 按 Google 给的 retryDelay 等待后重试，最多 MAX_429_RETRIES 次 */
  private async request(req: GenerateContentParameters) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.generate(req);
      } catch (e) {
        const info = parseApiError(e);
        const wait = info.status === 429 ? retryWaitMs(info, attempt) : null;
        if (wait == null) throw new Error(friendlyError(e, req.model, this.t));
        console.warn(`[gemini] ${req.model} returned 429, retrying in ${Math.round(wait / 1000)}s (attempt ${attempt + 1})`, info);
        await this.sleep(wait);
      }
    }
  }
}

export const MAX_429_RETRIES = 2;
/** 超过这个等待时间就不自动重试，直接报错 */
const MAX_WAIT_MS = 60_000;

export interface ApiErrorInfo {
  status?: number;
  /** Google 返回的原始说明 */
  message: string;
  retryDelayMs?: number;
  quotaId?: string;
  quotaValue?: string;
}

/** 从 SDK 的 ApiError 中解析 Google 的错误 JSON（message 里通常是完整的响应体） */
export function parseApiError(e: unknown): ApiErrorInfo {
  const raw = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number } | null)?.status;
  const info: ApiErrorInfo = { status, message: raw };
  const at = raw.indexOf('{');
  if (at < 0) return info;
  try {
    const body = JSON.parse(raw.slice(at)) as {
      error?: { code?: number; message?: string; details?: Record<string, unknown>[] };
    };
    const err = body.error;
    if (!err) return info;
    info.status ??= err.code;
    if (err.message) info.message = err.message;
    for (const d of err.details ?? []) {
      const type = String(d['@type'] ?? '');
      if (type.endsWith('RetryInfo') && typeof d.retryDelay === 'string') {
        const sec = parseFloat(d.retryDelay);
        if (Number.isFinite(sec)) info.retryDelayMs = Math.ceil(sec * 1000);
      }
      if (type.endsWith('QuotaFailure') && Array.isArray(d.violations)) {
        const v = d.violations[0] as { quotaId?: string; quotaValue?: string } | undefined;
        info.quotaId = v?.quotaId;
        info.quotaValue = v?.quotaValue;
      }
    }
  } catch {
    /* 不是 JSON，保留原文 */
  }
  return info;
}

/** 429 时应等待多久再重试；返回 null 表示不值得重试 */
export function retryWaitMs(info: ApiErrorInfo, attempt: number): number | null {
  if (attempt >= MAX_429_RETRIES) return null;
  // 额度为 0 或按天的额度用完，等待也没用
  if (info.quotaValue === '0' || /PerDay/i.test(info.quotaId ?? '')) return null;
  const wait = info.retryDelayMs ?? 2000 * 2 ** attempt;
  return wait > MAX_WAIT_MS ? null : wait;
}

// ---------- 以下为纯函数，导出供测试 ----------

/** zod → Gemini 接受的 JSON schema（去掉 $schema 等元信息） */
export function toGeminiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _s, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

/** 抽取结果的引用完整性：ID 唯一，属性 / 关系引用的实体存在 */
export function validateExtract(out: ExtractOutput): void {
  const ids = [...out.entities, ...out.attributes, ...out.relations].map((x) => x.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`duplicate id: ${dup}`);
  const entityIds = new Set(out.entities.map((e) => e.id));
  for (const a of out.attributes) if (!entityIds.has(a.entityId)) throw new Error(`attribute ${a.id} references unknown entity ${a.entityId}`);
  for (const r of out.relations)
    for (const e of [r.subjectId, r.objectId]) if (!entityIds.has(e)) throw new Error(`relation ${r.id} references unknown entity ${e}`);
}

export function toExtractResult(out: ExtractOutput, srcPrompt: string): ExtractResult {
  const missing: string[] = [];
  const spansOf = (p: { src: string[]; en: string[] }, id: string) => {
    const s = findSpans(srcPrompt, p.src);
    const e = findSpans(out.enPrompt, p.en);
    for (const m of s.missing) missing.push(`${id}(src): ${m}`);
    for (const m of e.missing) missing.push(`${id}(en): ${m}`);
    return { src: s.spans, en: e.spans };
  };

  const graph: SceneGraph = {
    entities: out.entities.map((e) => ({ id: e.id, label: e.label, spans: spansOf(e.phrases, e.id) })),
    attributes: out.attributes.map((a) => ({
      id: a.id,
      entityId: a.entityId,
      value: a.value,
      spans: spansOf(a.phrases, a.id),
    })),
    relations: out.relations.map((r) => ({
      id: r.id,
      subjectId: r.subjectId,
      objectId: r.objectId,
      predicate: r.predicate,
      spans: spansOf(r.phrases, r.id),
    })),
  };
  if (missing.length) console.warn('[gemini] phrases not found in prompt, ignored:', missing);

  // 问题顺序：实体 → 属性 → 关系，保证父要求在前
  let n = 0;
  const reqs: Requirement[] = [
    ...out.entities.map((e) => ({ id: `q${++n}`, kind: 'entity' as const, refId: e.id, question: e.question })),
    ...out.attributes.map((a) => ({ id: `q${++n}`, kind: 'attribute' as const, refId: a.id, question: a.question })),
    ...out.relations.map((r) => ({ id: `q${++n}`, kind: 'relation' as const, refId: r.id, question: r.question })),
  ];
  return { enPrompt: out.enPrompt, graph, requirements: deriveDependsOn(graph, reqs) };
}

export function toChecks(
  out: VerifyOutput,
  imageId: string,
  graph: SceneGraph,
  requirements: Requirement[],
  t: Dict = getDict('zh'),
): Check[] {
  const entityIds = new Set(graph.entities.map((e) => e.id));
  const boxes = new Map<string, Box>();
  for (const o of out.objects) {
    if (!entityIds.has(o.entityId)) continue;
    try {
      boxes.set(o.entityId, fromGemini1000(o.box_2d));
    } catch {
      /* 忽略无效框 */
    }
  }

  const raw = new Map(out.results.map((r) => [r.requirementId, r]));
  const verdicts: Record<string, Verdict> = {};
  for (const req of requirements) verdicts[req.id] = raw.get(req.id)?.verdict ?? 'unsure';
  const final = applyDependencies(requirements, verdicts);

  return requirements.map((req) => {
    const verdict = final[req.id]!;
    const r = raw.get(req.id);
    const reason =
      verdict === 'n/a' && r?.verdict !== undefined
        ? t.errors.precondition(r.verdict)
        : (r?.reason ?? t.errors.noResultForRequirement);
    const reqBoxes = Object.fromEntries(
      entitiesFor(graph, requirements, req.refId).flatMap((e) => (boxes.has(e) ? [[e, boxes.get(e)!]] : [])),
    );
    return {
      imageId,
      requirementId: req.id,
      verdict,
      reason,
      ...(Object.keys(reqBoxes).length ? { boxes: reqBoxes } : {}),
    };
  });
}

async function imageToBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  if (m) return { mimeType: m[1]!, data: m[2]! };
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return imageToBase64(dataUrl);
}

export function friendlyError(e: unknown, model?: string, t: Dict = getDict('zh')): string {
  const info = parseApiError(e);
  const err = t.errors;
  const m = model ? t.common.quote(model) : '';
  const detail = info.message.length > 300 ? info.message.slice(0, 300) + '…' : info.message;
  if (/api key not valid|API_KEY_INVALID/i.test(info.message)) return err.invalidKey;
  if (info.status === 401 || info.status === 403) return err.noPermission(m, info.status, detail);
  if (info.status === 404) return err.modelNotFound(m);
  if (info.status === 429) {
    const quota = info.quotaId ? `${info.quotaId}${info.quotaValue ? ` = ${info.quotaValue}` : ''}` : '';
    const hint =
      info.quotaValue === '0' ? err.quotaZero : /PerDay/i.test(info.quotaId ?? '') ? err.quotaDay : err.quotaRetry;
    return err.quota(m, quota, hint, detail);
  }
  if (/failed to fetch|network/i.test(info.message)) return err.network;
  return err.generic(m, detail);
}
