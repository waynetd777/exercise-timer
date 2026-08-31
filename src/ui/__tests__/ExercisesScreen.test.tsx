/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { loadWeights, saveWeights, weightFor, withWeight } from '../../storage/weights'
import { loadPictures, pictureFor, savePictures, withPicture } from '../../storage/pictures'
import {
  addCustom,
  loadCustomExercises,
  saveCustomExercises,
} from '../../storage/customExercises'
import { loadPaces, savePaces } from '../../storage/paces'
import { sweepOrphans } from '../../storage/sweep'
import { collectImages } from '../../editor/images'
import { IMAGE_CATALOGUE } from '../../routines/imageCatalogue'
import { ExercisesScreen } from '../ExercisesScreen'

// The sweep reads IndexedDB, which this environment has none of; that it is
// asked for is the assertion.
vi.mock('../../storage/sweep', () => ({ sweepOrphans: vi.fn(async () => {}) }))

const saved = (name: string, load: string): Workout => ({
  id: 'w1',
  name: 'Last week',
  blocks: [{ kind: 'segment', id: 's', name, role: 'work', durationMs: 20_000, load }],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

// What App collects for the picker: the catalogue, since no routine here carries an image.
const images = collectImages([], IMAGE_CATALOGUE, '/')

const field = (name: string) => screen.getByLabelText(`Weight for ${name}`) as HTMLInputElement

/** A kit's heading, which is also the control that opens it. */
const kit = (label: string) =>
  [...document.querySelectorAll('summary.weights__kit')].find((one) =>
    one.textContent?.startsWith(label),
  ) as HTMLElement

/** The section that heading belongs to. */
const group = (label: string) => kit(label).closest('details') as HTMLDetailsElement

// jsdom has no dialog methods. File-level, because the help tray needs them
// too and running one describe alone used to throw.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
beforeEach(() => {
  globalThis.localStorage?.clear()
  saveWeights({})
  savePictures({})
  saveCustomExercises({})
})
afterEach(cleanup)

describe('ExercisesScreen', () => {
  it('shows the weight in force, and asks where there is none', () => {
    saveWeights(withWeight({}, 'Leg Press', '65kg'))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(field('Leg Press').value).toBe('65kg')
    // Nothing is guessed, so it asks.
    expect(field('Toe Raise').value).toBe('')
  })

  it('writes a change straight through, so closing the page cannot lose it', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(field('Leg Press'), { target: { value: '70kg' } })

    expect(weightFor('Leg Press')).toBe('70kg')
    expect(loadWeights()).toEqual({ 'leg press': '70kg' })
  })

  it('lets a weight be emptied', () => {
    saveWeights(withWeight({}, 'Leg Press', '65kg'))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(field('Leg Press'), { target: { value: '' } })

    expect(field('Leg Press').value).toBe('')
    expect(weightFor('Leg Press')).toBe('')
  })

  it('offers what the saved routines already use, and fills it in', () => {
    /*
     * The Toe Raise has no looked-up weight, but a routine has been using
     * 15kg for it. That is better evidence than anything on a website.
     */
    render(<ExercisesScreen knownImages={images} workouts={[saved('Toe Raise', '15kg')]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(field('Toe Raise').placeholder).toBe('15kg')
    fireEvent.click(screen.getByRole('button', { name: /Fill 1 from my routines/ }))

    expect(field('Toe Raise').value).toBe('15kg')
    expect(screen.queryByRole('button', { name: /from my routines/ })).toBeNull()
  })

  it('does not offer to overwrite a weight that is already set', () => {
    // The Leg Press is set, so a routine saying 40kg is not an offer to make.
    saveWeights(withWeight({}, 'Leg Press', '65kg'))
    render(<ExercisesScreen knownImages={images} workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /from my routines/ })).toBeNull()
    expect(field('Leg Press').value).toBe('65kg')
  })

  it('filters by name', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Search exercises'), { target: { value: 'pulldown' } })

    expect(field('Lat Pulldown')).toBeTruthy()
    expect(screen.queryByLabelText('Weight for Leg Press')).toBeNull()
  })

  it('leaves the bodyweight exercises out entirely', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByLabelText('Weight for Sit Ups')).toBeNull()
  })
})

describe('the pictures', () => {
  beforeAll(() => {
    // jsdom does not implement the dialog methods; the open attribute is all
    // the code under test observes.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  })

  it('shows the guide’s illustration where it draws one', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    const thumb = screen.getByLabelText('Picture of Leg Press. Change it.')
    expect(thumb.querySelector('img')?.getAttribute('src')).toContain('exercises/Leg-Press.jpg')
  })

  it('offers to add one where the guide draws none', () => {
    /*
     * The whole point of the page growing pictures. The guide only illustrates
     * the machine, so 105 of the 147 had nowhere to keep one and no routine
     * could show them without a photo pasted onto every step.
     */
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.getByLabelText('Add a picture of Band Squats')).toBeTruthy()
    expect(screen.queryByLabelText('Picture of Band Squats. Change it.')).toBeNull()
  })

  it('lists exercises with no weight to keep, which the page used to leave out', () => {
    // A press-up has no number and still has a picture, so the row is here with
    // the field left off rather than empty.
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.getByText('Squats')).toBeTruthy()
    expect(screen.queryByLabelText('Weight for Squats')).toBeNull()
    expect(screen.getByLabelText('Weight for Leg Press')).toBeTruthy()
  })

  it('opens it full size, and closes again', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Leg Press. Change it.'))
    expect(screen.getByRole('img', { name: 'Leg Press' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('img', { name: 'Leg Press' })).toBeNull()
  })

  it('picks a picture for an exercise, and every routine follows it', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Add a picture of Squats'))
    // The editor's own picker, offering the illustrations that ship with the app.
    fireEvent.click(screen.getByRole('button', { name: 'Deadlift' }))

    expect(loadPictures()).toEqual({ squat: { source: 'bundled', path: 'exercises/Deadlift.jpg' } })
    expect(pictureFor('12 × Squats')).toEqual({ source: 'bundled', path: 'exercises/Deadlift.jpg' })
  })

  it('puts the guide’s drawing back when a chosen one is removed', () => {
    savePictures(withPicture({}, 'Leg Press', { source: 'bundled', path: 'exercises/Cycling.jpg' }))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Leg Press. Change it.'))
    fireEvent.click(screen.getByRole('button', { name: "Use the guide's" }))

    expect(loadPictures()).toEqual({})
    const thumb = screen.getByLabelText('Picture of Leg Press. Change it.')
    expect(thumb.querySelector('img')?.getAttribute('src')).toContain('exercises/Leg-Press.jpg')
  })

  it('takes an uploaded photo off the row the moment it is removed', () => {
    /*
     * A photo is a blob, resolved a frame after the render, into a map the row
     * consults FIRST. That map only ever grew, so a picture removed went on
     * being shown until the page was left and reopened.
     */
    savePictures(withPicture({}, 'Squats', { source: 'local', hash: 'abc', mime: 'image/webp' }))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Squats. Change it.'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    const row = screen.getByLabelText('Add a picture of Squats')
    expect(row.querySelector('img')).toBeNull()
    expect(row.dataset.empty).toBe('true')
  })

  it('sweeps the photo it took off the page, rather than leaving it until a routine is deleted', () => {
    savePictures(withPicture({}, 'Squats', { source: 'local', hash: 'abc', mime: 'image/webp' }))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Squats. Change it.'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(sweepOrphans).toHaveBeenCalledWith({})
  })

  it('shows no picture, and no error, where the blob cannot be read at all', () => {
    /*
     * jsdom has no IndexedDB, which is the same shape as a private window or a
     * browser set to refuse site data: `openDb` THROWS rather than coming back
     * empty. Unhandled, that failed a CI run whose every test had passed.
     */
    savePictures(withPicture({}, 'Squats', { source: 'local', hash: 'nope', mime: 'image/webp' }))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    // The row still says it HAS a picture, because the table says so; there is
    // simply nothing to draw, exactly as for a photo left on another device.
    const row = screen.getByLabelText('Picture of Squats. Change it.')
    expect(row.querySelector('img')).toBeNull()
  })

  it('swaps the row over when one picture replaces another', () => {
    savePictures(withPicture({}, 'Squats', { source: 'bundled', path: 'exercises/Deadlift.jpg' }))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Squats. Change it.'))
    // "Change" exactly: the row's own button is labelled "…Change it." too.
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leg Press' }))

    const row = screen.getByLabelText('Picture of Squats. Change it.')
    expect(row.querySelector('img')?.getAttribute('src')).toContain('Leg-Press')
  })

  it('removes one outright where the guide has nothing to fall back on', () => {
    savePictures(withPicture({}, 'Squats', { source: 'bundled', path: 'exercises/Deadlift.jpg' }))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Squats. Change it.'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(loadPictures()).toEqual({})
    expect(screen.getByLabelText('Add a picture of Squats')).toBeTruthy()
  })
})

describe('letting routines follow the page', () => {
  it('offers to clear the weights a routine states for itself', () => {
    /*
     * A routine written before this page carries its own weight on every step,
     * so it overrides the page and goes on saying 40kg after you have moved on.
     */
    saveWeights(withWeight({}, 'Leg Press', '65kg'))
    const onFollow = vi.fn()
    render(
      <ExercisesScreen knownImages={images} workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Let 1 routine follow these/ }))
    expect(screen.getByText(/1 step in 1 routine state/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear 1' }))

    const rewritten = onFollow.mock.calls[0]![0] as Workout[]
    expect(rewritten).toHaveLength(1)
    expect((rewritten[0]!.blocks[0] as { load?: string }).load).toBeUndefined()
  })

  it('says so when the routines could not be rewritten', async () => {
    // A failed save part-way used to be an unhandled rejection: the page that
    // asked showed nothing, and the last routines still stated their weights.
    saveWeights(withWeight({}, 'Leg Press', '65kg'))
    const onFollow = vi.fn(async () => {
      throw new Error('Could not save the routine: quota exceeded')
    })
    render(
      <ExercisesScreen knownImages={images} workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Let 1 routine follow these/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear 1' }))

    expect((await screen.findByText(/quota exceeded/)).textContent).toMatch(/still state their own weights/)
  })

  it('says nothing when every routine already follows', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /follow these/ })).toBeNull()
  })

  it('leaves a weight this page has no answer for', () => {
    // Nothing here knows what a Band Squat should be loaded to, so the routine
    // is the only record of it.
    const onFollow = vi.fn()
    render(
      <ExercisesScreen knownImages={images} workouts={[saved('Band Squats', 'red')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    expect(screen.queryByRole('button', { name: /follow these/ })).toBeNull()
  })

  it('takes a weight typed just now into account', () => {
    // Typing a weight for the Band Squats brings that routine into scope: the
    // page can answer for it now, so its own weight can go.
    render(
      <ExercisesScreen knownImages={images} workouts={[saved('Band Squats', 'red')]} onExit={vi.fn()} onFollow={vi.fn()} />,
    )

    fireEvent.change(field('Band Squats'), { target: { value: 'green' } })

    expect(screen.getByRole('button', { name: /Let 1 routine follow these/ })).toBeTruthy()
  })

  it('cancels without touching anything', () => {
    saveWeights(withWeight({}, 'Leg Press', '65kg'))
    const onFollow = vi.fn()
    render(
      <ExercisesScreen knownImages={images} workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Let 1 routine follow these/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onFollow).not.toHaveBeenCalled()
  })
})

describe('help', () => {
  it('opens a tray of its own, not the library’s', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Help'))

    // The rule an empty field carries is the one thing this page must explain.
    expect(screen.getByText(/How a routine uses them/)).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Exercises' })).toBeTruthy()
  })
})

describe('what each row says about the exercise', () => {
  it('prints the attributes under the name', () => {
    /*
     * All of this was in the table and none of it was on the screen, which is
     * what a person is actually asking when they cannot tell two rows apart.
     * On the multi-gym the station is the part you are standing there reading.
     */
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    const row = field('Leg Press').closest('li')!
    expect(row.querySelector('.weight__attrs')?.textContent).toContain('Lower body')
    expect(row.querySelector('.weight__attrs')?.textContent).toContain('Station')
  })

  it('says push or pull where the table knows it', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    const row = field('Standard Chest Press').closest('li')!
    expect(row.querySelector('.weight__attrs')?.textContent).toMatch(/Upper body · push/)
  })
})

describe('exercises of your own', () => {
  const mine = { name: 'Sandbag Lunge', area: 'lower' as const, equipment: 'kettlebell' as const }

  const addOne = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'New exercise' }))
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: 'Kettlebell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    // "Sandbag Carry" resembles nothing the app ships, so Add saves it outright.
    // A name that shares a movement gets the warning first; see the dialog's tests.
  }

  it('adds one, and it is stored and listed', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    addOne('Sandbag Carry')

    expect(loadCustomExercises()).toHaveProperty('sandbag carry')
    // Kettlebell is loadable, so the row has a weight field like any other.
    expect(field('Sandbag Carry')).toBeTruthy()
  })

  it('marks yours, and gives only those rows Edit and Remove', () => {
    saveCustomExercises(addCustom({}, mine))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    const row = field('Sandbag Lunge').closest('li')!
    expect(row.querySelector('.weight__pill')?.textContent).toBe('Yours')
    expect(screen.getByRole('button', { name: 'Edit Sandbag Lunge' })).toBeTruthy()

    // The app's own come off the machine's guide and the instructor's routines:
    // this device does not get to edit them.
    const shipped = field('Leg Press').closest('li')!
    expect(shipped.querySelector('.weight__pill')).toBeNull()
    expect(shipped.querySelector('.weight__act')).toBeNull()
  })

  it('takes a weight and a picture like any other row', () => {
    saveCustomExercises(addCustom({}, mine))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(field('Sandbag Lunge'), { target: { value: '12kg' } })
    expect(weightFor('Sandbag Lunge')).toBe('12kg')
  })

  it('changes one, and carries its weight, picture and pace to the new name', () => {
    /*
     * All three per-device tables are keyed by folded name, so a rename that
     * moved only the row would leave the number, the photo and the measured pace
     * behind under a name nothing asks about again.
     */
    saveCustomExercises(addCustom({}, mine))
    saveWeights(withWeight({}, 'Sandbag Lunge', '12kg'))
    savePictures(withPicture({}, 'Sandbag Lunge', { source: 'bundled', path: 'exercises/Cycling.jpg' }))
    savePaces({ 'sandbag lunge': [3, 3, 3] })

    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sandbag Lunge' }))
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Sandbag Haul' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(loadCustomExercises()).not.toHaveProperty('sandbag lunge')
    expect(weightFor('Sandbag Haul')).toBe('12kg')
    expect(pictureFor('Sandbag Haul')).toBeTruthy()
    expect(loadPaces()).toHaveProperty('sandbag haul')
    expect(loadPaces()).not.toHaveProperty('sandbag lunge')
  })

  it('offers to rename the steps in your routines that still say the old name', () => {
    const onFollow = vi.fn()
    saveCustomExercises(addCustom({}, mine))
    render(
      <ExercisesScreen
        knownImages={images}
        workouts={[saved('12 × Sandbag Lunge 12kg', '')]}
        onExit={vi.fn()}
        onFollow={onFollow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit Sandbag Lunge' }))
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Sandbag Haul' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Asked, not done: a step deliberately named something else should stay so.
    expect(screen.getByText(/still say “Sandbag Lunge”/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Rename 1/ }))

    const rewritten = onFollow.mock.calls[0]![0] as Workout[]
    // Everything the step carried is put back: the count and the weight it names.
    expect(rewritten[0]!.blocks[0]).toMatchObject({ name: '12 × Sandbag Haul 12kg' })
  })

  it('does not ask about routines that never named it', () => {
    saveCustomExercises(addCustom({}, mine))
    render(
      <ExercisesScreen knownImages={images} workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sandbag Lunge' }))
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Sandbag Haul' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.queryByText(/still say/)).toBeNull()
  })

  it('removes one, with its weight and its picture, and asks first', () => {
    saveCustomExercises(addCustom({}, mine))
    saveWeights(withWeight({}, 'Sandbag Lunge', '12kg'))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sandbag Lunge' }))
    expect(screen.getByText(/Remove “Sandbag Lunge”\?/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(loadCustomExercises()).toEqual({})
    expect(weightFor('Sandbag Lunge')).toBe('')
    expect(screen.queryByLabelText('Weight for Sandbag Lunge')).toBeNull()
  })

  it('keeps everything on cancel', () => {
    saveCustomExercises(addCustom({}, mine))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sandbag Lunge' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(loadCustomExercises()).toHaveProperty('sandbag lunge')
  })

  it('counts yours in its kit’s heading, and says how many are yours', () => {
    saveCustomExercises(addCustom({}, mine))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    // One kettlebell exercise ships, so the heading has to say two of which one
    // is yours.
    expect(kit('Kettlebell').textContent).toMatch(/2 \(1 yours\)$/)
  })

  it('says nothing about yours on a kit you have not added to', () => {
    // "(0 yours)" on four headings is noise standing in for information.
    saveCustomExercises(addCustom({}, mine))
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(kit('Multi-gym').textContent).not.toContain('yours')
  })

  it('opens the kit an exercise was just added to', () => {
    // Otherwise it lands in a closed section and nothing appears to happen.
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)
    addOne('Sandbag Carry')

    expect(group('Kettlebell').open).toBe(true)
  })
})

describe('the kit sections', () => {
  it('starts with every one closed', () => {
    /*
     * All seven open is 147 rows, and the page used to open three screens deep
     * in the multi-gym with the kettlebell and the bands nowhere in sight.
     */
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    const groups = document.querySelectorAll('details.weights__group')
    expect(groups.length).toBe(7)
    expect([...groups].every((one) => !(one as HTMLDetailsElement).open)).toBe(true)
  })

  it('opens and closes the one you press', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(kit('Multi-gym'))
    expect(group('Multi-gym').open).toBe(true)
    // The others stay as they were: opening one kit is not opening the page.
    expect(group('Bands').open).toBe(false)

    fireEvent.click(kit('Multi-gym'))
    expect(group('Multi-gym').open).toBe(false)
  })

  it('opens one at a time, so the headings are never a scroll away', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(kit('Multi-gym'))
    fireEvent.click(kit('Bands'))

    expect(group('Bands').open).toBe(true)
    expect(group('Multi-gym').open).toBe(false)
  })

  it('keeps every result open, and folds away only the heading you press', () => {
    /*
     * Results are the exception to one-at-a-time: the answer to "where is this
     * exercise" is all of them at once. Folding one kit away must not take the
     * other six with it.
     */
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)
    // "squat" matches in both kits. "press" does not: no band exercise is one,
    // so there would be no Bands heading on screen to press.
    fireEvent.change(screen.getByLabelText('Search exercises'), { target: { value: 'squat' } })

    fireEvent.click(kit('Bands'))

    expect(group('Bands').open).toBe(false)
    expect(group('Bodyweight').open).toBe(true)
  })

  it('says how many are in each, since a closed one cannot show you', () => {
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)
    expect(kit('Multi-gym').textContent).toMatch(/\d+$/)
  })

  it('keeps a clear button on the search while it has text', () => {
    /*
     * Ours, not the browser's: WebKit only draws its own × while the field has
     * focus, so tapping anything else on the page left no way to clear a search
     * but selecting the text.
     */
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)
    const search = screen.getByLabelText('Search exercises')
    expect(screen.queryByLabelText('Clear the search')).toBeNull()

    fireEvent.change(search, { target: { value: 'press' } })
    const clear = screen.getByLabelText('Clear the search')

    // Focus somewhere else entirely: the button is still there to be tapped.
    fireEvent.focus(screen.getByRole('button', { name: 'New exercise' }))
    expect(screen.getByLabelText('Clear the search')).toBe(clear)

    fireEvent.click(clear)
    expect((search as HTMLInputElement).value).toBe('')
    expect(screen.queryByLabelText('Clear the search')).toBeNull()
  })

  it('opens them all for a search, and puts them back when it is cleared', () => {
    // A search that hid its own results behind seven closed headings would be
    // no search at all.
    render(<ExercisesScreen knownImages={images} workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)
    const search = screen.getByLabelText('Search exercises')

    fireEvent.change(search, { target: { value: 'press' } })
    expect([...document.querySelectorAll('details.weights__group')].every((one) => (one as HTMLDetailsElement).open)).toBe(true)

    fireEvent.change(search, { target: { value: '' } })
    expect([...document.querySelectorAll('details.weights__group')].some((one) => (one as HTMLDetailsElement).open)).toBe(false)
  })
})
