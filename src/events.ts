import { Readable } from 'stream'
import { Store } from './store'

export type Event<
  T, // { [name: string]: EventPayload }
  M extends EventMetaBase<T>,
  N extends EventName<T> = EventName<T>
> = EventPayload<T, N> & M

export type EventName<T> = keyof T

export type EventMetaBase<T> = { name: EventName<T> }

export type EventData<T, N extends EventName<T> = EventName<T>> = T[N]

export type EventPayload<T, N extends EventName<T>> = {
  payload: EventData<T, N>
}

export interface EventHandler<T, M extends EventMetaBase<T>, I> {
  handleEvent(event: Event<T, M>): Promise<I>
}

export type EventHandlerResult<
  J extends EventHandler<any, any, any>
> = J extends EventHandler<any, any, infer R> ? R : never

export type Projections<T, M extends EventMetaBase<T>> = {
  [key: string]: EventHandler<T, M, any>
}

export type ProjectionUpdates<
  T,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>
> = {
  [N in keyof P]: EventHandlerResult<P[N]>
}

export interface EmitResult<
  T,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>,
  N extends EventName<T>
> {
  event: Event<T, M, N>
  updates: ProjectionUpdates<T, M, P>
}

export interface PostEmit<
  T,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>
> {
  <N extends EventName<T>>(event: EmitResult<T, M, P, N>): void
}

export interface EventEmitter<
  T,
  M extends EventMetaBase<T>,
  P extends Projections<T, M>,
  C
> {
  emit<N extends EventName<T>>(
    name: N,
    data: EventData<T, N>,
    context: C
  ): Promise<EmitResult<T, M, P, N>>
}

export type EventStore<T, M extends EventMetaBase<T>, K> = Store<
  Event<T, M, EventName<T>>,
  K
>

export interface EventStorer<T, M extends EventMetaBase<T>, K> {
  store: EventStore<T, M, K>
}

export type GetMeta<T, M extends EventMetaBase<T>, C> = <
  N extends EventName<T>
>(
  name: N,
  context: C
) => M

export interface EventsOptions<
  T,
  M extends EventMetaBase<T>,
  K,
  P extends Projections<T, M>,
  C
> {
  getMeta: GetMeta<T, M, C>
  postEmit?: PostEmit<T, M, P>
  projections: P
  store: EventStore<T, M, K>
}

export class Events<
  T,
  M extends EventMetaBase<T>,
  K,
  P extends Projections<T, M>,
  C
> implements EventEmitter<T, M, P, C>, EventStorer<T, M, K> {
  getMeta: GetMeta<T, M, C>
  postEmit?: PostEmit<T, M, P>
  projections: P
  store: EventStore<T, M, K>

  constructor({
    getMeta,
    postEmit,
    projections,
    store,
  }: EventsOptions<T, M, K, P, C>) {
    this.getMeta = getMeta
    this.postEmit = postEmit
    this.projections = projections
    this.store = store
  }

  async load(
    events: Readable | Iterable<Event<T, M>>,
    options?: { write: boolean }
  ) {
    options = { write: false, ...options }

    for await (const event of events) {
      await this.updateProjections(event)

      if (options.write) {
        await this.store.create(event)
      }
    }
  }

  async emit<N extends EventName<T>>(
    name: N,
    payload: EventData<T, N>,
    context: C
  ): Promise<EmitResult<T, M, P, N>> {
    const event = {
      payload,
      ...this.getMeta(name, context),
    }

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
    event: Event<T, M, N>
  ): Promise<ProjectionUpdates<T, M, P>> {
    let updates: Partial<ProjectionUpdates<T, M, P>> = {}

    // Todo: parallelize
    for (let key in this.projections) {
      const projection = this.projections[key]
      updates[key] = await projection.handleEvent(event)
    }
    return updates as ProjectionUpdates<T, M, P>
  }
}
