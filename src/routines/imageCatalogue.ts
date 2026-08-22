/**
 * Exercise illustrations available to every routine.
 *
 * Served from the app's OWN origin: each entry is a path under `public/`, which
 * `resolvePlan` turns into `${BASE_URL}${path}` at render time. Keeping the path
 * relative and applying the base late is what lets one routine work on a root
 * domain, on a subpath host like `/exercise-timer/`, and inside an export opened
 * on another device. An absolute URL in every step would pin the routine to one
 * host forever.
 *
 * They were 27 postimages links until 2026-08-21. That worked, but it made the
 * app depend on a third party for the pictures, needed a manual
 * screenshot-and-upload for every addition, and left a routine one dead host away
 * from having no illustrations. The whole set is now generated from the Torus
 * guide by `scripts/exercise_plates.py` and precached by the service worker, so
 * it is reproducible and offline by default. `MediaRef`'s `remote` source stays
 * for links pasted by hand, and `local` for uploaded photos.
 *
 * Order and grouping follow Wayne's "Fitness. Workouts" note, which was the
 * original master list; group 8 is everything else the guide illustrates, which
 * the note never included.
 *
 * Only paths are stored: labels come from the filename via `labelFromUrl()`, so
 * there is nothing to keep in sync. Two of the note's 29 URLs were duplicates, a
 * second Tricep Press and a second Standing Arm Curl, verified as re-uploads of
 * the same photograph, and are not offered twice here. `storage/migrate.ts` maps
 * all 29 of the old URLs onto these paths, so a routine saved when they were
 * links keeps its picture.
 */
export const IMAGE_CATALOGUE: readonly string[] = [
  // group 1
  'exercises/Cable-Fly.jpg',
  'exercises/Decline-Chest-Press.jpg',
  'exercises/Seated-Abdominal-Crunch.jpg',
  'exercises/Standard-Chest-Press.jpg',
  'exercises/Tricep-Dips.jpg',
  'exercises/Triceps-Press.jpg',
  // group 2
  'exercises/Cable-Converging-Shoulder-Press.jpg',
  'exercises/Lat-Pulldown.jpg',
  'exercises/Leg-Press.jpg',
  'exercises/Seated-Row.jpg',
  'exercises/Standing-Arm-Curl.jpg',
  // group 3
  'exercises/Cable-Lateral-Shoulder-Raise.jpg',
  'exercises/Seated-Cable-Row.jpg',
  'exercises/Incline-Chest-Press.jpg',
  // group 4
  'exercises/Calf-Press.jpg',
  'exercises/Deadlift.jpg',
  'exercises/Free-Standing-Hamstring-Curl.jpg',
  'exercises/Glute-Kickback.jpg',
  'exercises/Seated-Leg-Extension.jpg',
  'exercises/Standing-Leg-Curl.jpg',
  'exercises/Standing-Leg-Extension.jpg',
  'exercises/Toe-Raise.jpg',
  // group 5: the cardio machine, which is not part of the Torus guide
  'exercises/horizon-5-0-r-recumbent-bike.jpg',
  'exercises/Cycling.jpg',
  // group 6
  'exercises/Standing-Shoulder-Press.jpg',
  // group 7
  'exercises/Hip-Abductor-Leg-Raise.jpg',
  'exercises/Side-Cable-Bends.jpg',
  // group 8: the rest of the guide's 41 stations, added with the rehosting
  'exercises/Abdominal-Oblique-Crunch.jpg',
  'exercises/Bentover-Row.jpg',
  'exercises/Cable-Converging-Chest-Press.jpg',
  'exercises/Deltoid-Upright-Row.jpg',
  'exercises/Dynamic-Cable-Fly.jpg',
  'exercises/Dynamic-Cable-Rear-Delt-Fly.jpg',
  'exercises/Front-Shoulder-Raise.jpg',
  'exercises/Hip-Adductor-Leg-Raise.jpg',
  'exercises/Incline-Cable-Converging-Chest-Press.jpg',
  'exercises/Knee-Raise.jpg',
  'exercises/Lower-Back-Extension.jpg',
  'exercises/Rear-Cable-Fly.jpg',
  'exercises/Reverse-Curl.jpg',
  'exercises/Seated-Cable-Arm-Curl.jpg',
  'exercises/Seated-Cable-Tricep-Overhead-Extension.jpg',
  'exercises/Shoulder-Shrugs.jpg',
]
