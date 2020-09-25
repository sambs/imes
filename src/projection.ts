// import { Event, EventHandler, EventName } from './events'
import { QueryableStore } from './store'

type Event = { name: string }

export interface InitHandler<E extends Event, I, A> {
  init: (event: E) => Omit<I, keyof A>
}

export interface SingleTransformHandler<E extends Event, I, Y> {
  selectOne: (event: E) => Y
  transform: (event: E, item: I) => I
}

export interface ManyTransformHandler<E extends Event, I, Q> {
  selectMany: (event: E) => Q
  transform: (event: E, item: I) => I
}

export type Handler<E extends Event, I, Y, A, Q> =
  | InitHandler<E, I, A>
  | SingleTransformHandler<E, I, Y>
  | ManyTransformHandler<E, I, Q>

export const isInitHandler = <E extends Event, I, Y, A, Q>(
  handler: Handler<E, I, Y, A, Q> | undefined
): handler is InitHandler<E, I, A> => {
  if (handler === undefined) return false
  return (handler as InitHandler<E, I, A>).init !== undefined
}

export const isSingleTransformHandler = <E extends Event, I, Y, A, Q>(
  handler: Handler<E, I, Y, A, Q> | undefined
): handler is SingleTransformHandler<E, I, Y> => {
  if (handler === undefined) return false
  return (handler as SingleTransformHandler<E, I, Y>).selectOne !== undefined
}

export const isManyTransformHandler = <E extends Event, I, Y, A, Q>(
  handler: Handler<E, I, Y, A, Q> | undefined
): handler is ManyTransformHandler<E, I, Q> => {
  if (handler === undefined) return false
  return (handler as ManyTransformHandler<E, I, Q>).selectMany !== undefined
}

export type ProjectionHandlers<E extends Event, I, Y, A, Q> = {
  [N in E['name']]?: Handler<E, I, Y, A, Q>
}

export interface ProjectionOptions<E extends Event, I, Y, A, Q> {
  handlers: ProjectionHandlers<E, I, Y, A, Q>
  initMeta: (event: E) => A
  store: QueryableStore<I, Y, Q>
  updateMeta: (event: E, item: I) => A
}

export class Projection<E extends Event, I, Y, A, Q> {
  handlers: ProjectionHandlers<E, I, Y, A, Q>
  initMeta: (event: E) => A
  store: QueryableStore<I, Y, Q>
  updateMeta: (event: E, item: I) => A

  constructor({
    initMeta,
    handlers,
    store,
    updateMeta,
  }: ProjectionOptions<E, I, Y, A, Q>) {
    this.handlers = handlers
    this.initMeta = initMeta
    this.store = store
    this.updateMeta = updateMeta
  }

  async handleEvent(_event: E): Promise<Array<I>> {
    return []
    // const handler = this.handlers[event.name]

    // let items: Array<I> = []

    // if (handler == undefined) {
    //   return []
    // } else if (isInitHandler(handler)) {
    //   const item = ({
    //     ...handler.init(event),
    //     ...this.initMeta(event),
    //   } as unknown) as I
    //   items = [item]
    //   await this.store.create(item)
    // } else {
    //   if (isSingleTransformHandler(handler)) {
    //     const item = await this.store.get(handler.selectOne(event))
    //     if (item !== undefined) items = [item]
    //   } else if (isManyTransformHandler(handler)) {
    //     const connection = await this.store.find(handler.selectMany(event))
    //     items = connection.items
    //   }
    //   items = items
    //     .map(item => handler.transform(event, item))
    //     .map(item => ({ ...item, ...this.updateMeta(event, item) }))
    //   await Promise.all(items.map(item => this.store.update(item)))
    // }

    // return items
  }
}
