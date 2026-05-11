# CMake, gtest, and embedded overlay for `systems-c-cpp`

Use this overlay when the C or C++ task is shaped by toolchain selection, cross-compiling, target-based CMake, gtest or CTest, or embedded-adjacent resource constraints.

## Reach for this overlay when

- the build already depends on CMake toolchain files or host-versus-target separation,
- gtest, CTest, or emulator-backed test execution is part of the delivery path,
- memory, startup, binary size, or hardware access constraints materially shape implementation choices.

## Working rules

- Model compile options, include paths, definitions, and link dependencies on targets instead of relying on global CMake state.
- Keep cross-compiling rules in toolchain files and make host tools, generated sources, and target binaries visibly separate.
- Use gtest and CTest for repeatable host-side validation, and pair them with on-target, emulator, or hardware-aware checks where behavior can diverge.
- Make allocator choices, exceptions or RTTI policy, stack limits, and startup assumptions explicit when the target is constrained.
- Document linker scripts, startup code, and hardware-facing seams wherever they affect correctness or performance.

## Watchouts

- Avoid global compiler flags that quietly change behavior for every target.
- Avoid assuming host tests cover timing, memory, or peripheral behavior on the actual target.
- Avoid burying embedded constraints behind desktop-friendly abstractions that allocate too much or mask hardware assumptions.
