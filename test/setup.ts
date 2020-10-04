import {
  Events as BaseEvents,
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

export type EventPayloads = {
  PostCreated: {
    id: string
    title: string
  }
  PostPublished: {
    id: string
  }
  AllPostsPublished: undefined
}

export type EventName = keyof EventPayloads

export type EventKey = string

export type Event<N extends EventName = EventName> = {
  id: EventKey
  name: N
  payload: EventPayloads[N]
  time: string
  actorId: string
}

export type EventName2<E extends { name: string }> = E['name']
export type EventByName<E extends Event, _N extends string> = E extends {
  name: string
}
  ? E
  : never

type AllEvents = Event
type EventNames = EventName2<Event>
type PostCreated = EventByName<Event, 'PostCreated'>

export const event = <N extends EventName>(
  name: N,
  payload: EventPayloads[N],
  { actorId }: Context
): Event<N> => ({
  id: '123',
  name,
  time: 'now',
  actorId,
  payload,
})

const postPublished: Event<'PostPublished'> = {
  id: '123',
  name: 'PostPublished',
  payload: { id: '123' },
  time: 'now',
  actorId: 'a1',
}

const postCreated = event(
  'PostCreated',
  {
    id: 'e0',
    title: 'Hey',
  },
  { actorId: 'a1' }
)

export const getEventKey = ({ id }: Event) => id

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
          init: event => ({
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

export type Projections = {
  posts: PostProjection
}

export interface EventsOptions {
  store: Store<Event, EventKey>
  projections: Projections
}

export class Events extends BaseEvents<Event, EventKey, Projections> {
  constructor(options: EventsOptions) {
    super(options)
  }
}

export class EventStore extends InMemoryStore<Event, EventKey, {}> {
  constructor() {
    super({
      getItemKey: getEventKey,
    })
  }
}
