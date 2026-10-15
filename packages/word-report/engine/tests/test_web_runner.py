"""Lock ownership tests never create Word COM objects."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import uuid

from docreport.web_runner import claim_lock, release_lock, run


class WebRunnerTests(unittest.TestCase):
    def fixture(self, root):
        lock = root / 'out/.web-export.lock'
        lock.parent.mkdir()
        job = 'web-' + str(uuid.uuid4())
        lock.write_text(json.dumps(dict(id=job, pid=1234, ownerPid=1234, phase='starting')), encoding='utf-8')
        return lock, job

    def test_renderer_claim_retains_parent_and_releases_its_own_lock(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            lock, job = self.fixture(root)
            claim_lock(lock, job, root=root)
            owner = json.loads(lock.read_text(encoding='utf-8'))
            self.assertEqual(owner['rendererPid'], os.getpid())
            self.assertEqual(owner['pid'], os.getpid())
            self.assertEqual(owner['ownerPid'], 1234)
            self.assertEqual(owner['phase'], 'rendering')
            release_lock(lock, job)
            self.assertFalse(lock.exists())

    def test_claim_cannot_steal_other_job_or_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            lock, job = self.fixture(root)
            with self.assertRaises(ValueError):
                claim_lock(lock, 'web-' + str(uuid.uuid4()), root=root)
            with self.assertRaises(ValueError):
                claim_lock(root / 'another-lock', job, root=root)
            self.assertEqual(json.loads(lock.read_text(encoding='utf-8'))['phase'], 'starting')

    def test_release_cannot_delete_another_renderer_lock(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            lock, job = self.fixture(root)
            owner = dict(id=job, pid=2345, ownerPid=1234, rendererPid=2345, phase='rendering')
            lock.write_text(json.dumps(owner), encoding='utf-8')
            release_lock(lock, job)
            self.assertTrue(lock.exists())

    def test_build_failure_releases_after_renderer_cleanup_without_com(self):
        with patch('docreport.web_runner.require_environment'), patch('docreport.web_runner.claim_lock') as claim, patch('docreport.web_runner.build', side_effect=RuntimeError('failed before COM')), patch('docreport.web_runner.release_lock') as release:
            with self.assertRaisesRegex(RuntimeError, 'failed before COM'):
                run(Path('input'), Path('output'), Path('lock'), 'job')
            claim.assert_called_once()
            release.assert_called_once_with(Path('lock'), 'job')


if __name__ == '__main__':
    unittest.main()
