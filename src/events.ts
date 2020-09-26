import { Readable } from 'stream'
import { Store } from './store'

export type Event = { name: string }

export type EventName<E extends Event> = E['name']

export type EventByName<E extends Event, N extends EventName<E>> = E extends {
  name: N
}
  ? E
  : never

export interface EventHandler<E extends Event, I> {
  handleEvent(event: E): Promise<I>
}

export type EventHandlerResult<
  J extends EventHandler<any, any>
> = J extends EventHandler<any, infer R> ? R : never

export type Projections<E extends Event> = {
  [key: string]: EventHandler<E, any>
}

export type ProjectionUpdates<E extends Event, P extends Projections<E>> = {
  [A in keyof P]: EventHandlerResult<P[A]>
}

export interface EmitResult<E extends Event, P extends Projections<E>> {
  event: E
  updates: ProjectionUpdates<E, P>
}

export interface PostEmit<E extends Event, P extends Projections<E>> {
  (event: EmitResult<E, P>): void
}

export interface IEventEmitter<E extends Event, P extends Projections<E>> {
  emit(event: E): Promise<EmitResult<E, P>>
}

export type EventStore<E extends Event, K> = Store<E, K>

export interface IEventStorer<E extends Event, K> {
  store: EventStore<E, K>
}

export interface EventsOptions<E extends Event, K, P extends Projections<E>> {
  postEmit?: PostEmit<E, P>
  projections: P
  store: EventStore<E, K>
}

export class Events<E extends Event, K, P extends Projections<E>>
  implements IEventEmitter<E, P>, IEventStorer<E, K> {
  postEmit?: PostEmit<E, P>
  projections: P
  store: EventStore<E, K>

  constructor({ postEmit, projections, store }: EventsOptions<E, K, P>) {
    this.postEmit = postEmit
    this.projections = projections
    this.store = store
  }

  async load(events: Readable | Iterable<E>, options?: { write: boolean }) {
    options = { write: false, ...options }

    for await (const event of events) {
      await this.updateProjections(event)

      if (options.write) {
        await this.store.create(event)
      }
    }
  }

  async emit<N extends EventName<E>>(
    event: EventByName<E, N>
  ): Promise<EmitResult<EventByName<E, N>, P>> {
    await this.store.create(event)

    const updates = await this.updateProjections(event)

    if (this.postEmit !== undefined) {
      process.nextTick(() => {
        this.postEmit!({ event, updates })
      })
    }

    return { event, updates }
  }

  async updateProjections<N extends EventName<E>>(
    event: EventByName<E, N>
  ): Promise<ProjectionUpdates<E, P>> {
    let updates: Partial<ProjectionUpdates<E, P>> = {}

    // Todo: parallelize
    for (let key in this.projections) {
      const projection = this.projections[key]
      updates[key] = await projection.handleEvent(event)
    }
    return updates as ProjectionUpdates<E, P>
  }
}
