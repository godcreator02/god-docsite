"""Own an isolated Word COM session. No PowerShell subprocess or DOCX writer."""
from contextlib import contextmanager
import gc
import sys
import threading
import warnings

if sys.platform != 'win32':
    raise RuntimeError('Word COM requires Windows and desktop Microsoft Word.')

try:
    import pythoncom
    from win32com.client import DispatchEx
except ImportError as exc:
    raise RuntimeError(r'Install dependencies: .venv\Scripts\python.exe -m pip install -r requirements.txt') from exc


@contextmanager
def word_application():
    """DispatchEx creates our session; never attach to or kill an existing Word."""
    # pythoncom initializes the main thread and owns its process-level lifetime.
    # Uninitializing COM per Word instance disconnects other live COM wrappers.
    if threading.current_thread() is not threading.main_thread():
        raise RuntimeError('Run Word automation on the CLI main thread.')
    word = None
    try:
        word = DispatchEx('Word.Application')
        word.Visible = False
        word.DisplayAlerts = 0
        word.AutomationSecurity = 3
        yield word
    finally:
        try:
            if word is not None:
                # Includes partially created documents when a builder raises.
                try:
                    for index in range(word.Documents.Count, 0, -1):
                        word.Documents.Item(index).Close(SaveChanges=0)
                finally:
                    word.Quit(SaveChanges=0)
        finally:
            word = None
            gc.collect()


@contextmanager
def opened_document(word, path, read_only=False):
    doc = word.Documents.Open(str(path), ConfirmConversions=False,
                              ReadOnly=read_only, AddToRecentFiles=False)
    try:
        yield doc
    finally:
        try:
            doc.Close(SaveChanges=0)
        except pythoncom.com_error as exc:
            warnings.warn(f'Document close failed; session cleanup will retry: {exc}')


def utf16_length(text):
    """Word Range offsets count UTF-16 code units, unlike Python len()."""
    return len(text.encode('utf-16-le')) // 2
