import { CacheProxyStore } from '../src'
import { PostStore, posts } from './setup'

const setup = () => {
  const wrapped = new PostStore()
  const store = new CacheProxyStore({ store: wrapped })
  return { store, wrapped }
}

test('CacheProxyStore.create', async () => {
  const { store, wrapped } = setup()

  // Calls _create
  wrapped.create = jest.fn()
  await store.create(posts.p1)
  expect(wrapped.create).toHaveBeenCalledWith(posts.p1)

  // Populates the cache
  wrapped.get = jest.fn()
  expect(await store.get('p1')).toEqual(posts.p1)
  expect(wrapped.get).not.toBeCalled()
})

test('CacheProxyStore.update', async () => {
  const { store, wrapped } = setup()

  // Calls update
  wrapped.update = jest.fn()
  await store.update(posts.p1)
  expect(wrapped.update).toHaveBeenCalledWith(posts.p1)

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
  const request1 = store.get('p2')
  const request2 = store.get('p2')
  expect(await request1).toEqual(posts.p2)
  expect(await request2).toEqual(posts.p2)
  expect(wrapped.get).toHaveBeenCalledTimes(1)
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
