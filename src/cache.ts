import {
  GetItemKey,
  KeyToString,
  Query,
  QueryResult,
  Store,
  defaultKeyToString,
} from './store'

export interface CacheProxyStoreOptions<I extends {}, K, Q> {
  keyToString?: KeyToString<K>
  getItemKey: GetItemKey<I, K>
  store: Store<I, K, Q>
}

export class CacheProxyStore<I extends {}, K, Q extends Query>
  implements Store<I, K, Q> {
  cache: { [key: string]: I }
  pending: { [key: string]: Promise<I | undefined> }
  keyToString: KeyToString<K>
  getItemKey: GetItemKey<I, K>
  store: Store<I, K, Q>

  constructor(options: CacheProxyStoreOptions<I, K, Q>) {
    this.store = options.store
    this.cache = {}
    this.pending = {}
    this.getItemKey = options.getItemKey
    this.keyToString = options.keyToString || defaultKeyToString
  }

  getItemCacheKey(item: I): string {
    const key = this.getItemKey(item)
    return this.keyToString(key)
  }

  async get(key: K): Promise<I | undefined> {
    const cacheKey = this.keyToString(key)

    if (this.cache[cacheKey]) {
      return this.cache[cacheKey]
    }

    if (this.pending[cacheKey]) {
      return this.pending[cacheKey]
    }

    const itemRequest = this.store.get(key)

    this.pending[cacheKey] = itemRequest

    itemRequest.then(item => {
      if (item) this.cache[cacheKey] = item
      delete this.pending[cacheKey]
    })

    return itemRequest
  }

  async create(item: I): Promise<void> {
    const cacheKey = this.getItemCacheKey(item)
    this.cache[cacheKey] = item
    return this.store.create(item)
  }

  async update(item: I): Promise<void> {
    const cacheKey = this.getItemCacheKey(item)
    this.cache[cacheKey] = item
    return this.store.update(item)
  }

  async find(query: Q): Promise<QueryResult<I>> {
    return this.store.find(query)
  }

  async clearCache() {
    this.cache = {}
  }

  async clear() {
    this.cache = {}
    this.pending = {}
    this.store.clear()
  }

  async setup() {
    this.store.setup()
  }

  async teardown() {
    this.store.teardown()
  }
}
