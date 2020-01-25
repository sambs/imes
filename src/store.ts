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

export type FilterPredicate<I> = (item: I) => boolean

export type GetFilterPredicates<I, Q> = (
  query: Q
) => Iterable<FilterPredicate<I>>

export const defaultKeyToString = (key: any) => {
  if (typeof key == 'string') return key
  else return JSON.stringify(key)
}

export interface InMemoryStoreOptions<I, K, Q> {
  items?: Array<I>
  getFilterPredicates?: GetFilterPredicates<I, Q>
  getItemKey: GetItemKey<I, K>
  keyToString?: KeyToString<K>
}

export class InMemoryStore<I, K, Q extends Query<K>>
  implements QueryableStore<I, K, Q> {
  items: { [key: string]: I }
  getItemKey: GetItemKey<I, K>
  keyToString: KeyToString<K>

  constructor(options: InMemoryStoreOptions<I, K, Q>) {
    this.items = {}

    this.getItemKey = options.getItemKey
    this.keyToString = options.keyToString || defaultKeyToString

    if (options.getFilterPredicates)
      this.getFilterPredicates = options.getFilterPredicates

    if (options.items) {
      options.items.forEach(item => {
        const key = this.keyToString(this.getItemKey(item))
        this.items[key] = item
      })
    }
  }

  async read(key: K): Promise<I | undefined> {
    return this.items[this.keyToString(key)]
  }

  async write(item: I): Promise<void> {
    const key = this.keyToString(this.getItemKey(item))
    this.items[key] = item
  }

  async find(query: Q): Promise<QueryResult<I, K>> {
    let items = Object.values(this.items)

    const filterPredicates = Array.from(this.getFilterPredicates(query))

    if (filterPredicates.length) {
      items = items.filter(item =>
        filterPredicates.reduce(
          (pass: boolean, predicate) => pass && predicate(item),
          true
        )
      )
    }

    return this.paginateItems(items, query.cursor || null, query.limit)
  }

  getFilterPredicates(_query: Q): Iterable<FilterPredicate<I>> {
    return []
  }

  protected paginateItems(items: Array<I>, cursor: K | null, limit?: number) {
    if (cursor) {
      let found = false
      while (!found && items.length) {
        found = deepEqual(this.getItemKey(items[0]), cursor)
        items.shift()
      }
      if (!found) {
        throw new Error('Invalid cursor')
      }
      cursor = null
    }

    if (typeof limit == 'number' && items.length > limit) {
      items = items.slice(0, limit)
      cursor = items.length ? this.getItemKey(items.slice(-1)[0]) : null
    }

    return { items, cursor }
  }
}
