import type { Check, GeneratedImage, Requirement, SceneGraph, Session } from '@/types';

/** ② 翻译 + 抽取的结果 */
export interface ExtractResult {
  enPrompt: string;
  graph: SceneGraph;
  requirements: Requirement[];
}

/** 所有 AI 调用的唯一入口。组件只依赖这个接口，不直接调用 SDK。 */
export interface AIProvider {
  readonly name: string;
  /** ② 一次调用：英文译文 + 双语 scene graph + 检查问题 */
  translateAndExtract(srcLang: string, srcPrompt: string): Promise<ExtractResult>;
  /** ③ 两种语言各生成 n 张图 */
  generateImages(session: Session, n: number): Promise<GeneratedImage[]>;
  /** ④ 对一张图逐条检查 */
  checkImage(session: Session, image: GeneratedImage): Promise<Check[]>;
}
