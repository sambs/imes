import { Event, EventHandler, EventName } from './events.js'
import { Item, ItemData, ItemMeta, ItemKey } from './types.js'
import { QueryableStore } from './store.js'

export interface InitHandler<
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>
> {
  init: (event: Event<T, M, K, N>) => ItemData<I>
  key: (event: Event<T, M, K, N>) => ItemKey<I>
}

export interface SingleTransformHandler<
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>
> {
  selectOne: (event: Event<T, M, K, N>) => ItemKey<I>
  transform: (event: Event<T, M, K, N>, data: ItemData<I>) => ItemData<I>
}

export interface ManyTransformHandler<
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>,
  Q
> {
  selectMany: (event: Event<T, M, K, N>) => Q
  transform: (event: Event<T, M, K, N>, data: ItemData<I>) => ItemData<I>
}

export type Handler<
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>,
  Q
> =
  | InitHandler<T, M, K, N, I>
  | SingleTransformHandler<T, M, K, N, I>
  | ManyTransformHandler<T, M, K, N, I, Q>

export const isInitHandler = <
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>,
  Q
>(
  handler: Handler<T, M, K, N, I, Q> | undefined
): handler is InitHandler<T, M, K, N, I> => {
  if (handler === undefined) return false
  return (handler as InitHandler<T, M, K, N, I>).init !== undefined
}

export const isSingleTransformHandler = <
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>,
  Q
>(
  handler: Handler<T, M, K, N, I, Q> | undefined
): handler is SingleTransformHandler<T, M, K, N, I> => {
  if (handler === undefined) return false
  return (
    (handler as SingleTransformHandler<T, M, K, N, I>).selectOne !== undefined
  )
}

export const isManyTransformHandler = <
  T,
  M,
  K,
  N extends EventName<T>,
  I extends Item<any, any, any>,
  Q
>(
  handler: Handler<T, M, K, N, I, Q> | undefined
): handler is ManyTransformHandler<T, M, K, N, I, Q> => {
  if (handler === undefined) return false
  return (
    (handler as ManyTransformHandler<T, M, K, N, I, Q>).selectMany !== undefined
  )
}

export type ProjectionHandlers<T, M, K, I extends Item<any, any, any>, Q> = {
  [N in EventName<T>]?: Handler<T, M, K, N, I, Q>
}

export interface ProjectionOptions<T, M, K, I extends Item<any, any, any>, Q> {
  handlers: ProjectionHandlers<T, M, K, I, Q>
  initMeta: (event: Event<T, M, K>) => ItemMeta<I>
  store: QueryableStore<I, Q>
  updateMeta: (event: Event<T, M, K>, meta: ItemMeta<I>) => ItemMeta<I>
}

export class Projection<T, M, K, I extends Item<any, any, any>, Q>
  implements EventHandler<T, M, K, Array<I>> {
  handlers: ProjectionHandlers<T, M, K, I, Q>
  initMeta: (event: Event<T, M, K>) => ItemMeta<I>
  store: QueryableStore<I, Q>
  updateMeta: (event: Event<T, M, K>, meta: ItemMeta<I>) => ItemMeta<I>

  constructor({
    initMeta,
    handlers,
    store,
    updateMeta,
  }: ProjectionOptions<T, M, K, I, Q>) {
    this.handlers = handlers
    this.initMeta = initMeta
    this.store = store
    this.updateMeta = updateMeta
  }

  async handleEvent<N extends EventName<T>>(
    event: Event<T, M, K, N>
  ): Promise<Array<I>> {
    const handler = this.handlers[event.meta.name]

    let items: Array<I> = []

    if (handler == undefined) {
      return []
    } else if (isInitHandler(handler)) {
      items = [
        {
          data: handler.init(event),
          meta: this.initMeta(event),
          key: handler.key(event),
        } as I,
      ]
    } else {
      if (isSingleTransformHandler(handler)) {
        const item = await this.store.read(handler.selectOne(event))
        if (item !== undefined) items = [item]
      } else if (isManyTransformHandler(handler)) {
        const connection = await this.store.find(handler.selectMany(event))
        items = connection.items
      }
      items = items.map(
        ({ data, meta, key }) =>
          ({
            data: handler.transform(event, data),
            meta: this.updateMeta(event, meta),
            key,
          } as I)
      )
    }

    await Promise.all(items.map(item => this.store.write(item)))

    return items
  }
}

export type MockProjectionUpdates<T, I extends Item<any, any, any>> = {
  [N in EventName<T>]?: Array<Array<I>>
}

export interface MockProjectionOptions<T, I extends Item<any, any, any>, Q> {
  store: QueryableStore<I, Q>
  updates?: MockProjectionUpdates<T, I>
}

export class MockProjection<T, M, K, I extends Item<any, any, any>, Q>
  implements EventHandler<T, M, K, Array<I>> {
  store: QueryableStore<I, Q>
  updates: MockProjectionUpdates<T, I>

  constructor({ store, updates }: MockProjectionOptions<T, I, Q>) {
    this.updates = updates || {}
    this.store = store
  }

  async handleEvent<N extends EventName<T>>(
    event: Event<T, M, K, N>
  ): Promise<I[]> {
    const updates = this.updates[event.meta.name]
    if (updates) {
      const edges = updates.shift() || []
      await Promise.all(edges.map(edge => this.store.write(edge)))
      return edges
    } else {
      return []
    }
  }
}
