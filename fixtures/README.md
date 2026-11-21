# fixtures

Mock 模式和离线演示用的数据。格式严格遵守 `src/types.ts` 的 `Session` 类型。
在「创建」页的「载入示例」里选择。两个示例的 prompt 只差猫的颜色（照片示例是橘色，合成示例是红色），scene graph 结构和检查问题相同。

## cat-dog（默认：橘猫与蓝狗，照片）
- `session.json`：中文 prompt「一只橘色的猫坐在一只蓝色的狗左边，在树下。」及其英文译文「An orange cat sits to the left of a blue dog under a tree.」、双语 scene graph（3 实体 / 3 属性 / 3 关系）、9 条检查问题、两张图的逐条检查结果（含边界框）。
- `src-0.png`（中文 prompt，狗坐着）/ `en-0.png`（英文 prompt，狗趴着）：1536×1024 真实生成图。边界框为人工估计。
- prompt 已改成与图片一致（原为「红色的猫」，图中实际是橘色虎斑猫），9 条检查两边都是 yes（both_pass）。
- 注意：这两张图实际是用「红色的猫」的 prompt 生成的；`promptUsed` 已改为新 prompt，以保持示例自洽。

## cat-dog-svg（全部差异分类，合成图）
- 原来的手绘 SVG 占位图和检查结果，prompt 仍是「一只红色的猫…」，特意覆盖全部差异分类，方便开发 UI：


| 要求 | 中文图 | 英文图 | 分类 |
| --- | --- | --- | --- |
| q4 猫是红色的 | no | no | both_fail |
| q6 狗是蓝色的 | yes | unsure | uncertain |
| q9 狗在树下 | no | yes | src_only_fail |
| 其余 6 条 | yes | yes | both_pass |

`en_only_fail` 暂无样例，需要时可以把某条英文图的 verdict 改成 no。
