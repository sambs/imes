import { PubSub } from 'graphql-subscriptions'
import uuid from 'uuid'
import { Readable, Writable } from 'stream'

export type EventName<Events> = keyof Events
export type EventData<Events, Name extends EventName<Events>> = Events[Name]

export type Event<Events, Name extends EventName<Events>> = {
  name: Name
  id: string
  time: string
  data: EventData<Events, Name>
}

export interface ResolvedEvent<Events, Name extends EventName<Events>>
  extends Event<Events, Name> {
  updatedNodes: any[]
}

export type Listener<Events, Name extends EventName<Events>> = (
  event: Event<Events, Name>
) => void

export interface ImesOptions<Projections> {
  projections: Projections
  writeEvent?(event: any): Promise<void>
}

export class Imes<Events, Projections> {
  _listeners: { [Name in EventName<Events>]?: Listener<Events, Name>[] }
  _pubsub: PubSub
  store: Projections

  constructor({ projections, writeEvent }: ImesOptions<Projections>) {
    if (writeEvent) this.writeEvent = writeEvent
    this._listeners = {}
    this._pubsub = new PubSub()
    this.store = projections
  }

  id(): string {
    return uuid()
  }

  now(): string {
    return new Date().toISOString()
  }

  async emit<Name extends EventName<Events>>(
    name: Name,
    data: EventData<Events, Name>
  ): Promise<ResolvedEvent<Events, Name>> {
    const event: Event<Events, Name> = {
      id: this.id(),
      time: this.now(),
      name,
      data,
    }

    if (this._listeners[name]) {
      process.nextTick(() => {
        this._listeners[name]!.forEach(listener => listener(event))
      })
    }

    await this.writeEvent(event)

    const resolved: ResolvedEvent<Events, Name> = {
      ...event,
      updatedNodes: this._updateProjections(event),
    }

    this._pubsub.publish('*', { event: resolved })
    this._pubsub.publish(name.toString(), { [name]: resolved })

    return resolved
  }

  writeEvent(event: any): Promise<void> {
    return Promise.resolve()
  }

  on<Name extends keyof Events>(
    name: Name,
    listener: Listener<Events, Name>
  ): void {
    this._listeners[name] = this._listeners[name] || []
    this._listeners[name]!.push(listener)
  }

  asyncIterator<T>(event: string): AsyncIterator<T> {
    return this._pubsub.asyncIterator(event)
  }

  load(events: Readable): Promise<void> {
    return new Promise((resolve, reject) =>
      events
        .on('data', event => this._updateProjections(event))
        .on('error', reject)
        .on('end', resolve)
    )
  }

  _updateProjections<Name extends keyof Events>(event: Event<Events, Name>) {
    return Object.keys(this.store).reduce((updatedNodes, key) => {
      const projection = this.store[key]
      return updatedNodes.concat(projection.handleEvent(event))
    }, [])
  }
}

export interface Query {
  cursor?: string | number
  filter?: object
  first?: number
}

export interface PageInfo {
  cursor: string | null
  hasMore: boolean
}

export interface Connection<Node> {
  nodes: Node[]
  pageInfo: PageInfo
}

export interface InitHandler<Events, Node, Name extends EventName<Events>> {
  init: (event: Event<Events, Name>) => Node
}

export interface SingleTransformHandler<
  Events,
  Node,
  Name extends EventName<Events>
> {
  selectOne: (event: Event<Events, Name>) => string | number
  transform: (event: Event<Events, Name>, node: Node) => Node
}

export interface ManyTransformHandler<
  Events,
  Node,
  Name extends EventName<Events>
> {
  selectMany: (event: Event<Events, Name>) => { [prop: string]: any }
  transform: (event: Event<Events, Name>, node: Node) => Node
}

export type Handler<Events, Node, Name extends EventName<Events>> =
  | InitHandler<Events, Node, Name>
  | SingleTransformHandler<Events, Node, Name>
  | ManyTransformHandler<Events, Node, Name>

export interface ProjectionOptions<Events, Node> {
  name: string
  key: string
  handlers: { [Key in EventName<Events>]?: Handler<Events, Node, Key> }
}

export class Projection<Events, Node> {
  name: string
  key: string
  handlers: { [Key in EventName<Events>]?: Handler<Events, Node, Key> }
  nodes: { [key: string]: Node }

  constructor({ name, key, handlers }: ProjectionOptions<Events, Node>) {
    this.name = name
    this.key = key
    this.handlers = handlers
    this.nodes = {}
  }

  get(key: string): Node {
    return this.nodes[key]
  }

  find(query: Query = {}): Connection<Node> {
    let cursor = null
    let hasMore = false
    let nodes = Object.values(this.nodes)

    if (query.filter) {
      nodes = Object.keys(query.filter).reduce(
        (nodes, prop) =>
          nodes.filter(node => node[prop] === query.filter![prop]),
        nodes
      )
    }

    if (query.cursor) {
      const lastKey = query.cursor
      let found = false

      while (!found && nodes.length) {
        if (nodes[0][this.key] === lastKey) {
          found = true
        }
        nodes.shift()
      }

      if (!found) {
        throw new Error('Invalid cursor')
      }
    }

    if ('first' in query && nodes.length > query.first!) {
      hasMore = true
      cursor = nodes[query.first! - 1][this.key]
      nodes = nodes.slice(0, query.first)
    }

    return { nodes, pageInfo: { hasMore, cursor } }
  }

  handleEvent(event): Node[] {
    if (!this.handlers[event.name]) return []

    const { selectOne, selectMany, transform, init } = this.handlers[event.name]

    let nodes: Node[]

    if (init) {
      nodes = [init(event)]
    } else {
      if (selectOne) {
        nodes = [this.get(selectOne(event))]
      } else if (selectMany) {
        nodes = this.find({ filter: selectMany(event) }).nodes
      }
      nodes = nodes!.map(node => transform(event, node))
    }

    nodes = nodes.map(node =>
      Object.assign({}, node, { __typename: this.name })
    )

    nodes.forEach(node => {
      const key = node[this.key]
      this.nodes[key] = node
    })

    return nodes
  }
}
