import {
  Event as BaseEvent,
  Events as BaseEvents,
  EmitResult as BaseEmitResult,
  EventName as BaseEventName,
  ExactFilter,
  InMemoryStore,
  OrdFilter,
  PrefixFilter,
  Projection,
  Query,
  Store,
  exactPredicate,
  ordPredicate,
  prefixPredicate,
  QueryableStore,
} from '../src'

export interface Context {
  actorId: string
}

export interface EventTypes {
  PostCreated: {
    id: string
    title: string
  }
  PostPublished: {
    id: string
  }
  AllPostsPublished: undefined
}

export interface EventMeta {
  actorId: string
  name: string
  time: string
}

export type EventKey = { id: string }

export type EventName = BaseEventName<EventTypes>

export type Event<N extends EventName = EventName> = BaseEvent<
  EventTypes,
  EventMeta,
  EventKey,
  N
>

export const getEventKey = <E extends Event<any>>({ id }: E): EventKey => ({
  id,
})

export type EmitResult<N extends EventName> = BaseEmitResult<
  EventTypes,
  EventMeta,
  EventKey,
  Projections,
  N
>

export interface PostData {
  id: string
  title: string
  score: number
  published: boolean
}

export type PostKey = string

export interface PostMeta {
  createdAt: string
  createdBy: string
  eventIds: string[]
  updatedAt: string
  updatedBy: string
}

export type Post = PostData & PostMeta

export interface PostQuery extends Query<PostKey> {
  filter?: {
    title?: ExactFilter<string> & PrefixFilter
    published?: ExactFilter<boolean>
    score?: OrdFilter<number>
  }
}

export interface PostStoreOptions {
  items?: Post[]
}

export class PostStore extends InMemoryStore<Post, PostKey, PostQuery> {
  constructor(options?: PostStoreOptions) {
    super({
      getItemKey: ({ id }) => id,
      getFilterPredicates: function* ({ filter }) {
        if (filter) {
          if (filter.published !== undefined) {
            yield item => exactPredicate(filter.published!)(item.published)
          }
          if (filter.title !== undefined) {
            yield item => exactPredicate(filter.title!)(item.title)
            yield item => prefixPredicate(filter.title!)(item.title)
          }
          if (filter.score !== undefined) {
            yield item => ordPredicate(filter.score!)(item.score)
          }
        }
      },
      ...options,
    })
  }
}

export interface PostProjectionOptions {
  store: QueryableStore<Post, PostKey, PostQuery>
}

export class PostProjection extends Projection<
  Event,
  Post,
  PostKey,
  PostMeta,
  PostQuery
> {
  constructor(options: PostProjectionOptions) {
    super({
      handlers: {
        PostCreated: {
          init: ({ payload }) => ({
            published: false,
            score: 0,
            ...event.payload,
          }),
        },
        PostPublished: {
          selectOne: ({ payload: { id } }) => id,
          transform: (_, post) => ({ ...post, published: true }),
        },
        AllPostsPublished: {
          selectMany: () => ({ filter: { published: { eq: false } } }),
          transform: (_, post) => ({ ...post, published: true }),
        },
      },
      initMeta: event => ({
        createdAt: 'now',
        createdBy: event.actorId,
        eventIds: [event.id],
        updatedAt: 'now',
        updatedBy: event.actorId,
      }),
      updateMeta: (event, { eventIds, ...meta }) => ({
        ...meta,
        eventIds: [...eventIds, event.id],
        updatedAt: 'now',
        updatedBy: event.actorId,
      }),
      ...options,
    })
  }
}

type Projections = {
  posts: PostProjection
}

interface EventsOptions {
  store: Store<Event, EventKey>
  projections: Projections
}

export class Events extends BaseEvents<
  EventTypes,
  EventMeta,
  EventKey,
  Projections,
  Context
> {
  constructor(options: EventsOptions) {
    const generateId = sequentialIdGenerator('e')
    const getTime = sequentialIdGenerator('t')

    super({
      getMeta: (name, context) => {
        return { name, time: getTime(), ...context }
      },
      getKey: (_name, _context) => ({ id: generateId() }),
      ...options,
    })
  }
}

export class EventStore extends InMemoryStore<Event, EventKey, {}> {
  constructor() {
    super({
      getItemKey: getEventKey,
    })
  }
}

const sequentialIdGenerator = (prefix = '') => {
  let count = 0
  return () => `${prefix}${count++}`
}
