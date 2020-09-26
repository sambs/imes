import {
  Events as BaseEvents,
  EventName,
  EventByName,
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

type Event<N extends string, P = undefined> = {
  id: string
  name: N
  payload: P
  time: string
  actorId: string
}

export type EventType =
  | Event<
      'PostCreated',
      {
        id: string
        title: string
      }
    >
  | Event<
      'PostPublished',
      {
        id: string
      }
    >
  | Event<'AllPostsPublished'>

export type EventKey = string

type EventPayload<N extends EventName<EventType>> = EventByName<
  EventType,
  N
>['payload']

export const event = <N extends EventName<EventType>>(
  name: N,
  payload: EventByName<EventType, N>['payload'],
  { actorId }: Context
): EventByName<EventType, N> => ({
  id: '123',
  name,
  time: 'now',
  actorId,
  payload,
})

const postCreated = event(
  'PostCreated',
  {
    id: 'e0',
    title: 'Hey',
  },
  { actorId: 'a1' }
)

export const getEventKey = ({ id }: EventType) => id

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
  EventType,
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
            ...payload,
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
  store: Store<EventType, EventKey>
  projections: Projections
}

export class Events extends BaseEvents<EventType, EventKey, Projections> {
  constructor(options: EventsOptions) {
    super(options)
  }
}

export class EventStore extends InMemoryStore<EventType, EventKey, {}> {
  constructor() {
    super({
      getItemKey: getEventKey,
    })
  }
}
