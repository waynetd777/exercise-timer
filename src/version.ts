/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * What the home screen shows beside the help button.
 *
 * **Bump this on every build you intend to test.** It exists for one reason: an
 * installed PWA is served by a service worker, so "did my change actually reach
 * the phone" is otherwise unanswerable. You end up debugging a layout that was
 * fixed two deploys ago. If the badge does not change, the build did not land.
 *
 * The date is stamped by the build, so two builds on the same version are still
 * distinguishable; the number is what you read out loud.
 */
export const APP_VERSION = '7.4'
