import { Readable } from 'stream'
import { Store, Query } from './store'

export type Event<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T> = EventName<T>
> = { payload: EventPayload<T, N> } & M

export type EventPayloadMap = { [name: string]: any }

export type EventName<T extends EventPayloadMap> = keyof T

export type EventMetaBase<T extends EventPayloadMap> = { name: EventName<T> }

export type EventPayload<
  T extends EventPayloadMap,
  N extends EventName<T> = EventName<T>
> = T[N]

export interface EventHandler<T, M extends EventMetaBase<T>, I> {
  handleEvent(event: Event<T, M>): Promise<I>
}

export type EventHandlerResult<
  J extends EventHandler<any, any, any>
> = J extends EventHandler<any, any, infer R> ? R : never

type Projections<T, M extends EventMetaBase<T>> = {
  [key: string]: EventHandler<T, M, any>
}

type ProjectionUpdates<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>
> = {
  [N in keyof P]: EventHandlerResult<P[N]>
}

export interface EmitResult<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>,
  N extends EventName<T>
> {
  event: Event<T, M, N>
  updates: ProjectionUpdates<T, M, P>
}

export interface PostEmit<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>
> {
  <N extends EventName<T>>(event: EmitResult<T, M, P, N>): void
}

export interface EventEmitter<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>,
  C
> {
  emit<N extends EventName<T>>(
    name: N,
    payload: EventPayload<T, N>,
    context: C
  ): Promise<EmitResult<T, M, P, N>>
}

export type GetMeta<T, M extends EventMetaBase<T>, C> = <
  N extends EventName<T>
>(
  name: N,
  context: C
) => M

export interface EventsOptions<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>,
  C, // Emit context
  K = any, // Event store key
  Q = Query // Event store query
> {
  getMeta: GetMeta<T, M, C>
  postEmit?: PostEmit<T, M, P>
  projections: P
  store: Store<Event<T, M>, K, Q>
}

export class Events<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>,
  C, // Emit context
  K = any, // Event store key
  Q = Query // Event store query
> implements EventEmitter<T, M, P, C> {
  getMeta: GetMeta<T, M, C>
  postEmit?: PostEmit<T, M, P>
  projections: P
  store: Store<Event<T, M>, K, Q>

  constructor({
    getMeta,
    postEmit,
    projections,
    store,
  }: EventsOptions<T, M, P, C, K, Q>) {
    this.getMeta = getMeta
    this.postEmit = postEmit
    this.projections = projections
    this.store = store
  }

  /**
   * Load existing events, populating projections
   *
   * @param {Stream<Event>|Event[]} events - Events to load
   * @param {Object} [options]
   * @param {Boolean} [options.write=false] - Whether to also write the event to the event store
   * @param {String[]=} [options.projections] - When present, only populate the specified projections
   */
  async load(
    events: Readable | Iterable<Event<T, M>>,
    options?: { write?: boolean; projections?: Array<keyof P> }
  ) {
    options = { write: false, ...options }

    for await (const event of events) {
      if (options.write) {
        await this.store.create(event)
      }
      await this.updateProjections(event, options.projections)
    }
  }

  build<N extends EventName<T>>(
    name: N,
    payload: EventPayload<T, N>,
    context: C
  ): Event<T, M, N> {
    return {
      ...this.getMeta(name, context),
      payload,
    }
  }

  async emit<N extends EventName<T>>(
    name: N,
    payload: EventPayload<T, N>,
    context: C
  ): Promise<EmitResult<T, M, P, N>> {
    const event = this.build(name, payload, context)

    await this.store.create(event)

    const updates = await this.updateProjections(event)

    if (this.postEmit !== undefined) {
      process.nextTick(() => {
        this.postEmit!<N>({ event, updates })
      })
    }

    return { event, updates }
  }

  async updateProjections<N extends EventName<T>>(
    event: Event<T, M, N>,
    only?: Array<keyof P>
  ): Promise<ProjectionUpdates<T, M, P>> {
    const jobs: Array<Promise<[keyof P, any]>> = []

    for (let name in this.projections) {
      jobs.push(
        !only || only.includes(name)
          ? this.projections[name]
              .handleEvent(event)
              .then(result => [name, result])
          : Promise.resolve([name, []])
      )
    }

    const updates = Object.fromEntries(await Promise.all(jobs))

    return updates as ProjectionUpdates<T, M, P>
  }
}
