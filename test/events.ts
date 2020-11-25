import { writeProjectionUpdates } from '../src'

import {
  Context,
  Event,
  EventName,
  EventPayload,
  EventStore,
  PostProjection,
  PostStore,
  Post,
} from './setup'

const eventStore = new EventStore()
const postStore = new PostStore()
const posts = new PostProjection({ store: postStore })

export const emit = async <N extends EventName>(
  name: N,
  payload: EventPayload<N>,
  context: Context
) => {
  const event: Event<N> = {
    name,
    payload,
    actorId: context.actorId,
    id: 'e0',
    time: 't0',
  }

  await eventStore.put(event)

  const updates = await writeProjectionUpdates({ posts }, event)

  return { event, updates }
}

test('A typical emit function', async () => {
  const context = { actorId: 'u1' }

  const payload = {
    id: 'p1',
    title: 'Event Sourcing Explained',
  }

  const result = await emit('PostCreated', payload, context)

  const expectedEvent: Event = {
    actorId: 'u1',
    id: 'e0',
    name: 'PostCreated',
    payload,
    time: 't0',
  }

  const expectedPost: Post = {
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

  expect(result).toEqual({
    event: expectedEvent,
    updates: { posts: [{ current: expectedPost }] },
  })

  expect(await posts.store.get('p1')).toEqual(expectedPost)
  expect(await eventStore.get('e0')).toEqual(expectedEvent)
})
