import type { AnnotationIntent } from '@/types';

/** 意图：图标 + 文字，不只靠颜色区分。文字在 i18n 词典 annotate.intents 下 */
export const INTENTS: { id: AnnotationIntent; icon: string; cls: string }[] = [
  { id: 'keep_appearance', icon: '◎', cls: 'border-[#cfdcff] bg-brand-soft text-brand' },
  { id: 'keep_position', icon: '⌖', cls: 'border-[#c9ebd9] bg-ok-soft text-ok' },
  { id: 'change', icon: '✎', cls: 'border-[#f5dfb3] bg-warn-soft text-warn' },
  { id: 'remove', icon: '⊘', cls: 'border-[#f6cfd4] bg-bad-soft text-bad' },
];

export const intentInfo = (id: AnnotationIntent) => INTENTS.find((i) => i.id === id)!;
