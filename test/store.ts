import test from 'tape'

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

test('InMemoryStore.get', async t => {
  t.deepEqual(await store.get('u1'), user1, 'returns a stored item')

  t.equal(
    await store.get('dne'),
    undefined,
    'returns undefined when asked for a non-existant key'
  )

  t.end()
})

test('InMemoryStore.find', async t => {
  t.deepEqual(
    await store.find({}),
    {
      cursor: null,
      edges: [
        { cursor: 'u1', node: user1 },
        { cursor: 'u2', node: user2 },
        { cursor: 'u3', node: user3 },
      ],
      items: [user1, user2, user3],
    },
    'returns a QueryResult'
  )

  t.deepEqual(
    await store.find({ cursor: 'u1' }),
    {
      cursor: null,
      edges: [
        { cursor: 'u2', node: user2 },
        { cursor: 'u3', node: user3 },
      ],
      items: [user2, user3],
    },
    'returns items after the provided cursor'
  )

  t.deepEqual(
    await store.find({ limit: 1 }),
    {
      cursor: 'u1',
      edges: [{ cursor: 'u1', node: user1 }],
      items: [user1],
    },
    'returns a cursor when a limit is provided and there are more items'
  )

  await store.find({ cursor: 'u4' }).catch(error => {
    t.equal(
      error.message,
      'Invalid cursor',
      'errors when a provided cursor is invalid'
    )
  })

  t.deepEqual(
    await store.find({ filter: { name: { eq: 'Trevor' } } }),
    {
      cursor: null,
      edges: [{ cursor: 'u1', node: user1 }],
      items: [user1],
    },
    'filters items by equality'
  )

  t.deepEqual(
    await store.find({ filter: { name: { prefix: 'Wh' } } }),
    {
      cursor: null,
      edges: [{ cursor: 'u2', node: user2 }],
      items: [user2],
    },
    'filters items by prefix'
  )

  t.deepEqual(
    await store.find({ filter: { age: { gt: 21 } } }),
    {
      cursor: null,
      edges: [{ cursor: 'u1', node: user1 }],
      items: [user1],
    },
    'filters items by an ord predicate'
  )

  t.deepEqual(
    await store.find({ filter: { age: { gt: 11, lte: 15 } } }),
    {
      cursor: null,
      edges: [{ cursor: 'u2', node: user2 }],
      items: [user2],
    },
    'filters items by multiple ord predicates'
  )

  t.end()
})

test('defaultKeyToString', t => {
  t.equal(
    defaultKeyToString({ id: 123, pk: 'abc' }),
    defaultKeyToString({ pk: 'abc', id: 123 }),
    'returns the same string regardless of the order of an objects keys'
  )
  t.end()
})
