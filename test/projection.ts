import test from 'tape'
import { Edge, InMemoryStore, MockProjection, Projection, Query } from '../src'

interface Events {
  PostCreated: {
    id: string
    title: string
    score: number
  }

  PostPublished: {
    id: string
  }

  AllPostsPublished: {
    data: void
  }
}

interface Post {
  id: string
  title: string
  score: number
  published: boolean
}

export type PostEdge = Edge<Post>
export type PostKey = string
export type PostQuery = Query<PostKey>

const post1 = {
  createdAt: 'yesterday',
  eventIds: ['e1'],
  node: {
    id: 'p1',
    title: 'Who Ya?',
    score: 3.4,
    published: true,
  },
  typename: 'Post',
  updatedAt: 'yesterday',
}

const post2 = {
  createdAt: 'yesterday',
  eventIds: ['e2'],
  node: {
    id: 'p2',
    title: 'Whoa Ye!',
    score: 6.2,
    published: false,
  },
  typename: 'Post',
  updatedAt: 'yesterday',
}

const postProjection = () =>
  new Projection<Events, Post, PostKey, PostQuery>({
    typename: 'Post',
    handlers: {
      PostCreated: {
        init: ({ data }) => ({ published: false, ...data }),
      },
      PostPublished: {
        selectOne: ({ data: { id } }) => id,
        transform: (_, post) => ({ ...post, published: true }),
      },
      // AllPostsPublished: {
      //   selectMany: () => ({ published: false }),
      //   transform: (_, post) => ({ ...post, published: true }),
      // },
    },
    store: new InMemoryStore({
      getItemKey: post => post.node.id,
      items: [post1, post2],
    }),
  })

test('projection.handleEvent with a SingleTransformHandler', async t => {
  const projection = postProjection()

  const updatedEdges = await projection.handleEvent({
    id: 'e3',
    name: 'PostPublished',
    data: { id: 'p2' },
    time: 'now',
  })

  const expectedEdge = {
    createdAt: 'yesterday',
    eventIds: ['e2', 'e3'],
    node: {
      id: 'p2',
      title: 'Whoa Ye!',
      score: 6.2,
      published: true,
    },
    typename: 'Post',
    updatedAt: 'now',
  }

  t.deepEqual(updatedEdges, [expectedEdge], 'returns an array of updated edges')

  t.deepEqual(
    await projection.store.read('p2'),
    expectedEdge,
    'updates the node in the projection store'
  )

  t.end()
})

// test('projection.handleEvent with a ManyTransformHandler', async t => {
//   const projection = postProjection()

//   const updatedEdges = await projection.handleEvent({
//     id: 'e3',
//     name: 'AllPostsPublished',
//     time: 'now',
//   })

//   const expectedEdge = {
//     createdAt: 'yesterday',
//     eventIds: ['e2', 'e3'],
//     node: {
//       id: 'p2',
//       title: 'Whoa Ye!',
//       score: 6.2,
//       published: true,
//     },
//     typename: 'Post',
//     updatedAt: 'now',
//   }

//   t.deepEqual(updatedEdges, [expectedEdge], 'returns an array of updated edges')

//   t.deepEqual(
//     await projection.store.read('p2'),
//     expectedEdge,
//     'updates the node in the projection store'
//   )

//   t.end()
// })

test('projection.handleEvent with an InitHandler', async t => {
  const projection = postProjection()

  const updatedEdges = await projection.handleEvent({
    id: 'e3',
    name: 'PostCreated',
    data: { id: 'p3', title: 'Keep It', score: 0 },
    time: 'now',
  })

  const expectedEdge = {
    createdAt: 'now',
    eventIds: ['e3'],
    node: {
      id: 'p3',
      title: 'Keep It',
      score: 0,
      published: false,
    },
    typename: 'Post',
    updatedAt: 'now',
  }

  t.deepEqual(updatedEdges, [expectedEdge], 'returns an array of updated edges')

  t.deepEqual(
    await projection.store.read('p3'),
    expectedEdge,
    'adds the node to the projection store'
  )

  t.end()
})

test('MockProjection.handleEvent', async t => {
  const store = new InMemoryStore<PostEdge, PostKey, PostQuery>({
    getItemKey: post => post.node.id,
    items: [post1, post2],
  })

  const projection = new MockProjection<Events, Post, PostKey, PostQuery>({
    typename: 'Post',
    store,
    updates: {
      PostCreated: [[post1]],
    },
  })

  const updates = await projection.handleEvent({
    id: 'e3',
    name: 'PostCreated',
    data: { id: 'p3', title: 'Keep It', score: 0 },
    time: 'now',
  })

  t.deepEqual(
    updates,
    [post1],
    'returns the specified updates ignoring event data'
  )

  t.end()
})
