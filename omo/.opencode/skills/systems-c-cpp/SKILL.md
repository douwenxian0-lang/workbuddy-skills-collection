---
name: systems-c-cpp
description: Deliver C and C++ systems work across native toolchains, CMake, testing, performance, and constrained targets without hiding ABI or platform assumptions.
---

# Systems C Cpp

Use this pack for C and C++ systems work: native libraries, performance-sensitive services, device or firmware-adjacent code, build-toolchain work, cross-compilation, and interoperability with lower-level platform APIs. Defer first-pass route choice and lane selection to `.opencode/reference/routing-matrix.md`.

This is the general C and C++ family pack for the repo. Use the overlay in `reference/cmake-gtest-embedded.md` to tune decisions for target-based CMake, gtest or CTest, toolchains, and embedded-adjacent constraints while keeping ABI, memory, and performance choices visible.

## Core focus

- Design headers, translation units, ABI surfaces, and ownership boundaries so C and C++ code stays readable across toolchains.
- Keep build configuration, compiler flags, sanitizer use, and platform assumptions explicit instead of scattering them through scripts.
- Treat performance, memory layout, and allocation behavior as measurable system properties.
- Support cross-compiling, hardware-adjacent targets, and constrained environments with clear host-versus-target rules.
- Keep tests, benchmarks, and diagnostics close to the code that owns system behavior.

## Shared C and C++ standards

- Prefer target-based CMake over global compile or link state when rules differ by library, executable, or test target.
- Keep warnings, language standards, include paths, and preprocessor definitions visible at the target level.
- Separate portable core logic from platform or board-specific code and keep ABI boundaries narrow.
- Use gtest, CTest, sanitizers, and profiling together so correctness and runtime behavior are checked from more than one angle.
- Make allocation limits, threading assumptions, and error handling visible when the code may run under embedded constraints.

## Default workflow

1. Inspect the repository layout, compiler toolchain, target platforms, and build graph.
2. Choose the native-toolchain overlay in `reference/cmake-gtest-embedded.md`.
3. Define targets, ABI boundaries, memory constraints, and test strategy before broad implementation.
4. Implement source layout, build rules, tests, and performance checks together so host and target behavior stay aligned.
5. Run `review-work` after substantial C or C++ systems changes.

## Collaboration in this repo

- Use `Explore` before editing so new work matches local target layout, naming, and build conventions.
- Use `Librarian` or `Context7` when compiler, standard-library, or toolchain behavior needs a source-of-truth check.
- Use `review-work` when changes materially affect ABI stability, memory use, performance, or constrained-target behavior.

## Overlays

- `reference/cmake-gtest-embedded.md` for toolchains, cross-compiling, target-based CMake, gtest or CTest usage, and embedded-adjacent constraints.

## Guardrails

- Do not hide build assumptions in global flags or one-off scripts that make target behavior hard to trace.
- Do not let platform-specific headers, macros, or allocation rules leak across the whole codebase without a clear boundary.
- Do not assume desktop test results prove correctness on a constrained or cross-compiled target.
