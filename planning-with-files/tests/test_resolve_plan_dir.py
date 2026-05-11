"""Tests for scripts/resolve-plan-dir.sh — addresses #148.

Resolver order:
  1. $PLAN_ID env → .planning/<id>/ if exists
  2. .planning/.active_plan content → .planning/<id>/ if exists
  3. Newest .planning/<dir>/ by mtime
  4. Legacy fallback: <cwd>/task_plan.md exists → emit empty (caller uses cwd)
  5. Otherwise empty stdout, exit 0
"""
from __future__ import annotations

import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RESOLVE_SH = REPO_ROOT / "scripts" / "resolve-plan-dir.sh"


class ResolvePlanDirTests(unittest.TestCase):
    def run_resolver(self, cwd: Path, plan_id: str | None = None) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env.pop("PLAN_ID", None)
        if plan_id is not None:
            env["PLAN_ID"] = plan_id
        return subprocess.run(
            ["sh", str(RESOLVE_SH)],
            cwd=str(cwd),
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )

    def test_resolver_script_exists(self) -> None:
        self.assertTrue(RESOLVE_SH.exists(), "scripts/resolve-plan-dir.sh missing")

    def test_empty_repo_returns_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = self.run_resolver(Path(tmp))
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual("", result.stdout.strip())

    def test_env_plan_id_takes_precedence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".planning" / "alpha").mkdir(parents=True)
            (root / ".planning" / "beta").mkdir(parents=True)
            (root / ".planning" / ".active_plan").write_text("beta\n", encoding="utf-8")
            result = self.run_resolver(root, plan_id="alpha")
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(result.stdout.strip().endswith("alpha"))

    def test_active_plan_used_when_env_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".planning" / "alpha").mkdir(parents=True)
            (root / ".planning" / "beta").mkdir(parents=True)
            (root / ".planning" / ".active_plan").write_text("beta\n", encoding="utf-8")
            result = self.run_resolver(root)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(result.stdout.strip().endswith("beta"))

    def test_falls_back_to_newest_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = root / ".planning" / "older"
            new = root / ".planning" / "newer"
            old.mkdir(parents=True)
            (old / "task_plan.md").write_text("# old\n", encoding="utf-8")
            time.sleep(0.05)
            new.mkdir(parents=True)
            (new / "task_plan.md").write_text("# new\n", encoding="utf-8")
            # bump mtime explicitly to be safe across filesystems
            os.utime(new, None)
            result = self.run_resolver(root)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(
                result.stdout.strip().endswith("newer"),
                f"expected newer, got {result.stdout!r}",
            )

    def test_legacy_root_plan_emits_empty(self) -> None:
        # When no .planning/ but cwd/task_plan.md exists, resolver emits empty so
        # callers fall back to the legacy root path. This preserves v1.x users.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "task_plan.md").write_text("# legacy\n", encoding="utf-8")
            result = self.run_resolver(root)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual("", result.stdout.strip())

    def test_env_plan_id_pointing_to_missing_dir_falls_through(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            real = root / ".planning" / "real"
            real.mkdir(parents=True)
            (real / "task_plan.md").write_text("# real plan\n", encoding="utf-8")
            result = self.run_resolver(root, plan_id="ghost")
            self.assertEqual(0, result.returncode, result.stderr)
            # Should fall through to newest existing plan dir
            self.assertTrue(result.stdout.strip().endswith("real"))


if __name__ == "__main__":
    unittest.main()
