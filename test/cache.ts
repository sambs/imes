import { CacheProxyStore } from '../src'
import { PostStore, posts } from './setup'

const setup = () => {
  const wrapped = new PostStore()
  const store = wrapped.wrap(CacheProxyStore)
  return { store, wrapped }
}

test('CacheProxyStore.put', async () => {
  const { store, wrapped } = setup()

  // Calls put
  wrapped.put = jest.fn()
  await store.put(posts.p1)
  expect(wrapped.put).toHaveBeenCalledWith(posts.p1)

  // Populates the cache
  wrapped.get = jest.fn()
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(wrapped.get).not.toBeCalled()
})

test('CacheProxyStore.get', async () => {
  const { store, wrapped } = setup()

  // Calls get when uncached
  wrapped.get = jest.fn(() => Promise.resolve(posts.p1))
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(wrapped.get).toHaveBeenCalledWith('p1')

  // Use the cache
  wrapped.get = jest.fn()
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(wrapped.get).not.toBeCalled()

  // Avoids duplicate requests to the same key
  wrapped.get = jest.fn(
    () => new Promise(resolve => setTimeout(() => resolve(posts.p2), 5))
  )
  const results = await Promise.all([store.get('p1'), store.get('p2')])
  expect(results).toEqual([posts.p1, posts.p2])
  expect(wrapped.get).toHaveBeenCalledTimes(1)
})

test('CacheProxyStore.getMany', async () => {
  const { store, wrapped } = setup()

  // Prime the cache
  wrapped.get = jest.fn(() => Promise.resolve(posts.p2))
  await store.get('p2')

  // Use the cache and makes a call for others
  wrapped.getMany = jest.fn(() => Promise.resolve([posts.p1, posts.p3]))
  expect(await store.getMany(['p1', 'p2', 'p3', 'dne'])).toEqual([
    posts.p1,
    posts.p2,
    posts.p3,
    undefined,
  ])
  expect(wrapped.getMany).toHaveBeenCalledWith(['p1', 'p3', 'dne'])

  // Caches returned items
  wrapped.get = jest.fn()
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(wrapped.get).not.toBeCalled()

  store.clearCache()

  // Uses get rather than getMany with one key
  wrapped.get = jest.fn(() => Promise.resolve(posts.p1))
  wrapped.getMany = jest.fn()
  expect(await store.getMany(['p1'])).toEqual([posts.p1])
  expect(wrapped.get).toHaveBeenCalledWith('p1')
  expect(wrapped.getMany).not.toBeCalled()

  // Uses get one when called with only one uncached key
  wrapped.get = jest.fn(() => Promise.resolve(undefined))
  wrapped.getMany = jest.fn()
  expect(await store.getMany(['p1', 'dne'])).toEqual([posts.p1, undefined])
  expect(wrapped.get).toHaveBeenCalledWith('dne')
  expect(wrapped.getMany).not.toBeCalled()
})

test('CacheProxyStore.clearCache', async () => {
  const { store, wrapped } = setup()
  wrapped.get = jest.fn(() => Promise.resolve(posts.p1))
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(await store.get('p1')).toEqual(posts.p1)
  store.clearCache()
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(wrapped.get).toHaveBeenCalledTimes(2)
})
