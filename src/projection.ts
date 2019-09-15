export interface ProjectionEventHandler<Node> {
  transform: (event: any, node?: Node) => Node
  selectOne?: (event: any) => string | number
  selectMany?: (event: any) => { [prop: string]: any }
}

export interface ProjectionOptions<Node> {
  name: string
  keyProp: string
  eventHandlers: { [name: string]: ProjectionEventHandler<Node> }
}

export interface ProjectionQuery {
  cursor?: string | number
  filter?: object
  first?: number
}

export interface PageInfo {
  cursor?: string
  hasMore: boolean
}

export interface Connection<Node> {
  nodes: Node[]
  pageInfo: PageInfo
}

export class Projection<Node> {
  name: string
  keyProp: string
  eventHandlers: { [name: string]: ProjectionEventHandler<Node> }
  nodes: { [key: string]: Node }

  constructor({ name, keyProp, eventHandlers }: ProjectionOptions<Node>) {
    this.name = name
    this.keyProp = keyProp
    this.eventHandlers = eventHandlers
    this.nodes = {}
  }

  handleEvent(event): Node[] {
    if (!this.eventHandlers[event.name]) return []

    const { selectOne, selectMany, transform } = this.eventHandlers[event.name]

    let nodes

    if (selectOne) {
      nodes = [this.get(selectOne(event))]
    } else if (selectMany) {
      nodes = this.find({ filter: selectMany(event) }).nodes
    }

    if (nodes) {
      nodes = nodes.map(node => transform(event, node))
    } else {
      nodes = [transform(event)]
    }

    nodes = nodes.map(node =>
      Object.assign({}, node, { __typename: this.name })
    )

    nodes.forEach(node => {
      const key = node[this.keyProp]
      this.nodes[key] = node
    })

    return nodes
  }

  get(key: string | number): Node {
    return this.nodes[key]
  }

  find(query: ProjectionQuery = {}): Connection<Node> {
    let cursor = null
    let hasMore = false
    let nodes = Object.values(this.nodes)

    if (query.filter) {
      nodes = Object.keys(query.filter).reduce(
        (nodes, prop) =>
          nodes.filter(node => node[prop] === query.filter[prop]),
        nodes
      )
    }

    if (query.cursor) {
      const lastKey = query.cursor
      let found = false

      while (!found && nodes.length) {
        if (nodes[0][this.keyProp] === lastKey) {
          found = true
        }
        nodes.shift()
      }

      if (!found) {
        throw new Error('Invalid cursor')
      }
    }

    if ('first' in query && nodes.length > query.first) {
      hasMore = true
      cursor = nodes[query.first - 1][this.keyProp]
      nodes = nodes.slice(0, query.first)
    }

    return { nodes, pageInfo: { hasMore, cursor } }
  }
}
