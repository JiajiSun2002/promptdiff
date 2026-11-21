// 差异分类（纯函数）。规则见 docs/SPEC.md「差异分类」。
import type { Check, DiffCategory, GeneratedImage, Iteration, Lang, RequirementDiff, Session, Verdict } from '@/types';

/** 通过率阈值：passRate ≥ PASS_THRESHOLD 视为通过 */
export const PASS_THRESHOLD = 0.5;

/** 用户覆盖优先于模型判定 */
export function effectiveVerdict(check: Check): Verdict {
  return check.userOverride ?? check.verdict;
}

/**
 * 单条要求的差异分类。
 * - 任一语言没有结果，或任一样本为 unsure → uncertain
 * - 否则每种语言 passRate = yes 数 / 样本数（n/a 记为未通过），≥ 阈值算通过
 */
export function diffRequirement(requirementId: string, images: GeneratedImage[], checks: Check[]): RequirementDiff {
  const passRate: Partial<Record<Lang, number>> = {};
  let anyUnsure = false;
  let missing = false;

  for (const lang of ['src', 'en'] as const) {
    const ids = new Set(images.filter((img) => img.lang === lang).map((img) => img.id));
    const verdicts = checks
      .filter((c) => c.requirementId === requirementId && ids.has(c.imageId))
      .map(effectiveVerdict);
    if (verdicts.length === 0) {
      missing = true;
      continue;
    }
    if (verdicts.includes('unsure')) anyUnsure = true;
    passRate[lang] = verdicts.filter((v) => v === 'yes').length / verdicts.length;
  }

  let category: DiffCategory;
  if (missing || anyUnsure) category = 'uncertain';
  else {
    const srcPass = passRate.src! >= PASS_THRESHOLD;
    const enPass = passRate.en! >= PASS_THRESHOLD;
    category =
      srcPass && enPass ? 'both_pass' : !srcPass && !enPass ? 'both_fail' : srcPass ? 'en_only_fail' : 'src_only_fail';
  }
  return { requirementId, category, passRate };
}

export function diffAll(session: Session, iteration: Iteration): Record<string, RequirementDiff> {
  const out: Record<string, RequirementDiff> = {};
  for (const req of session.requirements) out[req.id] = diffRequirement(req.id, iteration.images, iteration.checks);
  return out;
}

/** 只在一种语言失败：可能的语言效应，需要重点展示 */
export function isLanguageGap(category: DiffCategory): category is 'src_only_fail' | 'en_only_fail' {
  return category === 'src_only_fail' || category === 'en_only_fail';
}
