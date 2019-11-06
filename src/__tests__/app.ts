import test from 'tape'
import { Projection } from '../index'

interface Post {
  id: string
  title: string
  score: number
  published: boolean
}

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

const projection = new Projection<Events, Post>({
  name: 'Post',
  key: 'id',
  handlers: {
    PostCreated: {
      init: ({ data }) => ({ published: false, ...data }),
    },
    PostPublished: {
      selectOne: ({ data: { id } }) => id,
      transform: (_, post) => ({ ...post, published: true }),
    },
    AllPostsPublished: {
      selectMany: () => ({ published: false }),
      transform: (_, post) => ({ ...post, published: true }),
    },
  },
})

const edges = [
  {
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
  },
  {
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
  },
]

const reset = () => {
  projection.edges = {}
  edges.forEach(edge => {
    projection.edges[edge.node.id] = edge
  })
}

test('projection.get', t => {
  reset()

  t.deepEqual(projection.get('p1'), edges[0], 'returns the edge by key')

  t.equal(
    projection.get('p9'),
    undefined,
    'returns undefined when there is no node with the specified key'
  )

  t.end()
})

test('projection.find', t => {
  reset()

  t.deepEqual(
    projection.find(),
    { edges, pageInfo: { cursor: null, hasMore: false } },
    'without a query returns all edges'
  )

  t.deepEqual(
    projection.find({ first: 1 }),
    {
      edges: edges.slice(0, 1),
      pageInfo: { cursor: 'p1', hasMore: true },
    },
    'with a first parameter limits the number of returned edges'
  )

  t.deepEqual(
    projection.find({ first: 5 }),
    { edges, pageInfo: { cursor: null, hasMore: false } },
    'with a first parameter greater than the amount of edges returns all edges'
  )

  t.deepEqual(
    projection.find({ first: 1, cursor: 'p1' }),
    {
      edges: edges.slice(1, 2),
      pageInfo: { cursor: null, hasMore: false },
    },
    'with a cursor skips edges until after the cursor'
  )

  t.throws(
    () => projection.find({ first: 1, cursor: 'not-a-cursor' }),
    'Invalid cursor',
    'with a malformed cursor throws an error'
  )

  t.throws(
    () => projection.find({ first: 1, cursor: 'p9' }),
    'Invalid cursor',
    'with a non existant cursor throws an error'
  )

  t.deepEqual(
    projection.find({ filter: { title: 'Who Ya?' } }),
    {
      edges: [edges[0]],
      pageInfo: { cursor: null, hasMore: false },
    },
    'with a filter parameter filters the returned edges'
  )

  t.end()
})

test('projection.handleEvent with a SingleTransformHandler', t => {
  reset()

  const updatedEdges = projection.handleEvent({
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
    projection.edges['p2'],
    expectedEdge,
    'updates the node in the projection store'
  )

  t.end()
})

test('projection.handleEvent with a ManyTransformHandler', t => {
  reset()

  const updatedEdges = projection.handleEvent({
    id: 'e3',
    name: 'AllPostsPublished',
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
    projection.edges['p2'],
    expectedEdge,
    'updates the node in the projection store'
  )

  t.end()
})

test('projection.handleEvent with an InitHandler', t => {
  reset()

  const updatedEdges = projection.handleEvent({
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
    projection.edges['p3'],
    expectedEdge,
    'adds the node to the projection store'
  )

  t.end()
})
