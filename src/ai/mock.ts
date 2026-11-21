// MockProvider：不调用任何模型，直接返回 fixtures/ 里的示例数据。
import type { Check, GeneratedImage, Session } from '@/types';
import type { AIProvider, ExtractResult } from './provider';
import { parseSession } from './schema';
import catDogPhoto from '../../fixtures/cat-dog/session.json';
import catDogSvg from '../../fixtures/cat-dog-svg/session.json';

/** fixture 里的图片路径（如 "fixtures/cat-dog/src-0.png"）→ Vite 资源 URL */
const fixtureAssets = import.meta.glob('/fixtures/**/*.{svg,png,jpg,jpeg,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function resolveFixtureUrl(url: string): string {
  return fixtureAssets['/' + url.replace(/^\.?\//, '')] ?? url;
}

export type DemoId = 'photo' | 'svg';

/** 示例的显示名称在 i18n 词典的 demos 下 */
export const DEMOS: { id: DemoId; session: Session }[] = [
  { id: 'photo', session: parseSession(catDogPhoto) },
  { id: 'svg', session: parseSession(catDogSvg) },
];

const demoById = (id: DemoId) => DEMOS.find((d) => d.id === id)!.session;

/** 示例会话（深拷贝）。默认照片示例。 */
export function getDemoSession(id: DemoId = 'photo'): Session {
  return structuredClone(demoById(id));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 300 + Math.random() * 300;

export class MockProvider implements AIProvider {
  readonly name = 'mock';
  /** 当前返回哪个示例；由「载入示例」切换 */
  demo: DemoId = 'photo';

  private get data() {
    return demoById(this.demo);
  }

  async translateAndExtract(_srcLang: string, _srcPrompt: string): Promise<ExtractResult> {
    await delay(jitter());
    const d = this.data;
    return structuredClone({ enPrompt: d.enPrompt, graph: d.graph, requirements: d.requirements });
  }

  async generateImages(_session: Session, n: number): Promise<GeneratedImage[]> {
    await delay(jitter());
    const images = this.data.iterations[0]?.images ?? [];
    return images
      .filter((img) => img.sampleIndex < n)
      .map((img) => ({ ...img, url: img.url && resolveFixtureUrl(img.url) }));
  }

  async checkImage(_session: Session, image: GeneratedImage): Promise<Check[]> {
    await delay(jitter());
    const checks = this.data.iterations[0]?.checks ?? [];
    return structuredClone(checks.filter((c) => c.imageId === image.id));
  }
}

export const mockProvider = new MockProvider();
