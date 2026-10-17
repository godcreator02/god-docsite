"""Own isolated Word sessions and finalize native Word documents."""
from contextlib import contextmanager
import gc
import threading
import warnings
from pathlib import Path
import sys

_com_cache_configured = False


def configure_com_cache():
    """Keep generated COM wrappers inside this venv, away from shared TEMP.

    A missing/corrupt shared wrapper can silently force late binding and a
    type-library lookup on almost every property access.
    """
    global _com_cache_configured
    if _com_cache_configured:
        return
    import win32com
    import win32com.gen_py
    cache = Path(sys.prefix) / 'word-com-cache'
    cache.mkdir(parents=True, exist_ok=True)
    win32com.__gen_path__ = str(cache)
    win32com.gen_py.__path__ = [str(cache)]
    from win32com.client import gencache
    gencache.is_readonly = False
    gencache.Rebuild(verbose=0)
    _com_cache_configured = True


@contextmanager
def word_application():
    import pythoncom
    configure_com_cache()
    from win32com.client import DispatchEx, gencache

    if threading.current_thread() is not threading.main_thread():
        raise RuntimeError("Run Word automation on the CLI main thread.")
    word = None
    try:
        word = DispatchEx("Word.Application")
        word = gencache.EnsureDispatch(word, bForDemand=False)
        word.Visible = False
        word.DisplayAlerts = 0
        word.AutomationSecurity = 3
        yield word
    finally:
        try:
            if word is not None:
                try:
                    for index in range(word.Documents.Count, 0, -1):
                        word.Documents.Item(index).Close(SaveChanges=0)
                finally:
                    word.Quit(SaveChanges=0)
        finally:
            # pythoncom owns the main thread's COM lifetime. CoUninitialize here
            # would disconnect other wrappers still in use by this process.
            word = None
            gc.collect()


@contextmanager
def opened_document(word, path, read_only=False):
    import pythoncom

    doc = word.Documents.Open(str(path), ConfirmConversions=False,
                              ReadOnly=read_only, AddToRecentFiles=False)
    try:
        yield doc
    finally:
        try:
            doc.Close(SaveChanges=0)
        except pythoncom.com_error as exc:
            warnings.warn(f"Document close failed; session cleanup will retry: {exc}")


def utf16_length(text):
    """Word Range offsets count UTF-16 code units, not Python code points."""
    return len(text.encode("utf-16-le")) // 2


def story_ranges(doc):
    """Include notes and headers; offsets only have meaning within one story."""
    for first in doc.StoryRanges:
        story = first
        while story is not None:
            yield story
            story = story.NextStoryRange


def find_text(doc, text):
    for story in story_ranges(doc):
        target = story.Duplicate
        target.Find.ClearFormatting()
        if target.Find.Execute(text, True, False, False, False, False, True, 0):
            return target
    raise ValueError(f"Generation marker missing: {text}")


def refresh(doc):
    """Resolve sequence fields before cross-references, then refresh TOC pages."""
    for _ in range(2):
        for story in story_ranges(doc):
            error = story.Fields.Update()
            if error:
                raise RuntimeError(f'Word field update failed at field {error}: {story.Fields.Item(error).Code.Text}')
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.Repaginate()
    for toc in doc.TablesOfContents:
        toc.UpdatePageNumbers()
