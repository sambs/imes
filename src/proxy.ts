import { Query, QueryResult, Store } from './store'

export class ProxyStore<I extends {}, K, Q extends Query> extends Store<
  I,
  K,
  Q
> {
  store: Store<I, K, Q>

  constructor(store: Store<I, K, Q>) {
    super()
    this.store = store
  }

  getItemKey(item: I): K {
    return this.store.getItemKey(item)
  }

  keyToString(key: K): string {
    return this.store.keyToString(key)
  }

  async get(key: K): Promise<I | undefined> {
    return this.store.get(key)
  }

  async getMany(keys: Array<K>): Promise<Array<I | undefined>> {
    return this.store.getMany(keys)
  }

  async create(item: I): Promise<void> {
    return this.store.create(item)
  }

  async update(item: I): Promise<void> {
    return this.store.update(item)
  }

  async find(query: Q): Promise<QueryResult<I>> {
    return this.store.find(query)
  }

  async clear() {
    this.store.clear()
  }

  async setup() {
    this.store.setup()
  }

  async teardown() {
    this.store.teardown()
  }
}
