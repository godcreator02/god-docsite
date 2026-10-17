"""Own isolated Word sessions and finalize native Word documents."""
from contextlib import contextmanager
import gc
import threading
import warnings


@contextmanager
def word_application():
    import pythoncom
    from win32com.client import DispatchEx

    if threading.current_thread() is not threading.main_thread():
        raise RuntimeError("Run Word automation on the CLI main thread.")
    word = None
    try:
        word = DispatchEx("Word.Application")
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


def refresh(doc):
    """Resolve sequence fields before cross-references, then refresh TOC pages."""
    doc.Fields.Update()
    doc.Fields.Update()
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.Repaginate()
    for toc in doc.TablesOfContents:
        toc.UpdatePageNumbers()
