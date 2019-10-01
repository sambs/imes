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
      transform: ({ data }) => ({ published: false, ...data }),
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

const nodes = [
  {
    id: 'p1',
    title: 'Who Ya?',
    score: 3.4,
    published: true,
    __typename: 'Post',
  },
  {
    id: 'p2',
    title: 'Whoa Ye!',
    score: 6.2,
    published: false,
    __typename: 'Post',
  },
]

const reset = () => {
  projection.nodes = {}
  nodes.forEach(node => {
    projection.nodes[node.id] = node
  })
}

test('projection.get', t => {
  reset()

  t.deepEqual(projection.get('p1'), nodes[0], 'returns the node by key')

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
    { nodes, pageInfo: { cursor: null, hasMore: false } },
    'without a query returns all nodes'
  )

  t.deepEqual(
    projection.find({ first: 1 }),
    {
      nodes: nodes.slice(0, 1),
      pageInfo: { cursor: 'p1', hasMore: true },
    },
    'with a first parameter limits the number of returned nodes'
  )

  t.deepEqual(
    projection.find({ first: 5 }),
    { nodes, pageInfo: { cursor: null, hasMore: false } },
    'with a first parameter greater than the amount of nodes returns all nodes'
  )

  t.deepEqual(
    projection.find({ first: 1, cursor: 'p1' }),
    {
      nodes: nodes.slice(1, 2),
      pageInfo: { cursor: null, hasMore: false },
    },
    'with a cursor skips nodes until after the cursor'
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
      nodes: [nodes[0]],
      pageInfo: { cursor: null, hasMore: false },
    },
    'with a filter parameter filters the returned nodes'
  )

  t.end()
})

test('projection.handleEvent where the handler has a selectOne parameter', t => {
  reset()

  const updatedNodes = projection.handleEvent({
    name: 'PostPublished',
    data: { id: 'p2' },
  })
  const expectedNode = {
    id: 'p2',
    title: 'Whoa Ye!',
    score: 6.2,
    published: true,
    __typename: 'Post',
  }

  t.deepEqual(updatedNodes, [expectedNode], 'returns an array of updated nodes')

  t.deepEqual(
    projection.nodes['p2'],
    expectedNode,
    'updates the node in the projection store'
  )

  t.end()
})

test('projection.handleEvent where the handler has a selectMany parameter', t => {
  reset()

  const updatedNodes = projection.handleEvent({ name: 'AllPostsPublished' })
  const expectedNode = {
    id: 'p2',
    title: 'Whoa Ye!',
    score: 6.2,
    published: true,
    __typename: 'Post',
  }

  t.deepEqual(updatedNodes, [expectedNode], 'returns an array of updated nodes')

  t.deepEqual(
    projection.nodes['p2'],
    expectedNode,
    'updates the node in the projection store'
  )

  t.end()
})

test('projection.handleEvent where the handler has neither select parameter', t => {
  reset()

  const updatedNodes = projection.handleEvent({
    name: 'PostCreated',
    data: { id: 'p3', title: 'Keep It', score: 0 },
  })

  const expectedNode = {
    id: 'p3',
    title: 'Keep It',
    score: 0,
    published: false,
    __typename: 'Post',
  }

  t.deepEqual(updatedNodes, [expectedNode], 'returns an array of updated nodes')

  t.deepEqual(
    projection.nodes['p3'],
    expectedNode,
    'adds the node to the projection store'
  )

  t.end()
})
