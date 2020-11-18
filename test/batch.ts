import { BatchProxyStore } from '../src'
import { PostStore, posts } from './setup'

const setup = () => {
  const wrapped = new PostStore()
  const store = wrapped.wrap(BatchProxyStore)
  return { store, wrapped }
}

test('BatchProxyStore.get - proxies a single request', async () => {
  const { store, wrapped } = setup()
  wrapped.get = jest.fn(() => Promise.resolve(posts.p1))
  expect(await store.get('p1')).toEqual(posts.p1)
})

test('BatchProxyStore.get - batches multiple requests', async () => {
  const { store, wrapped } = setup()
  wrapped.getMany = jest.fn(() => Promise.resolve([posts.p1, posts.p2]))
  const results = await Promise.all([store.get('p1'), store.get('p2')])
  expect(results).toEqual([posts.p1, posts.p2])
  expect(wrapped.getMany).toHaveBeenCalledWith(['p1', 'p2'])
})

test('BatchProxyStore.get - dedupes multiple requests for the same key', async () => {
  const { store, wrapped } = setup()
  wrapped.get = jest.fn(() => Promise.resolve(posts.p1))
  const results = await Promise.all([store.get('p1'), store.get('p1')])
  expect(results).toEqual([posts.p1, posts.p1])
  expect(wrapped.get).toHaveBeenCalledWith('p1')
})
