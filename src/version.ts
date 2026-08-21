/**
 * What the home screen shows beside the help button.
 *
 * **Bump this on every build you intend to test.** It exists for one reason: an
 * installed PWA is served by a service worker, so "did my change actually reach
 * the phone" is otherwise unanswerable — you end up debugging a layout that was
 * fixed two deploys ago. If the badge does not change, the build did not land.
 *
 * The date is stamped by the build, so two builds on the same version are still
 * distinguishable; the number is what you read out loud.
 */
export const APP_VERSION = '1.1'
