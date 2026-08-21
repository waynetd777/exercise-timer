/**
 * Exercise illustrations available to every routine.
 *
 * Taken from Wayne's "Fitness. Workouts" note, which is the master list, and
 * kept in its original order and grouping.
 *
 * Only URLs are stored: labels are derived from the filename by
 * `labelFromUrl()`, so there is nothing to keep in sync.
 *
 * 27 of the note's 29 URLs are here. Two were dropped as duplicates: a second
 * Tricep Press and a second Standing Arm Curl, each a re-upload of the image
 * already listed. This file previously claimed they were genuinely different
 * images — they are not, and the claim was never checked. Fetched and compared:
 * after aligning for a 1px crop difference they differ by 1.8/255 and 3.3/255
 * mean, where two genuinely different plates in this set differ by 16.6/255, and
 * both pairs are visibly the same photograph and station number.
 *
 * The dropped URLs still work; they are simply not offered twice in the picker.
 * A routine that already references one keeps loading it, since steps store a URL
 * rather than a catalogue index.
 */
export const IMAGE_CATALOGUE: readonly string[] = [
  // group 1
  'https://i.postimg.cc/KvY7cdKk/Cable-Fly.png',
  'https://i.postimg.cc/gJqyrpqR/Decline-Chest-Press.png',
  'https://i.postimg.cc/Znb8dQVQ/Seated-Ab-Crunch.png',
  'https://i.postimg.cc/fy8xjvPR/Standard-Chest-Press.png',
  'https://i.postimg.cc/xCSy08Hn/Tricep-Dip.png',
  'https://i.postimg.cc/9FxpGW3Y/Tricep-Press.png',
  // group 2
  'https://i.postimg.cc/SxXDbQ0P/Cable-Converging-Shoulder-Press.png',
  'https://i.postimg.cc/0yLZkgPy/Lat-Pulldown.png',
  'https://i.postimg.cc/TPg0hk3q/Leg-Press.png',
  'https://i.postimg.cc/sXzcWpBF/Seated-Row.png',
  'https://i.postimg.cc/4d11QmtY/Standing-Arm-Curl.png',
  // group 3
  'https://i.postimg.cc/tgRC2Nrd/Cable-Lateral-Shoulder-Raise.png',
  'https://i.postimg.cc/rphybRbB/Cable-Row.png',
  'https://i.postimg.cc/C1XhMTwJ/Incline-Chest-Press.png',
  // group 4
  'https://i.postimg.cc/kgwmsjjn/Calf-Press.png',
  'https://i.postimg.cc/VvyQv2NF/Deadlift.png',
  'https://i.postimg.cc/7LWy858d/Free-Standing-Hamstring-Curl.png',
  'https://i.postimg.cc/d1ZcqJJ1/Glute-Kickback.png',
  'https://i.postimg.cc/0jpgwZM1/Seated-Leg-Extension.png',
  'https://i.postimg.cc/PfZn9f6V/Standing-Leg-Curl.png',
  'https://i.postimg.cc/8PSgS89p/Standing-Leg-Extension.png',
  'https://i.postimg.cc/3rSS6RxS/Toe-Raise.png',
  // group 5
  'https://i.postimg.cc/j56Gq1nB/horizon-5-0-r-recumbent-bike.jpg',
  'https://i.postimg.cc/0yFGWd24/Cycling.png',
  // group 6
  'https://i.postimg.cc/Y9c6xc3V/Standing-Shoulder-Press.png',
  // group 7
  'https://i.postimg.cc/8PpNPvH2/Hip-Abductor-Leg-Raise.png',
  'https://i.postimg.cc/Dwmh1KR5/Side-Cable-Bends.png',
]
