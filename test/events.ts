import test from 'tape'
import { Readable } from 'stream'

import { EmitResult } from '../src'

import {
  EventType,
  Events,
  EventStore,
  PostProjection,
  PostStore,
  Post,
  Projections,
  event as buildEvent,
} from './setup'

const context = { actorId: 'u1' }

const eventData = {
  id: 'p1',
  title: 'Event Sourcing Explained',
}

const event: EventType = {
  actorId: 'u1',
  id: 'e0',
  name: 'PostCreated',
  payload: eventData,
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
  postEmit?: (result: EmitResult<EventType, Projections>) => void
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

test('Events.emit', async t => {
  const { events, posts } = setup()

  const result = await events.emit(
    buildEvent('PostCreated', eventData, context)
  )

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

  await events.emit(buildEvent('PostCreated', eventData, context))

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
