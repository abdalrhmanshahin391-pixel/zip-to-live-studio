# Restore your chosen homepage images

## What I confirmed
- Your three saved replacements—the first homepage picture, Plans, and Toolkit—still exist. They have not been deleted.
- The current image-read rule calls an admin-check function that signed-out visitors cannot execute. This is a permission conflict introduced by the security restrictions; the failed request still needs to be reproduced to confirm the exact failure.
- The homepage silently uses its old built-in artwork when replacement images cannot be loaded.

## Plan
1. Reproduce replacement-image loading for visitors and signed-in users, checking all homepage pictures rather than only the first one.
2. Recover the exact saved replacement files, including your chosen first picture with the green background—do not generate or substitute new artwork.
3. Serve these intentionally public homepage pictures through the site's public asset delivery, with stable URLs. Update the saved selections and matching built-in fallbacks to the same recovered images so a delayed settings request cannot bring back the old artwork.
4. Preserve private storage restrictions, profile protections, and restricted database helpers. Do not reopen private buckets or restore image-edit mode.
5. Verify all homepage pictures load correctly after a fresh visit and reload, including signed-out access. Check that the hero preload uses the restored first image.

## Technical details
- Reproduce and inspect settings and signed-image requests before implementation.
- Export only the three explicitly published files referenced by `site_images` into managed public assets; keep the private originals intact.
- Update those saved image references and the corresponding homepage fallback imports, ensuring server and browser image resolution agree.
- Verify the remaining homepage images against their existing saved references; preserve unchanged artwork and layout.

## Result
Your selected pictures return without undoing the security fixes or changing the homepage design.
