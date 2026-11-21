// ③ 生成。v1 直接发送 prompt 原文，不加任何包装，保证两种语言条件一致。
export const GENERATE_VERSION = 'generate.v1';

export function buildGeneratePrompt(prompt: string): string {
  return prompt;
}
