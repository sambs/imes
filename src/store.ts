import deepEqual from 'deep-equal'
import sortKeys from 'sort-keys'
import { ProxyStore } from './proxy'

export interface Query {
  cursor?: string | null
  limit?: number
  filter?: QueryFilterFields
}

export type QueryFilterFields = {
  [field: string]: QueryFilterField | undefined
}

export type QueryFilterField = {
  [operator: string]: any
}

export interface QueryResult<I extends {}> {
  edges: Array<{ cursor: string; node: I }>
  items: Array<I>
  cursor: string | null
}

type FilterFieldPredicates<I, Q extends Query, F = Required<Q['filter']>> = {
  [N in keyof F]: FieldPredicates<I, F[N]>
}

type FieldPredicates<I, N extends { [comparator: string]: any }> = {
  [O in keyof Required<N>]: FieldPredicate<I, Exclude<N[O], undefined>>
}

type FieldPredicate<I, T> = (v: T) => (item: I) => boolean

export abstract class Store<I extends {}, K, Q extends Query = Query> {
  abstract getItemKey(item: I): K

  keyToString(key: K): string {
    if (typeof key == 'string') return key
    else return JSON.stringify(sortKeys(key))
  }

  getItemKeyString(item: I): string {
    const key = this.getItemKey(item)
    return this.keyToString(key)
  }

  abstract put(item: I): Promise<void>

  abstract get(key: K): Promise<I | undefined>

  async getMany(keys: Array<K>): Promise<Array<I | undefined>> {
    return Promise.all(keys.map(key => this.get(key)))
  }

  abstract find(query: Q): Promise<QueryResult<I>>

  abstract clear(): Promise<void>

  abstract setup(): Promise<void>

  abstract teardown(): Promise<void>

  wrap<P extends ProxyStore<I, K, Q>>(
    ProxyClass: ProxyStoreConstructor<I, K, Q, P>
  ): P {
    return new ProxyClass(this)
  }
}

type ProxyStoreConstructor<I, K, Q, P extends ProxyStore<I, K, Q>> = new (
  store: Store<I, K, Q>
) => P

export interface InMemoryStoreOptions<I extends {}, K, Q> {
  filters: FilterFieldPredicates<I, Q>
  getItemKey: (item: I) => K
  keyToString?: (key: K) => string
  items?: Array<I>
}

export class InMemoryStore<I extends {}, K, Q extends Query> extends Store<
  I,
  K,
  Q
> {
  filters: FilterFieldPredicates<I, Q>
  getItemKey: (item: I) => K
  items: { [key: string]: I }

  constructor(options: InMemoryStoreOptions<I, K, Q>) {
    super()
    this.filters = options.filters
    this.getItemKey = options.getItemKey

    if (options.keyToString) {
      this.keyToString = options.keyToString
    }

    this.items = {}

    if (options.items) {
      options.items.forEach(item => {
        const key = this.getItemKeyString(item)
        this.items[key] = item
      })
    }
  }

  async put(item: I): Promise<void> {
    const key = this.getItemKeyString(item)
    this.items[key] = item
  }

  async get(key: K): Promise<I | undefined> {
    return this.items[this.keyToString(key)]
  }

  async getMany(keys: Array<K>): Promise<Array<I | undefined>> {
    return keys.map(key => this.items[this.keyToString(key)])
  }

  async find(query: Q): Promise<QueryResult<I>> {
    let items = Object.values(this.items)

    if (query.filter) {
      for (const field in this.filters) {
        if (query.filter[field]) {
          for (const operator in this.filters[field]) {
            if (operator in query.filter[field]!) {
              items = items.filter(
                this.filters[field][operator](query.filter[field]![operator])
              )
            }
          }
        }
      }
    }

    return this.paginateItems(items, query.cursor || null, query.limit)
  }

  protected paginateItems(
    items: Array<I>,
    cursor: string | null,
    limit?: number
  ) {
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

    const hasMore = typeof limit == 'number' && items.length > limit

    if (hasMore) {
      items = items.slice(0, limit)
    }

    const edges = items.map(item => ({
      cursor: this.getItemKeyString(item),
      node: item,
    }))

    if (hasMore) {
      cursor = edges.slice(-1)[0].cursor
    }

    return { cursor, edges, items }
  }

  async clear() {
    this.items = {}
  }

  async setup() {}

  async teardown() {}
}
