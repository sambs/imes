import { Event, EventMetaBase, EventHandler, EventName } from './events'
import { QueryableStore } from './store'

export interface InitHandler<
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A
> {
  init: (event: Event<T, M, N>) => Omit<I, keyof A>
}

export interface SingleTransformHandler<
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  K
> {
  selectOne: (event: Event<T, M, N>) => K
  transform: (event: Event<T, M, N>, item: I) => I
}

export interface ManyTransformHandler<
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  Q
> {
  selectMany: (event: Event<T, M, N>) => Q
  transform: (event: Event<T, M, N>, item: I) => I
}

export type Handler<
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
> =
  | InitHandler<T, M, N, I, A>
  | SingleTransformHandler<T, M, N, I, K>
  | ManyTransformHandler<T, M, N, I, Q>

export const isInitHandler = <
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
>(
  handler: Handler<T, M, N, I, A, K, Q> | undefined
): handler is InitHandler<T, M, N, I, A> => {
  if (handler === undefined) return false
  return (handler as InitHandler<T, M, N, I, A>).init !== undefined
}

export const isSingleTransformHandler = <
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
>(
  handler: Handler<T, M, N, I, A, K, Q> | undefined
): handler is SingleTransformHandler<T, M, N, I, K> => {
  if (handler === undefined) return false
  return (
    (handler as SingleTransformHandler<T, M, N, I, K>).selectOne !== undefined
  )
}

export const isManyTransformHandler = <
  T,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
>(
  handler: Handler<T, M, N, I, A, K, Q> | undefined
): handler is ManyTransformHandler<T, M, N, I, Q> => {
  if (handler === undefined) return false
  return (
    (handler as ManyTransformHandler<T, M, N, I, Q>).selectMany !== undefined
  )
}

export type ProjectionHandlers<T, M extends EventMetaBase<T>, I, A, K, Q> = {
  [N in EventName<T>]?: Handler<T, M, N, I, A, K, Q>
}

export interface ProjectionOptions<T, M extends EventMetaBase<T>, I, A, K, Q> {
  handlers: ProjectionHandlers<T, M, I, A, K, Q>
  initMeta: (event: Event<T, M>) => A
  store: QueryableStore<I, K, Q>
  updateMeta: (event: Event<T, M>, item: I) => A
}

export class Projection<T, M extends EventMetaBase<T>, I, A, K, Q>
  implements EventHandler<T, M, Array<I>> {
  handlers: ProjectionHandlers<T, M, I, A, K, Q>
  initMeta: (event: Event<T, M>) => A
  store: QueryableStore<I, K, Q>
  updateMeta: (event: Event<T, M>, item: I) => A

  constructor({
    initMeta,
    handlers,
    store,
    updateMeta,
  }: ProjectionOptions<T, M, I, A, K, Q>) {
    this.handlers = handlers
    this.initMeta = initMeta
    this.store = store
    this.updateMeta = updateMeta
  }

  async handleEvent<N extends EventName<T>>(
    event: Event<T, M, N>
  ): Promise<Array<I>> {
    const handler = this.handlers[event.name]

    let items: Array<I> = []

    if (handler == undefined) {
      return []
    } else if (isInitHandler(handler)) {
      const item = ({
        ...handler.init(event),
        ...this.initMeta(event),
      } as unknown) as I
      items = [item]
      await this.store.create(item)
    } else {
      if (isSingleTransformHandler(handler)) {
        const item = await this.store.get(handler.selectOne(event))
        if (item !== undefined) items = [item]
      } else if (isManyTransformHandler(handler)) {
        const connection = await this.store.find(handler.selectMany(event))
        items = connection.items
      }
      items = items
        .map(item => handler.transform(event, item))
        .map(item => ({ ...item, ...this.updateMeta(event, item) }))
      await Promise.all(items.map(item => this.store.update(item)))
    }

    return items
  }
}
