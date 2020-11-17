import {
  Event as BaseEvent,
  EventName as BaseEventName,
  EventPayload as BaseEventPayload,
  ExactFilter,
  InMemoryStore,
  OrdFilter,
  PrefixFilter,
  Projection,
  Query,
  Store,
  exactPredicates,
  ordPredicates,
  prefixPredicate,
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

export type EventName = BaseEventName<EventTypes>

export type EventPayload<N extends EventName = EventName> = BaseEventPayload<
  EventTypes,
  N
>

export interface EventMeta {
  actorId: string
  id: string
  name: EventName
  time: string
}

export type EventKey = string

export type Event<N extends EventName = EventName> = BaseEvent<
  EventTypes,
  EventMeta,
  N
>

export type PostKey = string

export interface PostData {
  id: string
  title: string
  score: number
  published: boolean
}

export interface PostMeta {
  createdAt: string
  createdBy: string
  eventIds: string[]
  updatedAt: string
  updatedBy: string
}

export type Post = PostData & PostMeta

export interface PostQuery extends Query {
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
      filters: {
        title: {
          ...exactPredicates(({ title }) => title),
          prefix: prefixPredicate(({ title }) => title),
        },
        score: ordPredicates(({ score }) => score),
        published: exactPredicates(({ published }) => published),
      },
      ...options,
    })
  }
}

export interface PostProjectionOptions {
  store: Store<Post, PostKey, PostQuery>
}

export class PostProjection extends Projection<
  EventTypes,
  EventMeta,
  Post,
  PostMeta,
  PostKey,
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

export class EventStore extends InMemoryStore<Event, EventKey, {}> {
  constructor() {
    super({
      getItemKey: ({ id }) => id,
      filters: {},
    })
  }
}

const p1: Post = {
  title: 'Who Ya?',
  score: 3.4,
  published: true,
  createdAt: 'yesterday',
  createdBy: 'u1',
  eventIds: ['e1'],
  updatedAt: 'yesterday',
  updatedBy: 'u1',
  id: 'p1',
}

const p2: Post = {
  title: 'Whoa Ye!',
  score: 6.2,
  published: false,
  createdAt: 'yesterday',
  createdBy: 'u2',
  eventIds: ['e2'],
  updatedAt: 'yesterday',
  updatedBy: 'u2',
  id: 'p2',
}

const p3: Post = {
  title: 'Howdy Folks',
  score: 5.8,
  published: true,
  createdAt: 'yesterday',
  createdBy: 'u1',
  eventIds: ['e3'],
  updatedAt: 'yesterday',
  updatedBy: 'u1',
  id: 'p3',
}

export const posts = { p1, p2, p3 }
