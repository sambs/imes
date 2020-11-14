import test from 'tape'
import { Readable } from 'stream'

import {
  EmitResult,
  Event,
  Events,
  EventName,
  EventStore,
  PostProjection,
  PostStore,
  Post,
} from './setup'

const context = { actorId: 'u1' }

const payload = {
  id: 'p1',
  title: 'Event Sourcing Explained',
}

const event: Event = {
  actorId: 'u1',
  id: 'e0',
  name: 'PostCreated',
  payload,
  time: 't0',
}

const post: Post = {
  createdAt: 'now',
  createdBy: 'u1',
  eventIds: ['e0'],
  id: 'p1',
  published: false,
  score: 0,
  title: 'Event Sourcing Explained',
  updatedAt: 'now',
  updatedBy: 'u1',
}

type TestEventsOptions = {
  postEmit?: <N extends EventName>(result: EmitResult<N>) => void
}

const setup = (options?: TestEventsOptions) => {
  const postStore = new PostStore()
  const posts = new PostProjection({ store: postStore })
  const eventStore = new EventStore()
  const events = new Events({
    projections: { posts },
    store: eventStore,
    ...options,
  })

  return { events, posts }
}

test('Events.build', t => {
  const { events } = setup()

  t.deepEqual(events.build('PostCreated', payload, context), event)

  t.end()
})

test('Events.emit', async t => {
  const { events, posts } = setup()

  const result = await events.emit('PostCreated', payload, context)

  t.deepEqual(result, { event, updates: { posts: [post] } })

  t.deepEqual(await posts.store.get('p1'), post)
  t.deepEqual(await events.store.get('e0'), event)

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

  await events.emit('PostCreated', payload, context)

  await new Promise(process.nextTick)
})

test('Events.load', async t => {
  const { events, posts } = setup()

  await events.load([event])

  t.deepEqual(await posts.store.get('p1'), post, 'populates projections')

  t.deepEqual(
    await events.store.get('e0'),
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
    await events.store.get('e0'),
    event,
    'writes the event to the Events store'
  )

  t.end()
})

test('Events.load from a stream', async t => {
  const { events, posts } = setup()

  const stream = Readable.from([event])

  await events.load(stream)

  t.deepEqual(await posts.store.get('p1'), post, 'populates projections')

  t.end()
})
