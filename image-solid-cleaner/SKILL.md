---
name: image-solid-cleaner
description: >
  Detect and delete solid-color or uniform-background images from directories.
  Use when cleaning up bulk downloaded images (WeChat articles, web scrapes)
  that contain UI dividers, placeholder backgrounds, pure-black filler images,
  or other non-content solid-color garbage. Supports dry-run mode for safe preview.
  Triggers: solid color cleanup, pure color removal, delete uniform backgrounds,
  clean WeChat images, remove dividers, bulk image cleaning.
---

# Image Solid Cleaner

Detects and removes solid-color/near-uniform images using PIL ImageStat with 128px thumbnail downscaling (no numpy, memory-safe).

## Usage

```bash
python scripts/solid_color_clean.py <root_directory>
python scripts/solid_color_clean.py <root_directory> --dry-run    # Preview only
python scripts/solid_color_clean.py <root_directory> --log out.txt
```

`root_directory` must contain subfolders, each with images. Scans `.jpg/.jpeg/.png/.webp/.gif`.

## Detection Categories

| Category | RGB Range | std Threshold | Typical Source |
|---|---|---|---|
| `white-divider` | all > 230 | < 30 | WeChat section dividers, white spacing bars |
| `pure-black` | all < 15 | < 15 | Placeholder/filler black images |
| `warm-yellow-bg` | R 200-220, G 175-195, B 138-155 | < 35 | WeChat article warm-tone backgrounds |
| `ultra-low-std` | any | < 10 | Any near-uniform solid color |

## Key Design Decisions

- **ImageStat + thumbnail** instead of numpy: avoids OOM on large image sets (tested: 18,897 images stable)
- **std thresholds account for JPEG compression** (adds ~15 noise to truly solid colors)
- **Streaming deletion**: writes log immediately, no result accumulation in memory
- Deletion log saved to `solid_color_delete_log.txt` next to `root_directory`

## Post-Cleanup

After running this tool, run a size-based scan to catch remaining UI icons:

```python
# Delete images < 5KB (likely UI icons/garbage)
for f in glob('**/*.jpg', recursive=True):
    if os.path.getsize(f) < 5120:
        os.remove(f)
```
