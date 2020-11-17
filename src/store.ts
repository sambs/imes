import deepEqual from 'deep-equal'
import sortKeys from 'sort-keys'

export interface Store<I extends {}, K, Q extends Query = Query> {
  clear(): Promise<void>
  create(item: I): Promise<void>
  find(query: Q): Promise<QueryResult<I>>
  get(key: K): Promise<I | undefined>
  getItemKey(item: I): K
  setup(): Promise<void>
  teardown(): Promise<void>
  update(item: I): Promise<void>
}

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

export type KeyToString<K> = (key: K) => string

export const defaultKeyToString = (key: any) => {
  if (typeof key == 'string') return key
  else return JSON.stringify(sortKeys(key))
}

export interface InMemoryStoreOptions<I extends {}, K, Q> {
  items?: Array<I>
  filters: FilterFieldPredicates<I, Q>
  getItemKey: (item: I) => K
  keyToString?: KeyToString<K>
}

export class InMemoryStore<I extends {}, K, Q extends Query>
  implements Store<I, K, Q> {
  items: { [key: string]: I }
  filters: FilterFieldPredicates<I, Q>
  getItemKey: (item: I) => K
  keyToString: KeyToString<K>

  constructor(options: InMemoryStoreOptions<I, K, Q>) {
    this.items = {}
    this.filters = options.filters
    this.getItemKey = options.getItemKey
    this.keyToString = options.keyToString || defaultKeyToString

    if (options.items) {
      options.items.forEach(item => {
        const key = this.getItemKey(item)
        const stringKey = this.keyToString(key)
        this.items[stringKey] = item
      })
    }
  }

  async get(key: K): Promise<I | undefined> {
    return this.items[this.keyToString(key)]
  }

  async create(item: I): Promise<void> {
    this.put(item)
  }

  async update(item: I): Promise<void> {
    this.put(item)
  }

  async put(item: I): Promise<void> {
    const key = this.getItemKey(item)
    const stringKey = this.keyToString(key)
    this.items[stringKey] = item
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
      cursor: this.keyToString(this.getItemKey(item)),
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
