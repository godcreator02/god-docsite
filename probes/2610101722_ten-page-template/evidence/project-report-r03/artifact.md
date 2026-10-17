# 自建项目技术报告模板与十页正文

主交付：templates/project-report.dotx（仓根）与本目录 word-com.docx。
模板使用 Word 原生无宏模板格式，报告由仓内 .venv Python + pywin32 从模板新建。
正文数据：fixtures/canonical.json 的 projectReport；演示曲线为离线计算，工程用例均待实测。

版式：A4 四边 25 mm；正文宋体 / Times New Roman 12 pt，1.5 倍行距；三级黑体标题 16 / 14 / 12 pt；表格 10.5 pt。宽表使用独立横向节。封面五个内容控件，目录和页码、题注编号和交叉引用均为 Word 原生对象。

最终共 12 页：封面、目录、10 页正文。Word 导出 PDF，Poppler 110 dpi 页面图全部逐页查看。长表表头在续页重复，没有单行拆页；列表编号分别从 1 开始。

实际行为验收见 project-verification.json：六类公式分别编辑保存重开并保持数学结构；插入新公式后序号与引用更新；增加 15 条长表行后重新分页；封面控件、批注和修订保存重开。
原始报告保留原公式。所有编辑都发生在独立检查副本，副本不是工程结论。

模板三页骨架和编辑副本的受影响页面也已检查，页码与哈希记在 visual-review.json。manifest.json 记录环境、模板、数据和脚本哈希。
MathType OLE、WPS / 在线 / macOS Word、任意 LaTeX 解析和性能基准未测试。
