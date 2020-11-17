import { Query, Store } from './store'
import { ProxyStore } from './proxy'

export class CacheProxyStore<
  I extends {},
  K,
  Q extends Query
> extends ProxyStore<I, K, Q> {
  cache: { [key: string]: I }
  pending: { [key: string]: Promise<I | undefined> }

  constructor(store: Store<I, K, Q>) {
    super(store)
    this.cache = {}
    this.pending = {}
  }

  async get(key: K): Promise<I | undefined> {
    const cacheKey = this.keyToString(key)

    if (this.cache[cacheKey]) {
      return this.cache[cacheKey]
    }

    if (this.pending[cacheKey]) {
      return this.pending[cacheKey]
    }

    const itemRequest = super.get(key)

    this.pending[cacheKey] = itemRequest

    itemRequest.then(item => {
      if (item) this.cache[cacheKey] = item
      delete this.pending[cacheKey]
    })

    return itemRequest
  }

  async create(item: I): Promise<void> {
    const cacheKey = this.getItemKeyString(item)
    this.cache[cacheKey] = item
    return super.create(item)
  }

  async update(item: I): Promise<void> {
    const cacheKey = this.getItemKeyString(item)
    this.cache[cacheKey] = item
    return super.update(item)
  }

  async clearCache() {
    this.cache = {}
  }

  async clear() {
    this.cache = {}
    this.pending = {}
    super.clear()
  }
}
