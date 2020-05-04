import test from 'tape'
import { InMemoryStore, MockProjection } from '../src'

import {
  EventTypes,
  EventMeta,
  EventKey,
  Post,
  PostQuery,
  PostStore,
  PostProjection,
} from './setup'

const post1: Post = {
  data: {
    title: 'Who Ya?',
    score: 3.4,
    published: true,
  },
  meta: {
    createdAt: 'yesterday',
    createdBy: 'u1',
    eventKeys: ['e1'],
    updatedAt: 'yesterday',
    updatedBy: 'u1',
  },
  key: 'p1',
}

const post2 = {
  data: {
    title: 'Whoa Ye!',
    score: 6.2,
    published: false,
  },
  meta: {
    createdAt: 'yesterday',
    createdBy: 'u2',
    eventKeys: ['e2'],
    updatedAt: 'yesterday',
    updatedBy: 'u2',
  },
  key: 'p2',
}

test('projection.handleEvent with a SingleTransformHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.handleEvent({
    key: 'e3',
    data: { id: 'p2' },
    meta: {
      name: 'PostPublished',
      time: 'now',
      actorId: 'u1',
    },
  })

  const expectedItem = {
    data: {
      title: 'Whoa Ye!',
      score: 6.2,
      published: true,
    },
    meta: {
      createdAt: 'yesterday',
      createdBy: 'u2',
      eventKeys: ['e2', 'e3'],
      updatedAt: 'now',
      updatedBy: 'u1',
    },
    key: 'p2',
  }

  t.deepEqual(updatedItems, [expectedItem], 'returns an array of updated Items')

  t.deepEqual(
    await projection.store.read('p2'),
    expectedItem,
    'updates the node in the projection store'
  )

  t.end()
})

test('projection.handleEvent with a ManyTransformHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.handleEvent({
    data: undefined,
    meta: {
      name: 'AllPostsPublished',
      time: 'now',
      actorId: 'u1',
    },
    key: 'e3',
  })

  const expectedItem = {
    data: {
      title: 'Whoa Ye!',
      score: 6.2,
      published: true,
    },
    meta: {
      createdAt: 'yesterday',
      createdBy: 'u2',
      eventKeys: ['e2', 'e3'],
      updatedAt: 'now',
      updatedBy: 'u1',
    },
    key: 'p2',
  }

  t.deepEqual(updatedItems, [expectedItem], 'returns an array of updated Items')

  t.deepEqual(
    await projection.store.read('p2'),
    expectedItem,
    'updates the node in the projection store'
  )

  t.end()
})

test('projection.handleEvent with an InitHandler', async t => {
  const store = new PostStore({ items: [post1, post2] })
  const projection = new PostProjection({ store })

  const updatedItems = await projection.handleEvent({
    data: { id: 'p3', title: 'Keep It' },
    meta: {
      name: 'PostCreated',
      time: 'now',
      actorId: 'u1',
    },
    key: 'e3',
  })

  const expectedItem = {
    data: {
      title: 'Keep It',
      score: 0,
      published: false,
    },
    meta: {
      createdAt: 'now',
      createdBy: 'u1',
      eventKeys: ['e3'],
      updatedAt: 'now',
      updatedBy: 'u1',
    },
    key: 'p3',
  }

  t.deepEqual(updatedItems, [expectedItem], 'returns an array of updated Items')

  t.deepEqual(
    await projection.store.read('p3'),
    expectedItem,
    'adds the node to the projection store'
  )

  t.end()
})

test('MockProjection.handleEvent', async t => {
  const store = new InMemoryStore<Post, PostQuery>({
    items: [post1, post2],
  })

  const projection = new MockProjection<
    EventTypes,
    EventMeta,
    EventKey,
    Post,
    PostQuery
  >({
    updates: {
      PostCreated: [[post1]],
    },
    store,
  })

  const updates = await projection.handleEvent({
    key: 'e3',
    data: { id: 'p3', title: 'Keep It' },
    meta: {
      name: 'PostCreated',
      time: 'now',
      actorId: 'u1',
    },
  })

  t.deepEqual(
    updates,
    [post1],
    'returns the specified updates ignoring event data'
  )

  t.end()
})
