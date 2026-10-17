r"""Word's background work paused while composing. Run with .venv\Scripts\python.exe -m unittest discover -s tests -v."""
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from docreport.background import BACKGROUND_OPTIONS, DRAFT_VIEW, background_paused

USER_VALUES = dict.fromkeys(BACKGROUND_OPTIONS, True)
OTHER_EXPORT = 4242


def fake_word(**options):
    view = SimpleNamespace(Type=3)
    doc = SimpleNamespace(Windows=SimpleNamespace(Item=lambda index: SimpleNamespace(View=view)))
    word = SimpleNamespace(Options=SimpleNamespace(**{**USER_VALUES, **options}), ScreenUpdating=True)
    return word, doc, view


def current_options(word):
    return {name: getattr(word.Options, name) for name in BACKGROUND_OPTIONS}


class BackgroundPausedTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary.name) / 'word-report' / 'word-options.json'
        self.events = []

    def tearDown(self):
        self.temporary.cleanup()

    def record(self, event, **values):
        self.events.append((event, values))

    def write_state(self, owners):
        self.path.parent.mkdir(parents=True)
        self.path.write_text(json.dumps(dict(options=USER_VALUES, owners=owners)), encoding='utf-8')

    def test_paused_while_composing_and_given_back(self):
        word, doc, view = fake_word()
        with background_paused(word, doc, self.record, self.path, running=lambda pid: pid == os.getpid()):
            self.assertEqual(current_options(word), dict.fromkeys(BACKGROUND_OPTIONS, False))
            self.assertFalse(word.ScreenUpdating)
            self.assertEqual(view.Type, DRAFT_VIEW)
            self.assertEqual(json.loads(self.path.read_text(encoding='utf-8')), dict(options=USER_VALUES, owners=[os.getpid()]))
        self.assertEqual(current_options(word), USER_VALUES)
        self.assertTrue(word.ScreenUpdating)
        self.assertEqual(view.Type, 3)
        self.assertFalse(self.path.exists())
        self.assertEqual(self.events, [])

    def test_given_back_when_composing_fails(self):
        word, doc, view = fake_word()
        with self.assertRaises(ValueError):
            with background_paused(word, doc, self.record, self.path, running=lambda pid: True):
                raise ValueError('compose failed')
        self.assertEqual(current_options(word), USER_VALUES)
        self.assertEqual(view.Type, 3)
        self.assertFalse(self.path.exists())

    def test_values_left_by_a_killed_export_restored_first(self):
        self.write_state([OTHER_EXPORT])
        word, doc, _ = fake_word(**dict.fromkeys(BACKGROUND_OPTIONS, False))
        with background_paused(word, doc, self.record, self.path, running=lambda pid: pid == os.getpid()):
            pass
        self.assertEqual(self.events, [('word-options-restored', dict(options=USER_VALUES))])
        self.assertEqual(current_options(word), USER_VALUES)
        self.assertFalse(self.path.exists())

    def test_running_export_keeps_the_user_values_and_the_file(self):
        self.write_state([OTHER_EXPORT])
        word, doc, _ = fake_word(CheckSpellingAsYouType=False)
        with background_paused(word, doc, self.record, self.path, running=lambda pid: True):
            pass
        self.assertEqual(self.events, [])
        self.assertEqual(current_options(word), USER_VALUES)
        self.assertEqual(json.loads(self.path.read_text(encoding='utf-8'))['owners'], [OTHER_EXPORT])
