import deepEqual from 'deep-equal'
import sortKeys from 'sort-keys'

export interface Store<I extends {}, K, Q extends Query = Query> {
  get(key: K): Promise<I | undefined>
  find(query: Q): Promise<QueryResult<I>>
  create(item: I): Promise<void>
  update(item: I): Promise<void>
  clear(): Promise<void>
  setup(): Promise<void>
  teardown(): Promise<void>
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

export type GetItemKey<I extends {}, K> = (item: I) => K

export type KeyToString<K> = (key: K) => string

export const defaultKeyToString = (key: any) => {
  if (typeof key == 'string') return key
  else return JSON.stringify(sortKeys(key))
}

export interface InMemoryStoreOptions<I extends {}, K, Q> {
  items?: Array<I>
  filters: FilterFieldPredicates<I, Q>
  keyToString?: KeyToString<K>
  getItemKey: GetItemKey<I, K>
}

export class InMemoryStore<I extends {}, K, Q extends Query>
  implements Store<I, K, Q> {
  items: { [key: string]: I }
  filters: FilterFieldPredicates<I, Q>
  keyToString: KeyToString<K>
  getItemKey: GetItemKey<I, K>

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

    if (typeof limit == 'number' && items.length > limit) {
      items = items.slice(0, limit)
      cursor = items.length
        ? this.keyToString(this.getItemKey(items.slice(-1)[0]))
        : null
    }

    return { items, cursor }
  }

  async clear() {
    this.items = {}
  }

  async setup() {}
  async teardown() {}
}
