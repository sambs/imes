import {
  EqualFilter,
  Event as BaseEvent,
  Events as BaseEvents,
  EmitResult as BaseEmitResult,
  EventName as BaseEventName,
  InMemoryStore,
  OrdFilter,
  PrefixFilter,
  Projection,
  Query,
  Store,
  equalPredicate,
  ordPredicate,
  prefixPredicate,
  QueryableStore,
} from '../src'

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
  time: string
  name: string
}

export type EventKey = string

export type EventName = BaseEventName<EventTypes>

export type Event<N extends EventName = EventName> = BaseEvent<
  EventTypes,
  EventMeta,
  EventKey,
  N
>

export type EmitResult<N extends EventName> = BaseEmitResult<
  EventTypes,
  EventMeta,
  EventKey,
  Projections,
  N
>

export interface PostData {
  title: string
  score: number
  published: boolean
}

export type PostKey = string

export interface PostMeta {
  createdAt: string
  eventKeys: EventKey[]
  updatedAt: string
}

export interface Post {
  data: PostData
  meta: PostMeta
  key: PostKey
}

export interface PostQuery extends Query<Post> {
  filter?: {
    title?: EqualFilter<string> & PrefixFilter
    published?: EqualFilter<boolean>
    score?: OrdFilter<number>
  }
}

export interface PostStoreOptions {
  items?: Post[]
}

export class PostStore extends InMemoryStore<Post, PostQuery> {
  constructor(options?: PostStoreOptions) {
    super({
      getFilterPredicates: function*({ filter }) {
        if (filter) {
          if (filter.published !== undefined) {
            yield item => equalPredicate(filter.published!)(item.data.published)
          }
          if (filter.title !== undefined) {
            yield item => equalPredicate(filter.title!)(item.data.title)
            yield item => prefixPredicate(filter.title!)(item.data.title)
          }
          if (filter.score !== undefined) {
            yield item => ordPredicate(filter.score!)(item.data.score)
          }
        }
      },
      ...options,
    })
  }
}

export interface PostProjectionOptions {
  store: QueryableStore<Post, PostQuery>
}

export class PostProjection extends Projection<
  EventTypes,
  EventMeta,
  EventKey,
  Post,
  PostQuery
> {
  constructor(options: PostProjectionOptions) {
    super({
      handlers: {
        PostCreated: {
          init: ({ data: { id, ...data } }) => ({
            published: false,
            score: 0,
            ...data,
          }),
          key: ({ data: { id } }) => id,
        },
        PostPublished: {
          selectOne: ({ data: { id } }) => id,
          transform: (_, post) => ({ ...post, published: true }),
        },
        AllPostsPublished: {
          selectMany: () => ({ filter: { published: { eq: false } } }),
          transform: (_, post) => ({ ...post, published: true }),
        },
      },
      initMeta: ({ key }) => ({
        createdAt: 'now',
        eventKeys: [key],
        updatedAt: 'now',
      }),
      updateMeta: ({ key }, { createdAt, eventKeys }) => ({
        createdAt,
        eventKeys: [...eventKeys, key],
        updatedAt: 'now',
      }),
      ...options,
    })
  }
}

type Projections = {
  posts: PostProjection
}

interface EventsOptions {
  store: Store<Event>
  projections: Projections
}

export class Events extends BaseEvents<
  EventTypes,
  EventMeta,
  EventKey,
  Projections
> {
  constructor(options: EventsOptions) {
    const generateId = sequentialIdGenerator('e')
    const getTime = sequentialIdGenerator('t')

    super({
      getMeta: name => {
        return { name, time: getTime() }
      },
      getKey: _event => generateId(),
      ...options,
    })
  }
}

const sequentialIdGenerator = (prefix = '') => {
  let count = 0
  return () => `${prefix}${count++}`
}
