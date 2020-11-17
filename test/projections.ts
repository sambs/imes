import { PostStore, PostProjection, posts } from './setup'

test('projection.writeUpdates with a SingleTransformHandler', async () => {
  const store = new PostStore({ items: [posts.p1, posts.p2] })
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

  // returns an array of updated items
  expect(updatedItems).toEqual([{ previous: posts.p2, current: expectedItem }])

  // updates the item in the projection store
  expect(await projection.store.get('p2')).toEqual(expectedItem)
})

test('projection.writeUpdates with a ManyTransformHandler', async () => {
  const store = new PostStore({ items: [posts.p1, posts.p2] })
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

  // returns an array of updated items
  expect(updatedItems).toEqual([{ previous: posts.p2, current: expectedItem }])

  // updates the item in the projection store
  expect(await projection.store.get('p2')).toEqual(expectedItem)
})

test('projection.writeUpdates with an InitHandler', async () => {
  const store = new PostStore({ items: [posts.p1, posts.p2] })
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

  // returns an array of updated items
  expect(updatedItems).toEqual([{ current: expectedItem }])

  // creates the item in the projection store
  expect(await projection.store.get('p3')).toEqual(expectedItem)
})

test('projection.getUpdates with an InitHandler', async () => {
  const store = new PostStore({ items: [posts.p1, posts.p2] })
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

  // returns an array of updated items
  expect(updatedItems).toEqual([{ current: expectedItem }])

  // does not persit the item in the projection store
  expect(await projection.store.get('p3')).toBeUndefined()
})
