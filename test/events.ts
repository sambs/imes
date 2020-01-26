import test from 'tape'
import { Readable } from 'stream'

import {
  Edge,
  Event,
  InMemoryStore,
  Events,
  EventsOptions,
  Projection,
  ProjectionHandlers,
  Query,
  sequentialIdGenerator,
} from '../src'

type EventTypes = {
  UserCreated: {
    id: string
    name: string
  }
  UserLoggedIn: {
    id: string
  }
}

interface User {
  id: string
  name: string
  loginCount: number
}

type UserKey = string

const getUserKey = (edge: Edge<User>): UserKey => edge.node.id

const UserProjectionHandlers: ProjectionHandlers<
  EventTypes,
  User,
  UserKey,
  Query<UserKey>
> = {
  UserCreated: {
    init: ({ data }) => ({ ...data, loginCount: 0 }),
  },
  UserLoggedIn: {
    selectOne: event => event.data.id,
    transform: (_event, node) => ({
      ...node,
      loginCount: node.loginCount + 1,
    }),
  },
}

const userCreatedData = {
  id: 'u1',
  name: 'Trevor',
}

const userCreatedEvent = {
  id: 'e0',
  name: 'UserCreated',
  data: userCreatedData,
  time: 't0',
}

const userEdge = {
  createdAt: 't0',
  eventIds: ['e0'],
  node: { ...userCreatedData, loginCount: 0 },
  typename: 'User',
  updatedAt: 't0',
}

type Projections = {
  users: Edge<User>
}

type UserStoreKey = string
type EventStoreKey = string

type TestEventsOptions = {
  postEmit?: EventsOptions<EventTypes, Projections, UserStoreKey>['postEmit']
}

const setup = (options?: TestEventsOptions) => {
  const projection = new Projection({
    typename: 'User',
    handlers: UserProjectionHandlers,
    store: new InMemoryStore({ getItemKey: getUserKey }),
  })

  const events = new Events<EventTypes, Projections, EventStoreKey>({
    generateId: sequentialIdGenerator('e'),
    getTime: sequentialIdGenerator('t'),
    projections: { users: projection },
    store: new InMemoryStore({
      getItemKey: (event: Event<EventTypes>) => event.id,
    }),
    ...options,
  })

  return { events, projection }
}

test('Events.emit', async t => {
  const { events, projection } = setup()

  const result = await events.emit('UserCreated', userCreatedData)

  t.deepEqual(result, {
    event: userCreatedEvent,
    updates: { users: [userEdge] },
  })
  t.deepEqual(await projection.store.read('u1'), userEdge)
  t.deepEqual(await events.store.read('e0'), userCreatedEvent)

  t.end()
})

test('Events.postEmit', async t => {
  t.plan(2)

  const { events } = setup({
    postEmit: ({ event, updates }) => {
      t.deepEqual(event, userCreatedEvent)
      t.deepEqual(updates, { users: [userEdge] })
    },
  })

  await events.emit('UserCreated', userCreatedData)
})

test('Events.load', async t => {
  const { events, projection } = setup()

  const stream = Readable.from([userCreatedEvent])

  await events.load(stream)

  t.deepEqual(
    await projection.store.read('u1'),
    userEdge,
    'populates projectios'
  )

  t.deepEqual(
    await events.store.read('e0'),
    undefined,
    'does not write the event to the Events store'
  )

  t.end()
})

test('Events.load with write option', async t => {
  const { events } = setup()

  const stream = Readable.from([userCreatedEvent])

  await events.load(stream, { write: true })

  t.deepEqual(
    await events.store.read('e0'),
    userCreatedEvent,
    'writes the event to the Events store'
  )

  t.end()
})
