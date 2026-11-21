import type { Lang, Span, Verdict } from '@/types';
import { segment } from '@/lib/graph';
import { cn } from '@/lib/utils';
import { tr, useT } from '@/i18n';

export const SRC_LANGS: { code: string; name: string }[] = [
  { code: 'zh', name: '中文' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
];

/** 界面上直接显示语言名，不用 A/B。语言名用本族写法，不随界面语言变化 */
export function langName(lang: Lang, srcLang: string): string {
  if (lang === 'en') return 'English';
  if (lang === 'refined') return tr().lang.refined;
  return SRC_LANGS.find((l) => l.code === srcLang)?.name ?? srcLang;
}

/** 语言的短标记，用于小方块徽标 */
export function langCode(lang: Lang, srcLang: string): string {
  if (lang === 'en') return 'EN';
  if (lang === 'refined') return '+';
  return srcLang.toUpperCase();
}

export function HighlightedText({ text, spans, className }: { text: string; spans: Span[]; className?: string }) {
  return (
    <p className={cn('leading-relaxed', className)}>
      {segment(text, spans).map(([t, on], i) =>
        on ? (
          <mark key={i} className="rounded bg-brand-soft px-0.5 font-semibold text-brand">
            {t}
          </mark>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </p>
  );
}

const VERDICT_STYLE: Record<Verdict, { icon: string; key: 'yes' | 'no' | 'unsure' | 'na'; cls: string }> = {
  yes: { icon: '✓', key: 'yes', cls: 'bg-ok-soft text-ok border-[#c9ebd9]' },
  no: { icon: '✗', key: 'no', cls: 'bg-bad-soft text-bad border-[#f6cfd4]' },
  unsure: { icon: '?', key: 'unsure', cls: 'bg-warn-soft text-warn border-[#f5dfb3]' },
  'n/a': { icon: '–', key: 'na', cls: 'bg-chip text-faint border-line' },
};

/** 判定徽章：图标 + 颜色 + 文字，不只靠红/绿 */
export function VerdictBadge({ verdict, title, compact }: { verdict: Verdict; title?: string; compact?: boolean }) {
  const t = useT();
  const v = VERDICT_STYLE[verdict];
  const label = t.verdict[v.key];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap',
        v.cls,
      )}
    >
      <span aria-hidden>{v.icon}</span>
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

/** 兼容旧调用：主按钮 */
export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('btn-primary', className)} {...props} />;
}

export function Card({
  title,
  icon,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('card', className)}>
      {title && (
        <header className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
          {icon && (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
          )}
          <h2 className="min-w-0 flex-1 text-sm font-bold text-ink-2">{title}</h2>
          {aside}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** 页面标题：eyebrow + h1 + 说明 */
export function PageHeading({
  eyebrow,
  title,
  desc,
  aside,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="text-[27px] leading-tight font-bold tracking-[-0.8px] text-ink">{title}</h1>
        {desc && <p className="mt-1 text-[13px] text-muted">{desc}</p>}
      </div>
      {aside}
    </div>
  );
}

/** 计数小圆徽 */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        'grid h-5 min-w-5 place-items-center rounded-full bg-brand-soft px-1.5 text-[11px] font-bold text-brand',
        className,
      )}
    >
      {n}
    </span>
  );
}
