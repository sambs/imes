import test from 'tape'
import { Readable } from 'stream'
import { InMemoryStore } from '../src'

import {
  EmitResult,
  Events,
  EventName,
  PostProjection,
  PostStore,
} from './setup'

const context = { actorId: 'u1' }

const eventData = {
  id: 'p1',
  title: 'Event Sourcing Explained',
}

const event = {
  data: eventData,
  meta: { name: 'PostCreated', time: 't0', actorId: 'u1' },
  key: 'e0',
}
const post = {
  data: { published: false, title: 'Event Sourcing Explained', score: 0 },
  meta: {
    createdAt: 'now',
    createdBy: 'u1',
    eventKeys: ['e0'],
    updatedAt: 'now',
    updatedBy: 'u1',
  },
  key: 'p1',
}

type TestEventsOptions = {
  postEmit?: <N extends EventName>(result: EmitResult<N>) => void
}

const setup = (options?: TestEventsOptions) => {
  const postStore = new PostStore()
  const posts = new PostProjection({ store: postStore })
  const eventStore = new InMemoryStore({})
  const events = new Events({
    projections: { posts },
    store: eventStore,
    ...options,
  })

  return { events, posts }
}

test('Events.emit', async t => {
  const { events, posts } = setup()

  const result = await events.emit('PostCreated', eventData, context)

  t.deepEqual(result, { event, updates: { posts: [post] } })

  t.deepEqual(await posts.store.read('p1'), post)
  t.deepEqual(await events.store.read('e0'), event)

  t.end()
})

test('Events.postEmit', async t => {
  t.plan(2)

  const { events } = setup({
    postEmit: result => {
      t.deepEqual(result.event, event)
      t.deepEqual(result.updates, { posts: [post] })
    },
  })

  await events.emit('PostCreated', eventData, context)

  await new Promise(process.nextTick)
})

test('Events.load', async t => {
  const { events, posts } = setup()

  const stream = Readable.from([event])

  await events.load(stream)

  t.deepEqual(await posts.store.read('p1'), post, 'populates projectios')

  t.deepEqual(
    await events.store.read('e0'),
    undefined,
    'does not write the event to the Events store'
  )

  t.end()
})

test('Events.load with write option', async t => {
  const { events } = setup()

  const stream = Readable.from([event])

  await events.load(stream, { write: true })

  t.deepEqual(
    await events.store.read('e0'),
    event,
    'writes the event to the Events store'
  )

  t.end()
})
