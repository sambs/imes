import test from 'tape'

import {
  ComparisonFilter,
  EqualFilter,
  InMemoryStore,
  PrefixFilter,
  Query,
  comparisonPredicate,
  equalPredicate,
  prefixPredicate,
} from '../src'

interface User {
  id: string
  name: string
  age: number | null
}

type UserKey = string

interface UserQuery extends Query<UserKey> {
  filter?: {
    name?: EqualFilter<string> & PrefixFilter
    age?: ComparisonFilter<number>
  }
}

const getItemKey = (user: User) => user.id

const user1: User = {
  id: 'u1',
  name: 'Trevor',
  age: 47,
}

const user2: User = {
  id: 'u2',
  name: 'Whatever',
  age: 15,
}

const user3: User = {
  id: 'u3',
  name: 'Eternal',
  age: null,
}

const store = new InMemoryStore<User, UserKey, UserQuery>({
  getItemKey,
  getFilterPredicates: function*({ filter }) {
    if (filter) {
      if (filter.name !== undefined) {
        yield item => equalPredicate(filter.name!)(item.name)
        yield item => prefixPredicate(filter.name!)(item.name)
      }
      if (filter.age !== undefined) {
        yield item => comparisonPredicate(filter.age!)(item.age)
      }
    }
  },
  items: [user1, user2, user3],
})

test('InMemoryStore.read', async t => {
  t.deepEqual(await store.read('u1'), user1, 'returns a stored item')

  t.equal(
    await store.read('dne'),
    undefined,
    'returns undefined when asked for a non-existant key'
  )

  t.end()
})

test('InMemoryStore.find', async t => {
  t.deepEqual(
    await store.find({}),
    { items: [user1, user2, user3], cursor: null },
    'returns a QueryResult'
  )

  t.deepEqual(
    await store.find({ cursor: 'u1' }),
    { items: [user2, user3], cursor: null },
    'returns items after the provided cursor'
  )

  t.deepEqual(
    await store.find({ limit: 1 }),
    { items: [user1], cursor: 'u1' },
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
    { items: [user1], cursor: null },
    'filters items by equality'
  )

  t.deepEqual(
    await store.find({ filter: { name: { prefix: 'Wh' } } }),
    { items: [user2], cursor: null },
    'filters items by prefix'
  )

  t.deepEqual(
    await store.find({ filter: { age: { gt: 21 } } }),
    { items: [user1], cursor: null },
    'filters items by a size predicate'
  )

  t.deepEqual(
    await store.find({ filter: { age: { gt: 11, lte: 15 } } }),
    { items: [user2], cursor: null },
    'filters items by a multiple size predicates'
  )

  t.end()
})
