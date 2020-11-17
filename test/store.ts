import { PostStore, posts } from './setup'

const store = new PostStore({
  items: [posts.p1, posts.p2, posts.p3],
})

test('InMemoryStore.get', async () => {
  //'returns a stored item'
  expect(await store.get('p1')).toEqual(posts.p1)

  // 'returns undefined when asked for a non-existant key'
  expect(await store.get('dne')).toBeUndefined()
})

test('InMemoryStore.find', async () => {
  // returns a QueryResult
  expect(await store.find({})).toEqual({
    cursor: null,
    edges: [
      { cursor: 'p1', node: posts.p1 },
      { cursor: 'p2', node: posts.p2 },
      { cursor: 'p3', node: posts.p3 },
    ],
    items: [posts.p1, posts.p2, posts.p3],
  })

  // returns items after the provided cursor
  expect(await store.find({ cursor: 'p1' })).toEqual({
    cursor: null,
    edges: [
      { cursor: 'p2', node: posts.p2 },
      { cursor: 'p3', node: posts.p3 },
    ],
    items: [posts.p2, posts.p3],
  })

  // returns a cursor when a limit is provided and there are more items
  expect(await store.find({ limit: 1 })).toEqual({
    cursor: 'p1',
    edges: [{ cursor: 'p1', node: posts.p1 }],
    items: [posts.p1],
  })

  // errors when a provided cursor is invalid
  await store.find({ cursor: 'u4' }).catch(error => {
    expect(error.message).toEqual('Invalid cursor')
  })

  // filters items by equality
  expect(await store.find({ filter: { published: { eq: false } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'p2', node: posts.p2 }],
    items: [posts.p2],
  })

  // filters items by prefix
  expect(await store.find({ filter: { title: { prefix: 'Wh' } } })).toEqual({
    cursor: null,
    edges: [
      { cursor: 'p1', node: posts.p1 },
      { cursor: 'p2', node: posts.p2 },
    ],
    items: [posts.p1, posts.p2],
  })

  // filters items by an ord predicate
  expect(await store.find({ filter: { score: { gt: 6 } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'p2', node: posts.p2 }],
    items: [posts.p2],
  })

  // filters items by multiple ord predicates
  expect(await store.find({ filter: { score: { gt: 5, lte: 6 } } })).toEqual({
    cursor: null,
    edges: [{ cursor: 'p3', node: posts.p3 }],
    items: [posts.p3],
  })
})

test('store.keyToString', () => {
  // returns the same string regardless of the order of an objects keys
  // @ts-ignore
  expect(store.keyToString({ id: 123, pk: 'abc' })).toEqual(
    // @ts-ignore
    store.keyToString({ pk: 'abc', id: 123 })
  )
})
