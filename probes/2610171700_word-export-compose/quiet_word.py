"""排版稿期间关掉 Word 的后台工作，分两组试：
- 窗口：屏幕刷新关掉、窗口换成草稿视图（只影响这个 Word 和这份文档，不留下）
- 校对：后台分页、边写边查拼写与语法（当前用户的全局设置，Word 退出时写进注册表，所以结束时恢复原值）
"""
from contextlib import contextmanager

DRAFT_VIEW = 1


def word_settings(word):
    options = word.Options
    return dict(screen_updating=word.ScreenUpdating, pagination=options.Pagination,
                spelling=options.CheckSpellingAsYouType, grammar=options.CheckGrammarAsYouType)


@contextmanager
def quiet_window(word, doc):
    view = doc.Windows.Item(1).View
    saved_view, saved_updating = view.Type, word.ScreenUpdating
    try:
        word.ScreenUpdating = False
        view.Type = DRAFT_VIEW
        yield
    finally:
        view.Type = saved_view
        word.ScreenUpdating = saved_updating


@contextmanager
def quiet_proofing(word):
    options = word.Options
    saved = word_settings(word)
    try:
        options.Pagination = False
        options.CheckSpellingAsYouType = False
        options.CheckGrammarAsYouType = False
        yield
    finally:
        options.CheckGrammarAsYouType = saved['grammar']
        options.CheckSpellingAsYouType = saved['spelling']
        options.Pagination = saved['pagination']


@contextmanager
def quiet_word(word, doc):
    with quiet_proofing(word), quiet_window(word, doc):
        yield
