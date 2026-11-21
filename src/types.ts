// PromptDiff 共享数据类型。修改前先在组里说明原因（见 CLAUDE.md）。

/** 图像来自哪种 prompt：源语言、英文译文，或改进后的结果 */
export type Lang = 'src' | 'en' | 'refined';

/** 双语字段：src = 用户母语，en = 英文译文 */
export type Bi<T> = { src: T; en: T };

/** prompt 中的字符区间 [start, end)，按 JS 字符串下标 */
export type Span = [start: number, end: number];

/** 归一化边界框 [x0, y0, x1, y1]，取值 0–1，原点在左上角 */
export type Box = [x0: number, y0: number, x1: number, y1: number];

// ---------- Scene graph（② 抽取） ----------

export interface Entity {
  id: string;
  label: Bi<string>;
  spans: Bi<Span[]>;
}

export interface Attribute {
  id: string;
  entityId: string;
  value: Bi<string>;
  spans: Bi<Span[]>;
}

export interface Relation {
  id: string;
  subjectId: string;
  objectId: string;
  predicate: Bi<string>;
  spans: Bi<Span[]>;
}

export interface SceneGraph {
  entities: Entity[];
  attributes: Attribute[];
  relations: Relation[];
}

// ---------- 逐条检查（④） ----------

export type RequirementKind = 'entity' | 'attribute' | 'relation';

export interface Requirement {
  id: string;
  kind: RequirementKind;
  /** 指向 Entity / Attribute / Relation 的 id */
  refId: string;
  /** 依赖的父要求；父要求为 no 时本条记为 n/a */
  dependsOn?: string[];
  /** 发给视觉模型的英文问题，如 "Is the cat red?" */
  question: string;
}

export type Verdict = 'yes' | 'no' | 'unsure' | 'n/a';

export interface Check {
  imageId: string;
  requirementId: string;
  verdict: Verdict;
  reason: string;
  /** entityId → 该实体在图中的边界框 */
  boxes?: Record<string, Box>;
  /** 用户覆盖模型判定 */
  userOverride?: 'yes' | 'no';
}

// ---------- 图像（③ ⑧） ----------

export interface GeneratedImage {
  id: string;
  lang: Lang;
  /** 同一语言的第几张（多样本） */
  sampleIndex: number;
  /** 实际发给模型的 prompt */
  promptUsed: string;
  model: string;
  params: Record<string, unknown>;
  promptTemplateVersion: string;
  /** 静态资源或 fixture 的路径 / URL */
  url?: string;
  /** IndexedDB 中图片 Blob 的键 */
  blobKey?: string;
  createdAt: string;
}

// ---------- 标注（⑥） ----------

export type AnnotationIntent = 'keep_appearance' | 'keep_position' | 'change' | 'remove';

export interface Annotation {
  id: string;
  /** 界面上显示的编号 1, 2, 3… */
  number: number;
  imageId: string;
  /** 边界框，或手绘路径（归一化坐标点） */
  region: Box | [number, number][];
  entityId?: string;
  intent: AnnotationIntent;
  comment?: string;
}

// ---------- 差异分类（⑤） ----------

export type DiffCategory = 'both_pass' | 'both_fail' | 'src_only_fail' | 'en_only_fail' | 'uncertain';

export interface RequirementDiff {
  requirementId: string;
  category: DiffCategory;
  /** 各语言通过率 0–1（多样本时有意义） */
  passRate: Partial<Record<Lang, number>>;
}

// ---------- 会话与迭代 ----------

export interface Iteration {
  id: string;
  parentId?: string;
  images: GeneratedImage[];
  checks: Check[];
  annotations: Annotation[];
  /** ⑦ 合成的编辑指令 */
  instruction?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  title?: string;
  /** 源语言代码，如 zh / de / ja */
  srcLang: string;
  srcPrompt: string;
  enPrompt: string;
  graph: SceneGraph;
  requirements: Requirement[];
  iterations: Iteration[];
  createdAt: string;
}
