import test from 'tape'
import { Post, PostStore, PostProjection } from './setup'

const post1: Post = {
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

const post2: Post = {
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

test('projection.writeUpdates with a SingleTransformHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.writeUpdates({
    id: 'e3',
    payload: { id: 'p2' },
    name: 'PostPublished',
    time: 'now',
    actorId: 'u1',
  })

  const expectedItem = {
    title: 'Whoa Ye!',
    score: 6.2,
    published: true,
    createdAt: 'yesterday',
    createdBy: 'u2',
    eventIds: ['e2', 'e3'],
    updatedAt: 'now',
    updatedBy: 'u1',
    id: 'p2',
  }

  t.deepEqual(
    updatedItems,
    [{ previous: post2, current: expectedItem }],
    'returns an array of updated items'
  )

  t.deepEqual(
    await projection.store.get('p2'),
    expectedItem,
    'updates the item in the projection store'
  )

  t.end()
})

test('projection.writeUpdates with a ManyTransformHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.writeUpdates({
    payload: undefined,
    name: 'AllPostsPublished',
    time: 'now',
    actorId: 'u1',
    id: 'e3',
  })

  const expectedItem = {
    title: 'Whoa Ye!',
    score: 6.2,
    published: true,
    createdAt: 'yesterday',
    createdBy: 'u2',
    eventIds: ['e2', 'e3'],
    updatedAt: 'now',
    updatedBy: 'u1',
    id: 'p2',
  }

  t.deepEqual(
    updatedItems,
    [{ previous: post2, current: expectedItem }],
    'returns an array of updated items'
  )

  t.deepEqual(
    await projection.store.get('p2'),
    expectedItem,
    'updates the item in the projection store'
  )

  t.end()
})

test('projection.writeUpdates with an InitHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.writeUpdates({
    payload: { id: 'p3', title: 'Keep It' },
    name: 'PostCreated',
    time: 'now',
    actorId: 'u1',
    id: 'e3',
  })

  const expectedItem = {
    title: 'Keep It',
    score: 0,
    published: false,
    createdAt: 'now',
    createdBy: 'u1',
    eventIds: ['e3'],
    updatedAt: 'now',
    updatedBy: 'u1',
    id: 'p3',
  }

  t.deepEqual(
    updatedItems,
    [{ current: expectedItem }],
    'returns an array of updated items'
  )

  t.deepEqual(
    await projection.store.get('p3'),
    expectedItem,
    'creates the item in the projection store'
  )

  t.end()
})

test('projection.getUpdates with an InitHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.getUpdates({
    payload: { id: 'p3', title: 'Keep It' },
    name: 'PostCreated',
    time: 'now',
    actorId: 'u1',
    id: 'e3',
  })

  const expectedItem = {
    title: 'Keep It',
    score: 0,
    published: false,
    createdAt: 'now',
    createdBy: 'u1',
    eventIds: ['e3'],
    updatedAt: 'now',
    updatedBy: 'u1',
    id: 'p3',
  }

  t.deepEqual(
    updatedItems,
    [{ current: expectedItem }],
    'returns an array of updated items'
  )

  t.deepEqual(
    await projection.store.get('p3'),
    undefined,
    'does not persit the item in the projection store'
  )

  t.end()
})
