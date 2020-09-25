import deepEqual from 'deep-equal'
import sortKeys from 'sort-keys'
import { Item, ItemKey } from './types'

export interface Store<I extends Item<any, any, any>> {
  get(key: ItemKey<I>): Promise<I | undefined>
  create(item: I): Promise<void>
  update(item: I): Promise<void>
  clear(): Promise<void>
  setup(): Promise<void>
  teardown(): Promise<void>
}

export interface QueryableStore<
  I extends Item<any, any, any>,
  Q extends Query<I>
> extends Store<I> {
  find(query: Q): Promise<QueryResult<I>>
}

export interface Query<I extends Item<any, any, any>> {
  cursor?: ItemKey<I>
  limit?: number
  filter?: { [field: string]: any }
}

export interface QueryResult<I extends Item<any, any, any>> {
  items: Array<I>
  cursor: ItemKey<I> | null
}

export type KeyToString<I extends Item<any, any, any>> = (
  key: ItemKey<I>
) => string

export type GetItemKey<I extends Item<any, any, any>> = (item: I) => ItemKey<I>

export type FilterPredicate<I> = (item: I) => boolean

export type GetFilterPredicates<I, Q> = (
  query: Q
) => Iterable<FilterPredicate<I>>

export const defaultKeyToString = (key: any) => {
  if (typeof key == 'string') return key
  else return JSON.stringify(sortKeys(key))
}

export interface InMemoryStoreOptions<I extends Item<any, any, any>, Q> {
  items?: Array<I>
  getFilterPredicates?: GetFilterPredicates<I, Q>
  keyToString?: KeyToString<I>
  getItemKey: GetItemKey<I>
}

export class InMemoryStore<I extends Item<any, any, any>, Q extends Query<I>>
  implements QueryableStore<I, Q> {
  items: { [key: string]: I }
  keyToString: KeyToString<I>
  getItemKey: GetItemKey<I>

  constructor(options: InMemoryStoreOptions<I, Q>) {
    this.items = {}
    this.getItemKey = options.getItemKey
    this.keyToString = options.keyToString || defaultKeyToString

    if (options.getFilterPredicates)
      this.getFilterPredicates = options.getFilterPredicates

    if (options.items) {
      options.items.forEach(item => {
        const key = this.getItemKey(item)
        const stringKey = this.keyToString(key)
        this.items[stringKey] = item
      })
    }
  }

  async get(key: ItemKey<I>): Promise<I | undefined> {
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

  protected paginateItems(
    items: Array<I>,
    cursor: ItemKey<I> | null,
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
      cursor = items.length ? this.getItemKey(items.slice(-1)[0]) : null
    }

    return { items, cursor }
  }

  async clear() {
    this.items = {}
  }

  async setup() {}
  async teardown() {}
}
