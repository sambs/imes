import { Event, EventHandler, EventName } from './events'
import { QueryableStore } from './store'

export interface InitHandler<T, M, K, N extends EventName<T>, I, A> {
  init: (event: Event<T, M, K, N>) => Omit<I, keyof A>
}

export interface SingleTransformHandler<T, M, K, N extends EventName<T>, I, Y> {
  selectOne: (event: Event<T, M, K, N>) => Y
  transform: (event: Event<T, M, K, N>, item: I) => I
}

export interface ManyTransformHandler<T, M, K, N extends EventName<T>, I, Q> {
  selectMany: (event: Event<T, M, K, N>) => Q
  transform: (event: Event<T, M, K, N>, item: I) => I
}

export type Handler<T, M, K, N extends EventName<T>, I, Y, A, Q> =
  | InitHandler<T, M, K, N, I, A>
  | SingleTransformHandler<T, M, K, N, I, Y>
  | ManyTransformHandler<T, M, K, N, I, Q>

export const isInitHandler = <T, M, K, N extends EventName<T>, I, Y, A, Q>(
  handler: Handler<T, M, K, N, I, Y, A, Q> | undefined
): handler is InitHandler<T, M, K, N, I, A> => {
  if (handler === undefined) return false
  return (handler as InitHandler<T, M, K, N, I, A>).init !== undefined
}

export const isSingleTransformHandler = <
  T,
  M,
  K,
  N extends EventName<T>,
  I,
  Y,
  A,
  Q
>(
  handler: Handler<T, M, K, N, I, Y, A, Q> | undefined
): handler is SingleTransformHandler<T, M, K, N, I, Y> => {
  if (handler === undefined) return false
  return (
    (handler as SingleTransformHandler<T, M, K, N, I, Y>).selectOne !==
    undefined
  )
}

export const isManyTransformHandler = <
  T,
  M,
  K,
  N extends EventName<T>,
  I,
  Y,
  A,
  Q
>(
  handler: Handler<T, M, K, N, I, Y, A, Q> | undefined
): handler is ManyTransformHandler<T, M, K, N, I, Q> => {
  if (handler === undefined) return false
  return (
    (handler as ManyTransformHandler<T, M, K, N, I, Q>).selectMany !== undefined
  )
}

export type ProjectionHandlers<T, M, K, I, Y, A, Q> = {
  [N in EventName<T>]?: Handler<T, M, K, N, I, Y, A, Q>
}

export interface ProjectionOptions<T, M, K, I, Y, A, Q> {
  handlers: ProjectionHandlers<T, M, K, I, Y, A, Q>
  initMeta: (event: Event<T, M, K>) => A
  store: QueryableStore<I, Y, Q>
  updateMeta: (event: Event<T, M, K>, item: I) => A
}

export class Projection<T, M, K, I, Y, A, Q>
  implements EventHandler<T, M, K, Array<I>> {
  handlers: ProjectionHandlers<T, M, K, I, Y, A, Q>
  initMeta: (event: Event<T, M, K>) => A
  store: QueryableStore<I, Y, Q>
  updateMeta: (event: Event<T, M, K>, item: I) => A

  constructor({
    initMeta,
    handlers,
    store,
    updateMeta,
  }: ProjectionOptions<T, M, K, I, Y, A, Q>) {
    this.handlers = handlers
    this.initMeta = initMeta
    this.store = store
    this.updateMeta = updateMeta
  }

  async handleEvent<N extends EventName<T>>(
    event: Event<T, M, K, N>
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
