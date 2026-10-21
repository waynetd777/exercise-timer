#!/usr/bin/env node
// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

/**
 * Retakes the README screenshots in docs/screenshots, in headless Chromium.
 *
 *   node capture.mjs               # every scene
 *   node capture.mjs run-timed     # scenes whose name matches
 *   node capture.mjs --out /tmp/x  # somewhere else, to review first
 *
 * Needs the dev server (`npm run dev` in the project root) and `cwebp`. Each
 * scene starts from an empty profile and imports the routines in src/routines,
 * so nothing from a real library is ever in a picture. The run screens use
 * Playwright's fake clock, so a countdown is caught at the same second every
 * time. The window's title bar and rounded corners are drawn on afterwards, the
 * way the earlier shots, taken from an installed app window, showed them.
 */
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const URL = process.env.APP_URL ?? 'http://localhost:35173/'
/** The window the earlier shots were taken in: a portrait tablet, about. */
const VIEWPORT = { width: 800, height: 1040 }
/** The README shows them at 420 wide; 900 is that at 2x, plus the shadow's margin. */
const OUT_WIDTH = 900

const argv = process.argv.slice(2)
const outFlag = argv.indexOf('--out')
const OUTDIR = outFlag >= 0 ? path.resolve(argv[outFlag + 1]) : path.join(ROOT, 'docs/screenshots')
const filters = argv.filter((a, i) => !a.startsWith('--') && !(outFlag >= 0 && i === outFlag + 1))

const ROUTINES = ['beginner-mixed-cardio-1.tabata.json', 'beginner-mixed-cardio-2.tabata.json'].map(
  (name) => path.join(ROOT, 'src/routines', name),
)

const MIXED_1 = 'Beginner Mixed Cardio & Full-Body Workout Routine 1'
const MIXED_2 = 'Beginner Mixed Cardio & Full-Body Workout Routine 2'

/** The paste format's own worked example, so the shot shows every line understood. */
const PASTED = fs
  .readFileSync(path.join(ROOT, 'docs/paste-format.md'), 'utf8')
  .match(/```\n([\s\S]*?)```/)[1]

/** Clicks the button whose accessible name or text matches. */
const press = (page, name) => page.getByRole('button', { name, exact: true }).first().click()

/** Starts a routine from the library and opens the run screen on its Ready card. */
async function open(page, routine) {
  await press(page, `Start ${routine}`)
  await page.waitForSelector('.run')
}

const SCENES = [
  {
    name: 'run-timed',
    async setup(page) {
      await open(page, MIXED_1)
      await press(page, 'Start')
      // Past the 15s get-ready and 17s into the ten-minute warm-up.
      await page.clock.runFor(32_000)
    },
  },
  {
    name: 'run-list',
    async setup(page) {
      await open(page, 'Strength Training')
      await press(page, 'Start')
      await page.clock.runFor(500)
      // Through the timed warm-up steps to the first ladder rung.
      for (let i = 0; i < 40 && !(await page.locator('.sheet__caption').count()); i++) {
        await press(page, 'Next step')
        await page.clock.runFor(200)
      }
      await press(page, 'Pause')
    },
  },
  {
    name: 'paste',
    async setup(page) {
      await press(page, 'Routines')
      await page.getByRole('menuitem', { name: 'Paste' }).click()
      const dialog = page.locator('dialog[open]')
      await dialog.locator('input').first().fill('Saturday circuit')
      await dialog.locator('textarea').fill(PASTED)
      // Filling leaves it scrolled to the end; the top is what reads as a routine.
      await dialog.locator('textarea').evaluate((box) => {
        box.setSelectionRange(0, 0)
        box.scrollTop = 0
      })
    },
  },
  {
    name: 'generator',
    async setup(page) {
      await press(page, 'Routines')
      await page.getByRole('menuitem', { name: 'Generate' }).click()
      await page.waitForSelector('dialog[open]')
    },
  },
  {
    name: 'library',
    async setup(page) {
      await page
        .locator('li', { hasText: MIXED_1 })
        .getByRole('button', { name: 'Add to favourites' })
        .first()
        .click()
    },
  },
  {
    name: 'preview',
    async setup(page) {
      await press(page, `Preview ${MIXED_2}`)
      await page.waitForSelector('.run')
    },
  },
  {
    name: 'editor',
    async setup(page) {
      await page
        .locator('li', { hasText: MIXED_2 })
        .getByRole('button', { name: 'Edit routine' })
        .first()
        .click()
      await page.waitForTimeout(500)
      // One row's controls open, to show what a step carries besides its name.
      await page
        .getByRole('button', { name: /^Controls for / })
        .nth(3)
        .click()
    },
  },
  {
    name: 'exercises',
    async setup(page) {
      await press(page, 'Routines')
      await page.getByRole('menuitem', { name: 'Exercises' }).click()
      await page.waitForTimeout(300)
      await page
        .getByRole('searchbox')
        .or(page.getByPlaceholder(/search/i))
        .first()
        .fill('crunch')
    },
  },
].filter((scene) => !filters.length || filters.some((f) => scene.name.includes(f)))

if (!SCENES.length) {
  console.error('no scenes matched')
  process.exit(1)
}

/** The window frame, drawn in a page of its own around the shot. */
function frame(png) {
  const src = `data:image/png;base64,${png.toString('base64')}`
  return `<!doctype html><html><body style="margin:0;background:transparent">
<div id="pad" style="display:inline-block;padding:48px">
<div style="border-radius:20px;overflow:hidden;
  box-shadow:0 0 0 1px #000a,0 20px 56px #0007;background:#1d1e21;font:500 22px -apple-system,system-ui">
  <div style="height:44px;display:flex;align-items:center;gap:14px;padding:0 20px;color:#c9c9cc;
    border-bottom:1px solid #0008;background:#26272b">
    <i style="width:18px;height:18px;border-radius:50%;background:#55565a"></i>
    <i style="width:18px;height:18px;border-radius:50%;background:#55565a"></i>
    <i style="width:18px;height:18px;border-radius:50%;background:#55565a"></i>
    <span style="margin-left:16px">Exercise Timer</span>
  </div>
  <img src="${src}" style="display:block;width:${VIEWPORT.width}px">
</div></div></body></html>`
}

fs.mkdirSync(OUTDIR, { recursive: true })
const browser = await chromium.launch()
let failed = 0

for (const scene of SCENES) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  try {
    await page.clock.install()
    await page.goto(URL)
    await page.clock.runFor(1000)
    await page.locator('input[type=file]').setInputFiles(ROUTINES)
    // "Imported 2", which has to be closed before anything else can be pressed.
    await page.locator('dialog[open]').getByRole('button', { name: /close/i }).click()
    await page.getByText(MIXED_2).first().waitFor()
    await scene.setup(page)
    await page.clock.runFor(600)
    // Animations and transitions finish on real time, not the fake clock.
    await page.waitForTimeout(700)
    const shot = await page.screenshot()

    const framer = await ctx.newPage()
    await framer.setViewportSize({ width: VIEWPORT.width + 200, height: VIEWPORT.height + 300 })
    await framer.setContent(frame(shot))
    await framer.waitForTimeout(100)
    const png = path.join(OUTDIR, `${scene.name}.png`)
    await framer.locator('#pad').screenshot({ path: png, omitBackground: true })
    const webp = path.join(OUTDIR, `${scene.name}.webp`)
    execFileSync(
      'cwebp',
      ['-resize', String(OUT_WIDTH), '0', '-q', '80', '-m', '6', png, '-o', webp],
      {
        stdio: 'ignore',
      },
    )
    console.log(`  ${path.relative(ROOT, webp)}`)
  } catch (error) {
    failed++
    console.error(`  ${scene.name}: ${error.message.split('\n')[0]}`)
  } finally {
    await ctx.close()
  }
}

await browser.close()
process.exit(failed ? 1 : 0)
