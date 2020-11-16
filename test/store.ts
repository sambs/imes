import {
  ExactFilter,
  InMemoryStore,
  OrdFilter,
  PrefixFilter,
  Query,
  exactPredicates,
  ordPredicates,
  prefixPredicate,
  defaultKeyToString,
} from '../src'

interface UserData {
  id: string
  name: string
  age: number | null
}

type UserKey = string

interface UserMeta {
  createdAt: string
}

type User = UserData & UserMeta

interface UserQuery extends Query {
  filter?: {
    name?: ExactFilter<string> & PrefixFilter
    age?: OrdFilter<number>
  }
}

const user1: User = {
  name: 'Trevor',
  age: 47,
  createdAt: 'yesterday',
  id: 'u1',
}

const user2: User = {
  name: 'Whatever',
  age: 15,
  createdAt: 'today',
  id: 'u2',
}

const user3: User = { name: 'Eternal', age: null, createdAt: 'now', id: 'u3' }

const store = new InMemoryStore<User, UserKey, UserQuery>({
  getItemKey: ({ id }) => id,
  filters: {
    name: {
      ...exactPredicates(({ name }) => name),
      prefix: prefixPredicate(({ name }) => name),
    },
    age: ordPredicates(({ age }) => age),
  },
  items: [user1, user2, user3],
})

test('InMemoryStore.get', async () => {
  //'returns a stored item'
  expect(await store.get('u1')).toEqual(user1)

  // 'returns undefined when asked for a non-existant key'
  expect(await store.get('dne')).toBeUndefined()
})

test('InMemoryStore.find', async () => {
  // returns a QueryResult
  expect(await store.find({})).toEqual({
    cursor: null,
    edges: [
      { cursor: 'u1', node: user1 },
      { cursor: 'u2', node: user2 },
      { cursor: 'u3', node: user3 },
    ],
    items: [user1, user2, user3],
  })

  // returns items after the provided cursor
  expect(await store.find({ cursor: 'u1' })).toEqual({
    cursor: null,
    edges: [
      { cursor: 'u2', node: user2 },
      { cursor: 'u3', node: user3 },
    ],
    items: [user2, user3],
  })

  // returns a cursor when a limit is provided and there are more items
  expect(await store.find({ limit: 1 })).toEqual({
    cursor: 'u1',
    edges: [{ cursor: 'u1', node: user1 }],
    items: [user1],
  })

  // errors when a provided cursor is invalid
  await store.find({ cursor: 'u4' }).catch(error => {
    expect(error.message).toEqual('Invalid cursor')
  })

  // filters items by equality
  expect(await store.find({ filter: { name: { eq: 'Trevor' } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'u1', node: user1 }],
    items: [user1],
  })

  // filters items by prefix
  expect(await store.find({ filter: { name: { prefix: 'Wh' } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'u2', node: user2 }],
    items: [user2],
  })

  // filters items by an ord predicate
  expect(await store.find({ filter: { age: { gt: 21 } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'u1', node: user1 }],
    items: [user1],
  })

  // filters items by multiple ord predicates
  expect(await store.find({ filter: { age: { gt: 11, lte: 15 } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'u2', node: user2 }],
    items: [user2],
  })
})

test('defaultKeyToString', () => {
  // returns the same string regardless of the order of an objects keys
  expect(defaultKeyToString({ id: 123, pk: 'abc' })).toEqual(
    defaultKeyToString({ pk: 'abc', id: 123 })
  )
})
