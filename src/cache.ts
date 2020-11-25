import { Query, Store } from './store'
import { ProxyStore } from './proxy'

// Note that missing items aren't cached and will be retried
// it re-requested

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

  async put(item: I): Promise<void> {
    const cacheKey = this.getItemKeyString(item)
    this.cache[cacheKey] = item
    return super.put(item)
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

  async getMany(keys: Array<K>): Promise<Array<I | undefined>> {
    // This doesn't yet check for or register pending items

    const keysToFetch = keys.filter(key => !this.cache[this.keyToString(key)])

    if (keysToFetch.length == 1) {
      await this.get(keysToFetch[0])
    } else if (keysToFetch.length) {
      await super.getMany(keysToFetch).then(items => {
        items.forEach(item => {
          if (item) {
            const cacheKey = this.getItemKeyString(item)
            this.cache[cacheKey] = item
          }
        })
      })
    }

    return keys
      .map(key => this.keyToString(key))
      .map(cacheKey => this.cache[cacheKey])
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
