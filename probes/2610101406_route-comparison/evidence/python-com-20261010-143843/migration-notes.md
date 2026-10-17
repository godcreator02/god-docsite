# Python COM 迁移检查

三条路线完成生成、Word 保存重开、分母编辑、PDF 导出；页面与原先各自的样稿一致。

额外的双实例检查发现：按 Word 实例调用 `CoUninitialize` 会使同一 Python 主线程上的另一个 COM 包装对象断连，报 `-2147220995 / Object is not connected to server`。改由 pythoncom 管理主线程 COM 生命周期，仅在实例上下文中关闭所属文档及 Word。

修正后主动抛出异常，确认出错实例进程退出，另一实例中预置的独立文档内容仍可读。通过记录在 `migration-checks.json`。之前测试留下的三个实例按 PID、未保存文档路径及预置文本核对归属后逐一退出，没有全局结束 WINWORD。

最终代码的完整重跑、逐页检查和脚本哈希见 `../python-venv-20261010-144415/`。
