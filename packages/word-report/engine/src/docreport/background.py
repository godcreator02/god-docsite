"""Pause Word's background work while the draft is composed, and give the user's Word options back afterwards.

Word writes some of these options to the user's settings the moment they change (spelling checks reach every
other Word at once), so the user's own values stay on disk until every export that turned them off has finished.
An export that is killed leaves its process id there; the next export finds no live process and restores them.
"""
from contextlib import contextmanager
import ctypes
import json
import os
from pathlib import Path

BACKGROUND_OPTIONS = ('Pagination', 'CheckSpellingAsYouType', 'CheckGrammarAsYouType')
DRAFT_VIEW = 1


def default_state_path():
    return Path(os.environ['LOCALAPPDATA']) / 'word-report' / 'word-options.json'


def process_running(pid):
    query_limited_information, still_active = 0x1000, 259
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(query_limited_information, False, pid)
    if not handle:
        return False
    try:
        code = ctypes.c_ulong()
        return bool(kernel32.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == still_active
    finally:
        kernel32.CloseHandle(handle)


def read_state(path):
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else None


def write_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def set_options(word, values):
    options = word.Options
    for name, value in values.items():
        setattr(options, name, value)


def claim_user_options(word, path, record, running):
    """Return the user's own values and register this process among the exports that changed them."""
    state = read_state(path)
    if state is None:
        state = dict(options={name: bool(getattr(word.Options, name)) for name in BACKGROUND_OPTIONS}, owners=[])
    else:
        state['owners'] = [owner for owner in state['owners'] if running(owner)]
        if not state['owners']:
            set_options(word, state['options'])
            record('word-options-restored', options=state['options'])
    state['owners'].append(os.getpid())
    write_state(path, state)
    return state['options']


def release_user_options(word, path, user_options, running):
    set_options(word, user_options)
    state = read_state(path)
    if state is None:
        raise RuntimeError(f'{path} disappeared while this export had Word options turned off; '
                           f'the user values were {user_options}.')
    owners = [owner for owner in state['owners'] if owner != os.getpid() and running(owner)]
    if owners:
        write_state(path, dict(state, owners=owners))
    else:
        path.unlink()


@contextmanager
def background_paused(word, doc, record, path=None, running=process_running):
    """Composing a long draft is about a quarter faster with screen updates, background pagination,
    spelling and grammar checks off and the window in draft view; the saved document is the same."""
    path = path or default_state_path()
    view = doc.Windows.Item(1).View
    view_type, screen_updating = view.Type, word.ScreenUpdating
    user_options = claim_user_options(word, path, record, running)
    try:
        set_options(word, dict.fromkeys(BACKGROUND_OPTIONS, False))
        word.ScreenUpdating = False
        view.Type = DRAFT_VIEW
        yield
    finally:
        view.Type = view_type
        word.ScreenUpdating = screen_updating
        release_user_options(word, path, user_options, running)
