import deepEqual from 'deep-equal'

export interface Store<I, K> {
  read(key: K): Promise<I | undefined>
  write(item: I): Promise<void>
}

export interface QueryableStore<I, K, Q extends Query<K>> extends Store<I, K> {
  find(query: Q): Promise<QueryResult<I, K>>
}

export interface Query<K> {
  cursor?: K
  limit?: number
}

export interface QueryResult<I, K> {
  items: Array<I>
  cursor: K | null
}

export type GetItemKey<I, K> = (item: I) => K
export type KeyToString<K> = (key: K) => string

export const defaultKeyToString = (key: any) => {
  if (typeof key == 'string') return key
  else return JSON.stringify(key)
}

export interface InMemoryStoreOptions<I, K> {
  items?: Array<I>
  getItemKey: GetItemKey<I, K>
  keyToString?: KeyToString<K>
}

export class InMemoryStore<I, K, Q extends Query<K>>
  implements QueryableStore<I, K, Q> {
  items: { [key: string]: I }
  getItemKey: GetItemKey<I, K>
  keyToString: KeyToString<K>

  constructor(options: InMemoryStoreOptions<I, K>) {
    this.items = {}
    this.getItemKey = options.getItemKey
    this.keyToString = options.keyToString || defaultKeyToString

    if (options.items) {
      options.items.forEach(item => {
        const key = this.keyToString(this.getItemKey(item))
        this.items[key] = item
      })
    }
  }

  read(key: K): Promise<I | undefined> {
    return Promise.resolve(this.items[this.keyToString(key)])
  }

  write(item: I): Promise<void> {
    const key = this.keyToString(this.getItemKey(item))
    this.items[key] = item
    return Promise.resolve()
  }

  find(query: Q): Promise<QueryResult<I, K>> {
    let cursor: K | null = null
    let items = Object.values(this.items)

    if (query.cursor) {
      let found = false
      while (!found && items.length) {
        found = deepEqual(this.getItemKey(items[0]), query.cursor)
        items.shift()
      }
      if (!found) {
        return Promise.reject(new Error('Invalid cursor'))
      }
    }

    if ('limit' in query && items.length > query.limit!) {
      cursor = this.getItemKey(items[query.limit! - 1])
      items = items.slice(0, query.limit)
    }

    return Promise.resolve({ items, cursor })
  }
}
