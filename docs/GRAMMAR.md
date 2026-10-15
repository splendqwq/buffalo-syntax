# 解释规则

本站按以下括号化的实验规则生成句子、解释关系并进行编辑：

```text
NP → [Buffalo] buffalo {NP buffalo}
S  → NP buffalo NP
```

`Buffalo` 是地名定语，紧邻并修饰后面的复数名词 `buffalo`。名词对应一组水牛；动词 `buffalo` 表示“欺负／威吓”。名词按复数使用，使动词形式保持一致。

`{NP buffalo}` 是一段宾语关系从句：其中的主语欺负被修饰的水牛，省略的 `that` 回指先行词。关系从句可以嵌套或叠加在主句双方上；整个从句修饰其目标名词，而非只看最后一个词。

经典 8 词句：

```text
[Buffalo buffalo (A) [Buffalo buffalo (B) buffalo (B→A)]]
buffalo (A→C)
[Buffalo buffalo (C)].
```

即 **B 欺负 A，A 欺负 C**，三组都来自布法罗。

经典嵌套构造属于原始语言梗；多个零关系从句叠加在同一名词上的自然英语可接受性存在争议。项目中的“有效”指符合上述实验规则。参考 [Culicover: Simpler Syntax and explanation](https://proceedings.hpsg.xyz/article/view/808/1100)。

1–2 词采用省略成分的祈使句：`buffalo!` 表示“去欺负！”，`buffalo buffalo!` 表示“去欺负水牛！”。省略的 `you` 与未写出的对象在图中用虚线标注，不计词数。

## 句子与图形同步

可编辑状态只有树结构：主赛双方、各组产地、对手与先后次序。每次操作在副本上完成，先校验两组主赛选手、无环、无重复、完整连通和词数上限，再统一生成所有词号、词性、指代、从句范围和图的连线；失败不提交。

文字草稿根据大写位置确定地名牌，使用动态规划识别完整的句子，并给出最多三种不同读法。暂时不合法的草稿不进入正式状态；应用前再次从树编译。语法图过深时改用层级列表，仍保留每段范围和目标。

随机生成与手动编辑不同：随机生成从 7 词起保证分叉，手动编辑可以形成链或分叉。输入词数不限定编辑后的词数，添加／删除操作会明确显示变化。

词义参考：[Cambridge Dictionary: buffalo](https://dictionary.cambridge.org/us/dictionary/english/buffalo)。插图按项目的“水牛”主题绘制，英文梗中的 buffalo 也常指美洲野牛。
