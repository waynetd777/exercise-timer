# Screenshots

Retakes the README screenshots in [`docs/screenshots`](../../docs/screenshots) by driving the dev server in headless Chromium.

```bash
cd tools/screenshots
npm install
npx playwright install --only-shell chromium   # first run only

# with `npm run dev` running in the project root
node capture.mjs                  # every scene
node capture.mjs run-timed        # scenes whose name matches
node capture.mjs --out /tmp/shots # somewhere else, to review first
```

Needs `cwebp` on the path. Set `APP_URL` if the dev server is not on port 35173.

Each scene starts from an empty browser profile and imports the mixed-cardio routines from `src/routines`, so no real library ever appears in a picture. The run screens use Playwright's fake clock, so a countdown is caught at the same second every run. The window frame is drawn on afterwards, to match the earlier shots taken from an installed app window.

A scene is a name and a `setup(page)` in `capture.mjs`. The PNG lands beside the `.webp` and is gitignored.
