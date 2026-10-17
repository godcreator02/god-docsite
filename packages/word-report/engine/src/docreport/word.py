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


class MarkerFinder:
    """Find generation markers written in body order without rescanning from the top each time.

    The body story is searched from the previous body hit; a marker not found there
    (notes, headers, or out of order) falls back to the full search of every story.
    """

    MAIN_STORY = 1

    def __init__(self, doc):
        self.doc = doc
        self.position = 0

    def find(self, text):
        target = self.doc.Range(self.position, self.doc.Content.End)
        target.Find.ClearFormatting()
        if not target.Find.Execute(text, True, False, False, False, False, True, 0):
            target = find_text(self.doc, text)
        if target.StoryType == self.MAIN_STORY:
            self.position = target.Start
        return target


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
