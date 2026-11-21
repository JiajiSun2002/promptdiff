import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider, friendlyError, parseApiError, retryWaitMs, toChecks, toGeminiJsonSchema, type GenerateFn } from './gemini';
import { extractOutputSchema, type ExtractOutput } from './prompts/extract.v1';
import { getDemoSession } from './mock';

const opts = { apiKey: 'test', textModel: 'text-model', imageModel: 'image-model', aspectRatio: '1:1' };
const demo = getDemoSession('svg');

const extractOut: ExtractOutput = {
  enPrompt: demo.enPrompt,
  entities: [
    { id: 'e_cat', label: { src: '猫', en: 'cat' }, phrases: { src: ['猫'], en: ['cat'] }, question: 'Is there a cat?' },
    { id: 'e_tree', label: { src: '树', en: 'tree' }, phrases: { src: ['树'], en: ['tree'] }, question: 'Is there a tree?' },
  ],
  attributes: [
    {
      id: 'a_cat_red',
      entityId: 'e_cat',
      value: { src: '红色的', en: 'red' },
      phrases: { src: ['红色的'], en: ['red'] },
      question: 'Is the cat red?',
    },
  ],
  relations: [
    {
      id: 'r_cat_under_tree',
      subjectId: 'e_cat',
      objectId: 'e_tree',
      predicate: { src: '在…下', en: 'under' },
      phrases: { src: ['在', '下'], en: ['under'] },
      question: 'Is the cat under the tree?',
    },
  ],
};

const textResponse = (obj: unknown) => ({ text: JSON.stringify(obj), candidates: [] });

describe('GeminiProvider.translateAndExtract', () => {
  it('sends a JSON schema and builds spans + dependencies in code', async () => {
    const gen = vi.fn<GenerateFn>().mockResolvedValue(textResponse(extractOut));
    const r = await new GeminiProvider(opts, gen).translateAndExtract('zh', demo.srcPrompt);

    const req = gen.mock.calls[0]![0];
    expect(req.model).toBe('text-model');
    expect(req.config?.responseMimeType).toBe('application/json');
    expect(req.config?.responseJsonSchema).toMatchObject({ type: 'object' });

    expect(r.graph.entities[0]!.spans).toEqual({ src: [[5, 6]], en: [[6, 9]] });
    expect(r.graph.relations[0]!.spans.src).toEqual([
      [17, 18],
      [19, 20],
    ]);
    expect(r.requirements.map((q) => [q.id, q.refId, q.dependsOn])).toEqual([
      ['q1', 'e_cat', undefined],
      ['q2', 'e_tree', undefined],
      ['q3', 'a_cat_red', ['q1']],
      ['q4', 'r_cat_under_tree', ['q1', 'q2']],
    ]);
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    const gen = vi
      .fn<GenerateFn>()
      .mockResolvedValueOnce({ text: '{"enPrompt": 1}', candidates: [] })
      .mockResolvedValueOnce(textResponse(extractOut));
    await new GeminiProvider(opts, gen).translateAndExtract('zh', demo.srcPrompt);
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('retries on broken references and fails after the second attempt', async () => {
    const bad = { ...extractOut, attributes: [{ ...extractOut.attributes[0]!, entityId: 'e_ghost' }] };
    const gen = vi.fn<GenerateFn>().mockResolvedValue(textResponse(bad));
    await expect(new GeminiProvider(opts, gen).translateAndExtract('zh', demo.srcPrompt)).rejects.toThrow(/e_ghost/);
    expect(gen).toHaveBeenCalledTimes(2);
  });
});

describe('GeminiProvider.generateImages', () => {
  it('generates one image per language with metadata', async () => {
    const gen = vi.fn<GenerateFn>().mockResolvedValue({
      text: undefined,
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }],
    });
    const imgs = await new GeminiProvider(opts, gen).generateImages(demo, 1);
    expect(imgs.map((i) => [i.lang, i.promptUsed, i.model, i.url])).toEqual([
      ['src', demo.srcPrompt, 'image-model', 'data:image/png;base64,AAAA'],
      ['en', demo.enPrompt, 'image-model', 'data:image/png;base64,AAAA'],
    ]);
    expect(gen.mock.calls[0]![0].config?.imageConfig?.aspectRatio).toBe('1:1');
    expect(imgs[0]!.promptTemplateVersion).toBe('generate.v1');
  });

  it('throws a readable error when no image comes back', async () => {
    const gen = vi.fn<GenerateFn>().mockResolvedValue({
      text: undefined,
      candidates: [{ finishReason: 'SAFETY' as never, content: { parts: [{ text: 'blocked' }] } }],
    });
    await expect(new GeminiProvider(opts, gen).generateImages(demo, 1)).rejects.toThrow(/SAFETY.*blocked/);
  });
});

describe('GeminiProvider.checkImage / toChecks', () => {
  it('converts box_2d, fills missing results and applies n/a', async () => {
    const gen = vi.fn<GenerateFn>().mockResolvedValue(
      textResponse({
        results: [
          { requirementId: 'q1', verdict: 'no', reason: '没有猫' },
          { requirementId: 'q2', verdict: 'yes', reason: '有狗' },
          { requirementId: 'q4', verdict: 'yes', reason: '红色' },
        ],
        objects: [{ entityId: 'e_dog', box_2d: [520, 660, 800, 860] }],
      }),
    );
    const image = { ...demo.iterations[0]!.images[0]!, url: 'data:image/png;base64,AAAA' };
    const checks = await new GeminiProvider(opts, gen).checkImage(demo, image);

    // 图片以 inlineData 发送
    const contents = gen.mock.calls[0]![0].contents as { parts: { inlineData?: unknown }[] }[];
    expect(contents[0]!.parts[0]!.inlineData).toEqual({ mimeType: 'image/png', data: 'AAAA' });

    const by = Object.fromEntries(checks.map((c) => [c.requirementId, c]));
    expect(checks).toHaveLength(demo.requirements.length);
    expect(by.q2!.boxes).toEqual({ e_dog: [0.66, 0.52, 0.86, 0.8] });
    expect(by.q4!.verdict).toBe('n/a'); // 依赖 q1（no）
    expect(by.q3!.verdict).toBe('unsure'); // 模型漏答
    expect(by.q1!.boxes).toBeUndefined(); // 没有猫的框
  });

  it('ignores boxes for unknown entities', () => {
    const checks = toChecks(
      { results: [], objects: [{ entityId: 'e_ghost', box_2d: [0, 0, 10, 10] }] },
      'img',
      demo.graph,
      demo.requirements,
    );
    expect(checks.every((c) => c.boxes === undefined)).toBe(true);
  });
});

describe('helpers', () => {
  it('strips $schema from the JSON schema', () => {
    expect(toGeminiJsonSchema(extractOutputSchema)).not.toHaveProperty('$schema');
  });
  it('maps common API errors to Chinese hints', () => {
    expect(friendlyError(new Error('API key not valid. Please pass a valid API key.'))).toMatch(/API key 无效/);
    expect(friendlyError(Object.assign(new Error('x'), { status: 429 }))).toMatch(/429/);
    expect(friendlyError(Object.assign(new Error('x'), { status: 404 }), 'm1')).toMatch(/m1/);
  });
});

// ---------- 429 处理 ----------

/** 模拟 SDK 的 ApiError：message 里是 Google 的完整错误 JSON */
function apiError429(opts: { retryDelay?: string; quotaId?: string; quotaValue?: string } = {}) {
  const details: unknown[] = [];
  if (opts.quotaId)
    details.push({
      '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
      violations: [{ quotaMetric: 'm', quotaId: opts.quotaId, quotaValue: opts.quotaValue }],
    });
  if (opts.retryDelay) details.push({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: opts.retryDelay });
  const body = { error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED', details } };
  return Object.assign(new Error(`got status: 429 . ${JSON.stringify(body)}`), { status: 429 });
}

describe('parseApiError / retryWaitMs', () => {
  it('extracts message, quota and retry delay', () => {
    const info = parseApiError(apiError429({ retryDelay: '41s', quotaId: 'PerMinute-FreeTier', quotaValue: '10' }));
    expect(info).toMatchObject({
      status: 429,
      message: 'You exceeded your current quota.',
      retryDelayMs: 41000,
      quotaId: 'PerMinute-FreeTier',
      quotaValue: '10',
    });
  });
  it('keeps raw text when the body is not JSON', () => {
    expect(parseApiError(new Error('boom')).message).toBe('boom');
  });
  it('decides when retrying is worthwhile', () => {
    expect(retryWaitMs({ message: '', retryDelayMs: 5000 }, 0)).toBe(5000);
    expect(retryWaitMs({ message: '' }, 1)).toBe(4000); // 无 retryDelay 时指数退避
    expect(retryWaitMs({ message: '', retryDelayMs: 5000 }, 2)).toBeNull(); // 次数用完
    expect(retryWaitMs({ message: '', retryDelayMs: 120_000 }, 0)).toBeNull(); // 等太久
    expect(retryWaitMs({ message: '', quotaValue: '0' }, 0)).toBeNull(); // 没有额度
    expect(retryWaitMs({ message: '', quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }, 0)).toBeNull();
  });
});

describe('GeminiProvider 429 retry', () => {
  it('waits retryDelay and retries, then succeeds', async () => {
    const sleep = vi.fn(async () => {});
    const gen = vi
      .fn<GenerateFn>()
      .mockRejectedValueOnce(apiError429({ retryDelay: '3s' }))
      .mockResolvedValueOnce(textResponse(extractOut));
    await new GeminiProvider(opts, gen, sleep).translateAndExtract('zh', demo.srcPrompt);
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('gives up after 2 retries with model and Google message in the error', async () => {
    const sleep = vi.fn(async () => {});
    const gen = vi.fn<GenerateFn>().mockRejectedValue(apiError429({ retryDelay: '1s' }));
    await expect(new GeminiProvider(opts, gen, sleep).translateAndExtract('zh', demo.srcPrompt)).rejects.toThrow(
      /text-model.*429.*You exceeded your current quota/,
    );
    expect(gen).toHaveBeenCalledTimes(3);
  });

  it('does not retry when the quota is 0, and explains billing', async () => {
    const sleep = vi.fn(async () => {});
    const gen = vi.fn<GenerateFn>().mockRejectedValue(apiError429({ quotaId: 'Images-FreeTier', quotaValue: '0' }));
    await expect(new GeminiProvider(opts, gen, sleep).generateImages(demo, 1)).rejects.toThrow(/image-model.*结算/);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('GeminiProvider sequential generation', () => {
  it('never has more than one image request in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const gen: GenerateFn = async () => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { text: undefined, candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AA' } }] } }] };
    };
    const imgs = await new GeminiProvider(opts, gen).generateImages(demo, 2);
    expect(imgs.map((i) => `${i.lang}${i.sampleIndex}`)).toEqual(['src0', 'src1', 'en0', 'en1']);
    expect(maxInFlight).toBe(1);
  });
});

// ---------- 界面语言 ----------

describe('GeminiProvider uiLang', () => {
  it('asks for reasons in the UI language and localizes errors', async () => {
    const gen = vi.fn<GenerateFn>().mockResolvedValue(textResponse({ results: [], objects: [] }));
    const image = { ...demo.iterations[0]!.images[0]!, url: 'data:image/png;base64,AAAA' };
    const checks = await new GeminiProvider({ ...opts, uiLang: 'de' }, gen).checkImage(demo, image);
    const contents = gen.mock.calls[0]![0].contents as { parts: { text?: string }[] }[];
    expect(contents[0]!.parts[1]!.text).toContain('one short sentence in German');
    expect(checks[0]!.reason).toBe('Das Modell hat für diese Anforderung kein Ergebnis geliefert.');
  });

  it('defaults to Simplified Chinese reasons', async () => {
    const gen = vi.fn<GenerateFn>().mockResolvedValue(textResponse({ results: [], objects: [] }));
    const image = { ...demo.iterations[0]!.images[0]!, url: 'data:image/png;base64,AAAA' };
    await new GeminiProvider(opts, gen).checkImage(demo, image);
    const contents = gen.mock.calls[0]![0].contents as { parts: { text?: string }[] }[];
    expect(contents[0]!.parts[1]!.text).toContain('one short sentence in Simplified Chinese');
  });

  it('localizes API errors in English', async () => {
    const gen = vi.fn<GenerateFn>().mockRejectedValue(Object.assign(new Error('x'), { status: 404 }));
    await expect(
      new GeminiProvider({ ...opts, uiLang: 'en' }, gen).translateAndExtract('zh', demo.srcPrompt),
    ).rejects.toThrow('Model "text-model" not found');
  });
});
