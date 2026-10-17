# Python COM 首次试跑

使用仓内 `.venv` 的 Python 3.12.14 与 pywin32 312。初次生成在 `Word.Application.MillimetersToPoints` 报错：`-2147467259 / E_FAIL / Unspecified error`。整数、浮点参数及生成类型包装均出现同样错误。

改为按 `mm × 72 / 25.4` 转换单位后，生成了本目录的 `word-com.raw.docx`。本目录不是最终交付；完整复验见 `../python-venv-20261010-144415/`。
