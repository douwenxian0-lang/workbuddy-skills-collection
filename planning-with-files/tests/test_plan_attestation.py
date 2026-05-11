"""Regression tests for the plan-attestation flow (v2.37.0).

Verifies the attest-plan.sh helper:
  - Computes a SHA-256 of task_plan.md and stores it.
  - --show prints the stored hash.
  - --clear removes the attestation file.
  - Detects tampering (file change after attest -> stored hash != fresh hash).
  - Resolves parallel plans (.planning/<slug>/task_plan.md) ahead of legacy.

Skipped on platforms without sh in PATH (the helper is POSIX shell).
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "scripts" / "attest-plan.sh"
RESOLVER = REPO_ROOT / "scripts" / "resolve-plan-dir.sh"


def have_sh() -> bool:
    return shutil.which("sh") is not None


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@unittest.skipUnless(have_sh(), "sh not available on this platform")
class PlanAttestationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="pwf-attest-"))
        # Copy resolver next to attest-plan so the helper can find it.
        self.scripts_dir = self.tmp / "scripts"
        self.scripts_dir.mkdir()
        shutil.copy2(SCRIPT, self.scripts_dir / "attest-plan.sh")
        shutil.copy2(RESOLVER, self.scripts_dir / "resolve-plan-dir.sh")
        os.chmod(self.scripts_dir / "attest-plan.sh", 0o755)
        os.chmod(self.scripts_dir / "resolve-plan-dir.sh", 0o755)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["sh", str(self.scripts_dir / "attest-plan.sh"), *args],
            cwd=str(self.tmp),
            text=True,
            capture_output=True,
            check=False,
        )

    def test_legacy_attest_writes_root_attestation(self) -> None:
        plan = self.tmp / "task_plan.md"
        plan.write_text("# Plan v1\nphase 1\n", encoding="utf-8")

        result = self._run()
        self.assertEqual(0, result.returncode, result.stderr)

        attest = self.tmp / ".plan-attestation"
        self.assertTrue(attest.exists(), "expected .plan-attestation at project root")
        self.assertEqual(sha256_of(plan), attest.read_text().strip())

    def test_show_prints_stored_hash(self) -> None:
        plan = self.tmp / "task_plan.md"
        plan.write_text("content", encoding="utf-8")
        self._run()

        result = self._run("--show")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn(sha256_of(plan), result.stdout)

    def test_clear_removes_attestation(self) -> None:
        plan = self.tmp / "task_plan.md"
        plan.write_text("content", encoding="utf-8")
        self._run()
        self.assertTrue((self.tmp / ".plan-attestation").exists())

        result = self._run("--clear")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse((self.tmp / ".plan-attestation").exists())

    def test_tamper_changes_hash(self) -> None:
        plan = self.tmp / "task_plan.md"
        plan.write_text("approved content\n", encoding="utf-8")
        self._run()
        attested = (self.tmp / ".plan-attestation").read_text().strip()

        plan.write_text("approved content\nsneaky injection\n", encoding="utf-8")
        fresh = sha256_of(plan)

        self.assertNotEqual(
            attested,
            fresh,
            "hash must differ after tampering for the hook gate to fire",
        )

    def test_parallel_plan_attest_writes_into_plan_dir(self) -> None:
        plan_dir = self.tmp / ".planning" / "2026-05-05-feature-x"
        plan_dir.mkdir(parents=True)
        (plan_dir / "task_plan.md").write_text("phase A\n", encoding="utf-8")
        (self.tmp / ".planning" / ".active_plan").write_text(
            "2026-05-05-feature-x", encoding="utf-8"
        )

        result = self._run()
        self.assertEqual(0, result.returncode, result.stderr)

        attest = plan_dir / ".attestation"
        self.assertTrue(attest.exists(), "expected attestation inside the plan dir")
        self.assertFalse(
            (self.tmp / ".plan-attestation").exists(),
            "must not write the legacy file when an active plan dir exists",
        )

    def test_no_plan_exits_nonzero(self) -> None:
        result = self._run()
        self.assertNotEqual(0, result.returncode)


if __name__ == "__main__":
    unittest.main()
