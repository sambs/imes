import { Query, QueryResult, Store } from './store'

export class ProxyStore<I extends {}, K, Q extends Query>
  implements Store<I, K, Q> {
  store: Store<I, K, Q>

  constructor(store: Store<I, K, Q>) {
    this.store = store
  }

  getItemKey(item: I): K {
    return this.store.getItemKey(item)
  }

  async get(key: K): Promise<I | undefined> {
    return this.store.get(key)
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
