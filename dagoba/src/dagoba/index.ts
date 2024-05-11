import { isArray, isNil } from 'lodash'

type VertexId = number | string

interface Vertex {
  _id: VertexId
  name: string
  _in: Edge[]
  _out: Edge[]
}
interface Edge {
  _in: Vertex
  _out: Vertex
  _label?: string
}

type PartialVertex = {
  _id?: VertexId
  name: string
}
type PartialEdge = {
  _in: VertexId
  _out: VertexId
  _label?: string
}

class Graph {
  vertices: Vertex[] = []
  edges: Edge[] = []
  private vertexIndex: Record<VertexId, Vertex> = {}
  private autoid: number = 1

  constructor(V: PartialVertex[], E: PartialEdge[]) {
    this.addVertices(V)
    this.addEdges(E)
  }

  private createVertex({ _id, name, ...rest }: PartialVertex): Vertex {
    if (!_id) _id = this.autoid++

    return {
      _id,
      name,
      ...rest,
      _in: [],
      _out: [],
    }
  }

  public addVertex(partialVertex: PartialVertex): VertexId {
    const vertex = this.createVertex(partialVertex)

    const existingVertex = this.findVertexById(vertex._id)
    if (existingVertex) throw new Error('A vertex with id ' + vertex._id + ' already exists')

    this.vertices.push(vertex)
    this.vertexIndex[vertex._id] = vertex
    return vertex._id
  }

  public addEdge(partialEdge: PartialEdge): void {
    const inVertex = this.findVertexById(partialEdge._in)
    const outVertex = this.findVertexById(partialEdge._out)

    if (!inVertex || !outVertex) throw new Error("One of the vertices for the edge wasn't found")

    const edge: Edge = {
      _in: inVertex,
      _out: outVertex,
      _label: partialEdge._label,
    }

    outVertex._out.push(edge)
    inVertex._in.push(edge)
    this.edges.push(edge)
  }

  private addVertices(vertices: PartialVertex[]): void {
    vertices.forEach((vertex) => this.addVertex(vertex))
  }

  private addEdges(edges: PartialEdge[]): void {
    edges.forEach((vertex) => this.addEdge(vertex))
  }

  public findVertices(verticesOrFilter: Record<string, any> | VertexId[] | undefined) {
    if (isArray(verticesOrFilter) && verticesOrFilter.length > 0)
      return this.findVerticesByIds(verticesOrFilter)
    else if (isNil(verticesOrFilter)) return this.vertices.slice()
    else return this.searchVertices(verticesOrFilter)
  }

  public findVerticesByIds(ids: VertexId[]): Vertex[] {
    return ids.map((id) => this.findVertexById(id)).filter(Boolean)
  }

  private findVertexById(vertex_id: VertexId): Vertex {
    return this.vertexIndex[vertex_id]
  }

  public searchVertices(filter: Record<string, any>): Vertex[] {
    return this.vertices.filter(function (vertex) {
      return Dagoba.objectFilter(vertex, filter)
    })
  }

  public findOutEdges(vertex: Vertex): Edge[] {
    return vertex._out
  }

  public findInEdges(vertex: Vertex): Edge[] {
    return vertex._in
  }

  public toString(): string {
    return Dagoba.jsonify(this)
  }

  public v(...args: any[]) {
    const query = Dagoba.query(this)
    query.add('vertex', args)
    return query
  }
}

type GremlinState = Record<string, any>

interface Gremlin {
  vertex: Vertex
  state: GremlinState
}

type MaybeGremlin = false | Gremlin | 'pull' | 'done'

interface State {
  vertices?: Vertex[]
  edges?: Edge[]
  gremlin?: Gremlin
}

type Step = [string, any[]] // [pipetype, args]

class Query {
  graph: Graph
  state: State[]
  program: Step[]
  gremlins: Gremlin[]

  constructor(graph: Graph) {
    this.graph = graph
    this.state = []
    this.program = []
    this.gremlins = []
  }

  run() {
    this.program = Dagoba.transform(this.program)

    const max = this.program.length - 1
    let currentResult: MaybeGremlin = false
    const results = []
    let done = -1
    let pc = max

    while (done < max) {
      const [operationType, parameters] = this.program[pc]
      const state = (this.state[pc] = this.state[pc] || {})
      const operate = Dagoba.getPipetype(operationType)

      currentResult = operate(this.graph, parameters, currentResult, state, pc - 1 <= done)

      if (currentResult == 'pull') {
        currentResult = false
        if (pc - 1 > done) {
          pc--
          continue
        } else {
          done = pc
        }
      }

      if (currentResult == 'done') {
        currentResult = false
        done = pc
      }

      pc++

      if (pc > max) {
        if (currentResult) results.push(currentResult)
        currentResult = false
        pc--
      }
    }

    return results.map((gremlin) => (gremlin.result != null ? gremlin.result : gremlin.vertex))
  }

  add(pipetype: string, args: any[]) {
    const step: Step = [pipetype, args]
    this.program.push(step)
    return this
  }
}

class Dagoba {
  static Pipetypes: Record<string, Function> = {}
  static T: { priority: number; fun: Function }[] = []

  static graph(V: PartialVertex[], E: PartialEdge[]) {
    return new Graph(V, E)
  }

  static query(graph: Graph) {
    return new Query(graph)
  }

  static error(msg: string): false {
    console.log(msg)
    return false
  }

  static objectFilter(thing: Record<string, any>, filter: Record<string, any>) {
    return Object.keys(filter).every((key) => thing[key] === filter[key])
  }

  static cleanVertex(key: string, value: any) {
    return key == '_in' || key == '_out' ? undefined : value
  }

  static cleanEdge(key: string, value: any) {
    return key == '_in' || key == '_out' ? value._id : value
  }

  static jsonify(graph: Graph) {
    return (
      '{"V":' +
      JSON.stringify(graph.vertices, Dagoba.cleanVertex) +
      ',"E":' +
      JSON.stringify(graph.edges, Dagoba.cleanEdge) +
      '}'
    )
  }

  static extend(list: any, defaults: any) {
    return Object.keys(defaults).reduce(function (acc, key) {
      if (typeof list[key] != 'undefined') return acc
      acc[key] = defaults[key]
      return acc
    }, list)
  }

  static addPipetype(name: string, fun: Function) {
    Dagoba.Pipetypes[name] = fun
    Query.prototype[name] = function () {
      return this.add(name, [].slice.apply(arguments))
    }
  }

  static addAlias(newname: string, oldname: string, defaults: any) {
    defaults = defaults || []
    Dagoba.addPipetype(newname, function () {})
    Dagoba.addTransformer(function (program) {
      return program.map(function (step) {
        if (step[0] != newname) return step
        return [oldname, Dagoba.extend(step[1], defaults)]
      })
    }, 100)
  }

  static addTransformer(fun: Function, priority: number) {
    if (typeof fun != 'function') return Dagoba.error('Invalid transformer function')

    let i = 0
    for (
      ;
      i < Dagoba.T.length;
      i++ // OPT: binary search
    )
      if (priority > Dagoba.T[i].priority) break

    Dagoba.T.splice(i, 0, { priority: priority, fun: fun })
  }

  static transform(program: any[]) {
    return Dagoba.T.reduce(function (acc, transformer) {
      return transformer.fun(acc)
    }, program)
  }

  static fauxPipetype(graph: any, args: any, maybe_gremlin: any) {
    return maybe_gremlin || 'pull'
  }

  static getPipetype(name: string) {
    const pipetype = Dagoba.Pipetypes[name]

    if (!pipetype) Dagoba.error('Unrecognized pipe type: ' + name)

    return pipetype || Dagoba.fauxPipetype
  }

  static makeGremlin(vertex: Vertex, state: any) {
    return { vertex: vertex, state: state || {} }
  }

  static gotoVertex(gremlin: any, vertex: Vertex) {
    return Dagoba.makeGremlin(vertex, gremlin.state)
  }

  static filterEdges(filter: any) {
    return function (edge: Edge) {
      if (!filter) return true

      if (typeof filter == 'string') return edge._label == filter

      if (Array.isArray(filter)) return !!~filter.indexOf(edge._label)

      return Dagoba.objectFilter(edge, filter)
    }
  }

  static fromString(str: string) {
    const obj = JSON.parse(str)
    return Dagoba.graph(obj.V, obj.E)
  }
}

Dagoba.addPipetype('vertex', function (graph, args, gremlin, state) {
  if (!state.vertices) state.vertices = graph.findVertices(args) // state initialization

  if (!state.vertices.length)
    // all done
    return 'done'

  const vertex = state.vertices.pop() // OPT: this relies on cloning the vertices
  return Dagoba.makeGremlin(vertex, gremlin.state) // we can have incoming gremlins from as/back queries
})

const simpleTraversal = function (dir) {
  // handles basic in and out pipetypes
  const find_method = dir == 'out' ? 'findOutEdges' : ('findInEdges' as const)
  const edge_list = dir == 'out' ? '_in' : ('_out' as const)

  return function (graph, args, gremlin, state) {
    if (!gremlin && (!state.edges || !state.edges.length))
      // query initialization
      return 'pull'

    if (!state.edges || !state.edges.length) {
      // state initialization
      state.gremlin = gremlin
      state.edges = graph[find_method](gremlin.vertex) // get edges that match our query
        .filter(Dagoba.filterEdges(args[0]))
    }

    if (!state.edges.length)
      // all done
      return 'pull'

    const vertex = state.edges.pop()[edge_list] // use up an edge
    return Dagoba.gotoVertex(state.gremlin, vertex)
  }
}

Dagoba.addPipetype('in', simpleTraversal('in'))
Dagoba.addPipetype('out', simpleTraversal('out'))

Dagoba.addPipetype('property', function (graph, args, gremlin, state) {
  if (!gremlin) return 'pull' // query initialization
  gremlin.result = gremlin.vertex[args[0]]
  return gremlin.result == null ? false : gremlin // undefined or null properties kill the gremlin
})

Dagoba.addPipetype('unique', function (graph, args, gremlin, state) {
  if (!gremlin) return 'pull' // query initialization
  if (state[gremlin.vertex._id]) return 'pull' // we've seen this gremlin, so get another instead
  state[gremlin.vertex._id] = true
  return gremlin
})

Dagoba.addPipetype('filter', function (graph, args, gremlin, state) {
  if (!gremlin) return 'pull' // query initialization

  if (typeof args[0] == 'object')
    // filter by object
    return Dagoba.objectFilter(gremlin.vertex, args[0]) ? gremlin : 'pull'

  if (typeof args[0] != 'function') {
    Dagoba.error('Filter arg is not a function: ' + args[0])
    return gremlin // keep things moving
  }

  if (!args[0](gremlin.vertex, gremlin)) return 'pull' // gremlin fails filter function
  return gremlin
})

Dagoba.addPipetype('take', function (graph, args, gremlin, state) {
  state.taken = state.taken || 0 // state initialization

  if (state.taken == args[0]) {
    state.taken = 0
    return 'done' // all done
  }

  if (!gremlin) return 'pull' // query initialization
  state.taken++ // THINK: if this didn't mutate state, we could be more
  return gremlin // cavalier about state management (but run the GC hotter)
})

Dagoba.addPipetype('as', function (graph, args, gremlin, state) {
  if (!gremlin) return 'pull' // query initialization
  gremlin.state.as = gremlin.state.as || {} // initialize gremlin's 'as' state
  gremlin.state.as[args[0]] = gremlin.vertex // set label to the current vertex
  return gremlin
})

Dagoba.addPipetype('aggregate', function (graph, args, gremlin, state, done) {
  if (!done && !gremlin) return 'pull' // query initialization
  state.aggregate = state.aggregate || {} // initialize gremlin's 'aggregate' state
  if (!state.aggregate[args[0]]) state.aggregate[args[0]] = []

  if (done) {
    if (!state.aggregated) {
      state.aggregated = true
      state.vertices = [...state.aggregate[args[0]]]
    }

    const vertex = state.vertices.pop()
    if (!vertex) return 'pull'
    const gremlin = Dagoba.makeGremlin(vertex, state)
    return gremlin
  }

  state.aggregate[args[0]].push(gremlin.vertex)
  gremlin.state.aggregate = gremlin.state.aggregate || {}
  gremlin.state.aggregate[args[0]] = state.aggregate[args[0]]

  return 'pull'
})

Dagoba.addPipetype('back', function (graph, args, gremlin, state) {
  if (!gremlin) return 'pull' // query initialization
  return Dagoba.gotoVertex(gremlin, gremlin.state.as[args[0]]) // TODO: check for nulls
})

Dagoba.addPipetype('except', function (graph, args, gremlin, state) {
  if (!gremlin) return 'pull' // query initialization

  if (gremlin.state.aggregate[args[0]] && gremlin.state.aggregate[args[0]].includes(gremlin.vertex))
    return 'pull'
  if (gremlin.state.as && gremlin.state.as[args[0]] && gremlin.vertex == gremlin.state.as[args[0]])
    return 'pull' // TODO: check for nulls
  return gremlin
})

Dagoba.addPipetype('merge', function (graph, args, gremlin, state) {
  if (!state.vertices && !gremlin) return 'pull' // query initialization

  if (!state.vertices || !state.vertices.length) {
    // state initialization
    const obj = (gremlin.state || {}).as || {}
    state.vertices = args
      .map(function (id) {
        return obj[id]
      })
      .filter(Boolean)
  }

  if (!state.vertices.length) return 'pull' // done with this batch

  const vertex = state.vertices.pop()
  return Dagoba.makeGremlin(vertex, gremlin.state)
})

Dagoba.addAlias('parents', 'out', ['parent'])

class DagobaTest1 {
  static run() {
    const V = [
      { name: 'alice' }, // alice gets auto-_id (prolly 1)
      { _id: 10, name: 'bob', hobbies: ['asdf', { x: 3 }] },
    ]
    const E = [{ _out: 1, _in: 10, _label: 'knows' }]

    const graph = Dagoba.graph(V, E)

    graph.addVertex({ name: 'charlie', _id: 'charlie' }) // string ids are fine
    graph.addVertex({ name: 'delta', _id: '30' }) // in fact they're all strings
    graph.addEdge({ _out: 10, _in: 30, _label: 'parent' })
    graph.addEdge({ _out: 10, _in: 'charlie', _label: 'knows' })

    // @ts-ignore
    const result1 = graph.v(1).out('knows').out().run() // returns [charlie, delta]
    console.log(`result1:`, result1)

    // @ts-ignore
    const qb = graph.v(1).out('knows').out().take(1).property('name')
    const result2 = qb.run()
    const result3 = qb.run()
    const result4 = qb.run()
    console.log(`result2:`, result2)
    console.log(`result3:`, result3)
    console.log(`result4:`, result4)
  }
}

class DagobaTest2 {
  static run() {
    const V = [
      { name: 'Alice', _id: 1, type: 'student' },
      { name: 'Bob', _id: 2, type: 'student' },
      { name: 'Charlie', _id: 3, type: 'student' },
      { name: 'Mathematics', _id: 4, type: 'course' },
      { name: 'Computer Science', _id: 5, type: 'course' },
    ]

    const E = [
      { _out: 1, _in: 4, _label: 'enrolled' }, // Alice is enrolled in Mathematics
      { _out: 1, _in: 5, _label: 'enrolled' }, // Alice is also enrolled in Computer Science
      { _out: 2, _in: 4, _label: 'enrolled' }, // Bob is enrolled in Mathematics
      { _out: 3, _in: 5, _label: 'enrolled' }, // Charlie is enrolled in Computer Science
    ]

    const graph = Dagoba.graph(V, E)

    const dualEnrolledStudents = graph
      .v()
      // @ts-ignore
      .filter({ type: 'student' }) // Filter to select only student vertices
      .as('student') // Mark each student
      .out('enrolled')
      .filter({ name: 'Mathematics' }) // Filter students enrolled in Mathematics
      .back('student') // Go back to the student
      .out('enrolled')
      .filter({ name: 'Computer Science' }) // Filter the same students for Computer Science
      .back('student')
      .unique() // Ensure each student is processed only once
      .property('name') // Extract the name property
      .run()
    console.log('Students enrolled in both Mathematics and Computer Science:', dualEnrolledStudents)
  }
}

class DagobaTest3 {
  static run() {
    const V = [
      { _id: 1, name: 'User1' },
      { _id: 2, name: 'User2' },
      { _id: 3, name: 'User3' },
      { _id: 4, name: 'User4' },
      { _id: 5, name: 'User5' },
      { _id: 6, name: 'User6' },
      { _id: 7, name: 'User7' },
      { _id: 8, name: 'User8' },
      { _id: 9, name: 'User9' },
      { _id: 10, name: 'User10' },
    ]

    const E = [
      { _out: 1, _in: 2, _label: 'friend' },
      { _out: 1, _in: 3, _label: 'friend' },
      { _out: 1, _in: 4, _label: 'friend' },
      { _out: 1, _in: 9, _label: 'friend' },
      { _out: 1, _in: 10, _label: 'friend' },
      { _out: 2, _in: 5, _label: 'friend' },
      { _out: 2, _in: 6, _label: 'friend' },
      { _out: 3, _in: 7, _label: 'friend' },
      { _out: 3, _in: 8, _label: 'friend' },
      { _out: 4, _in: 9, _label: 'friend' },
      { _out: 4, _in: 10, _label: 'friend' },
      { _out: 5, _in: 10, _label: 'friend' },
      { _out: 6, _in: 10, _label: 'friend' },
      { _out: 7, _in: 1, _label: 'friend' },
      { _out: 8, _in: 9, _label: 'friend' },
      { _out: 9, _in: 2, _label: 'friend' },
      { _out: 9, _in: 6, _label: 'friend' },
      { _out: 10, _in: 3, _label: 'friend' },
    ]

    const graph = Dagoba.graph(V, E)

    const secondDegreeFriendsOfUser3 = graph
      .v(1) // 1번 유저 시작
      // @ts-ignore
      .out('friend') // 1촌 친구
      .aggregate('firstDegree') // 1촌 친구로 마킹
      .out('friend') // 2촌 친구
      .except('firstDegree') // 1촌 제외
      .unique() // 중복 제거
      .property('name') // 이름 추출
      .run() // 쿼리 실행

    console.log('2nd degree friends of User 1:', secondDegreeFriendsOfUser3)
  }
}

export class DagobaTest {
  static run() {
    DagobaTest1.run()
    DagobaTest2.run()
    DagobaTest3.run()
  }
}
