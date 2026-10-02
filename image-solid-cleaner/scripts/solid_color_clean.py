# -*- coding: utf-8 -*-
"""Detect and delete solid-color/near-uniform images from directories.

Uses PIL ImageStat with 128px thumbnail for memory efficiency (no numpy).
Supports 4 detection categories with configurable thresholds.

Usage:
  python solid_color_clean.py <root_directory>
  python solid_color_clean.py <root_directory> --dry-run    # Report only, no deletion
  python solid_color_clean.py <root_directory> --log <path> # Custom log path

Detection categories:
  warm-yellow-bg  - R 200-220, G 175-195, B 138-155, avg_std < 35
  white-divider   - All channels > 230, avg_std < 30
  pure-black      - All channels < 15, avg_std < 15
  ultra-low-std   - avg_std < 10 (catch-all for any uniform color)
"""
import os, sys, argparse
from PIL import Image, ImageStat


def analyze_image(filepath):
    """Return (is_solid, reason_string) for an image file."""
    try:
        with Image.open(filepath) as img:
            w, h = img.size
            orig_w, orig_h = w, h
            # Downscale to max 128px for fast stats
            if w > 128 or h > 128:
                ratio = min(128 / w, 128 / h)
                img_small = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
            else:
                img_small = img.copy()

            if img_small.mode not in ('RGB', 'L'):
                img_small = img_small.convert('RGB')

            stat = ImageStat.Stat(img_small)
            mean = stat.mean
            stddev = stat.stddev

            r, g, b = mean[0], mean[1], mean[2]
            sr, sg, sb = stddev[0], stddev[1], stddev[2]
            avg_std = (sr + sg + sb) / 3.0

        # Warm yellow-brown solid bg
        if 200 < r < 220 and 175 < g < 195 and 138 < b < 155 and avg_std < 35:
            return True, f'warm-yellow-bg {orig_w}x{orig_h} std={avg_std:.1f} RGB=({r:.0f},{g:.0f},{b:.0f})'

        # White/gray divider
        if r > 230 and g > 230 and b > 230 and avg_std < 30:
            return True, f'white-divider {orig_w}x{orig_h} std={avg_std:.1f}'

        # Pure black
        if r < 15 and g < 15 and b < 15 and avg_std < 15:
            return True, f'pure-black {orig_w}x{orig_h} std={avg_std:.1f}'

        # Ultra-low std
        if avg_std < 10:
            return True, f'ultra-low-std {orig_w}x{orig_h} std={avg_std:.1f} RGB=({r:.0f},{g:.0f},{b:.0f})'

        return False, None

    except Exception as e:
        return None, f'[ERR] {e}'


def scan_and_clean(root_dir, dry_run=False, log_path=None):
    """Scan all image files under root_dir, delete solid-color ones."""
    if log_path is None:
        log_path = os.path.join(os.path.dirname(root_dir) or '.', 'solid_color_delete_log.txt')

    folders = sorted([d for d in os.listdir(root_dir)
                      if os.path.isdir(os.path.join(root_dir, d))])
    print(f'Folders: {len(folders)}')
    prefix = '[DRY RUN] ' if dry_run else ''

    total_images = 0
    total_deleted = 0
    errors = 0
    folder_stats = {}

    with open(log_path, 'w', encoding='utf-8') as log:
        log.write(f'Solid-color deletion log ({prefix.strip()})\n{"=" * 60}\n\n')

        for i, folder in enumerate(folders):
            fpath = os.path.join(root_dir, folder)
            try:
                images = [f for f in os.listdir(fpath)
                          if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif'))]
            except Exception:
                continue

            total_images += len(images)
            folder_deleted = 0

            for fname in images:
                full = os.path.join(fpath, fname)
                is_solid, reason = analyze_image(full)

                if is_solid is None:  # error
                    errors += 1
                    log.write(f'{reason} {folder}/{fname}\n')
                elif is_solid:
                    if not dry_run:
                        os.remove(full)
                    total_deleted += 1
                    folder_deleted += 1
                    log.write(f'{folder}/{fname}  {reason}\n')

            if folder_deleted > 0:
                folder_stats[folder] = folder_deleted

            if (i + 1) % 100 == 0:
                print(f'  [{i+1}/{len(folders)}] scanned {total_images}, '
                      f'{prefix}deleted {total_deleted}, errors {errors}')
                log.flush()

        log.write(f'\n{"=" * 60}\n')
        log.write(f'SUMMARY: {prefix}{total_deleted} deleted from {len(folder_stats)}/{len(folders)} folders\n')
        log.write(f'Total images scanned: {total_images}, errors: {errors}\n')

    print(f'\n=== DONE ===')
    print(f'Scanned: {total_images} images across {len(folders)} folders')
    print(f'{prefix}Deleted: {total_deleted} solid-color images from {len(folder_stats)} folders')
    print(f'Errors: {errors}')
    print(f'Log: {log_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Detect and delete solid-color images')
    parser.add_argument('root_dir', help='Root directory containing image folders')
    parser.add_argument('--dry-run', action='store_true', help='Report only, do not delete')
    parser.add_argument('--log', help='Custom log file path')
    args = parser.parse_args()

    scan_and_clean(args.root_dir, dry_run=args.dry_run, log_path=args.log)
