import test from 'tape'
import { InMemoryStore, Query } from '../src'

interface User {
  id: string
  name: string
}

type UserKey = string

interface UserQuery extends Query<UserKey> {
  filter?: {
    name?: string
  }
}

const getItemKey = (user: User) => user.id

const user1: User = {
  id: 'u1',
  name: 'Trevor',
}

const user2: User = {
  id: 'u2',
  name: 'Whatever',
}

const store = new InMemoryStore<User, UserKey, UserQuery>({
  getItemKey,
  getFilterPredicates: function*({ filter }) {
    if (filter && filter.name !== undefined) {
      yield item => item.name == filter.name
    }
  },
  items: [user1, user2],
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
  t.plan(5)

  t.deepEqual(
    await store.find({}),
    { items: [user1, user2], cursor: null },
    'returns a QueryResult'
  )

  t.deepEqual(
    await store.find({ cursor: 'u1' }),
    { items: [user2], cursor: null },
    'returns items after the provided cursor'
  )

  t.deepEqual(
    await store.find({ limit: 1 }),
    { items: [user1], cursor: 'u1' },
    'returns a cursor when a limit is provided and there are more items'
  )

  await store.find({ cursor: 'u3' }).catch(error => {
    t.equal(
      error.message,
      'Invalid cursor',
      'errors when a provided cursor is invalid'
    )
  })

  t.deepEqual(
    await store.find({ filter: { name: 'Trevor' } }),
    { items: [user1], cursor: null },
    'uses the filterPredicate'
  )
})
