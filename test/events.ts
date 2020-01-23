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

const userCreatedResolvedEvent = {
  ...userCreatedEvent,
  updatedEdges: [userEdge],
}

type TestEventsOptions = Partial<EventsOptions<EventTypes, string>>
type EventStoreKey = string

const testEvents = (options?: TestEventsOptions) =>
  new Events<EventTypes, EventStoreKey>({
    generateId: sequentialIdGenerator('e'),
    getTime: sequentialIdGenerator('t'),
    store: new InMemoryStore({
      getItemKey: (event: Event<EventTypes>) => event.id,
    }),
    ...options,
  })

const userProjection = () =>
  new Projection({
    typename: 'User',
    handlers: UserProjectionHandlers,
    store: new InMemoryStore({ getItemKey: getUserKey }),
  })

test('MockEvents', async t => {
  const events = testEvents({})

  const result = await events.emit('UserCreated', userCreatedData)

  t.deepEqual(result, { ...userCreatedEvent, updatedEdges: [] })
  t.deepEqual(await events.store.read('e0'), userCreatedEvent)

  t.end()
})

test('MockEvents with projections', async t => {
  t.plan(4)

  const projection = userProjection()

  const events = testEvents({
    projections: { user: projection },
    postEmit: event => {
      t.deepEqual(event, userCreatedResolvedEvent)
    },
  })

  const result = await events.emit('UserCreated', userCreatedData)

  t.deepEqual(result, userCreatedResolvedEvent)
  t.deepEqual(await projection.store.read('u1'), userEdge)
  t.deepEqual(await events.store.read('e0'), userCreatedEvent)
})

test('Events.load', async t => {
  const projection = userProjection()
  const Events = testEvents({ projections: { user: projection } })

  const stream = Readable.from([userCreatedEvent])

  await Events.load(stream)

  t.deepEqual(
    await projection.store.read('u1'),
    userEdge,
    'populates projectios'
  )

  t.deepEqual(
    await Events.store.read('e0'),
    undefined,
    'does not write the event to the Events store'
  )

  t.end()
})

test('Events.load with write option', async t => {
  const projection = userProjection()
  const Events = testEvents({ projections: { user: projection } })

  const stream = Readable.from([userCreatedEvent])

  await Events.load(stream, { write: true })

  t.deepEqual(
    await Events.store.read('e0'),
    userCreatedEvent,
    'writes the event to the Events store'
  )

  t.end()
})
