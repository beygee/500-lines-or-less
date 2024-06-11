import { vec3, mat4 } from 'gl-matrix'
import { Node } from './nodes/node'

export class Raycaster {
  private origin: vec3
  private direction: vec3

  constructor(origin: vec3, direction: vec3) {
    this.origin = vec3.clone(origin)
    this.direction = vec3.clone(direction)
  }

  private intersectNode(node: Node, parentModelMatrix: mat4): Node | null {
    const modelMatrix = node.getLocalModelMatrix()
    const worldMatrix = mat4.create()
    mat4.multiply(worldMatrix, parentModelMatrix, modelMatrix)
    const worldAABB = node.getAABB()?.transform(worldMatrix)

    if (worldAABB && worldAABB.intersectRay(this.origin, this.direction)) {
      return node
    }

    let closestNode: Node | null = null
    let closestDistance = Infinity

    for (const child of node.children) {
      const hit = this.intersectNode(child, worldMatrix)
      if (hit) {
        const worldPosition = hit.getWorldPosition(worldMatrix)
        const distance = vec3.distance(this.origin, worldPosition)
        if (distance < closestDistance) {
          closestDistance = distance
          closestNode = hit
        }
      }
    }

    return closestNode
  }

  public intersectNodes(nodes: Node[], parentModelMatrix: mat4): Node | null {
    let closestNode: Node | null = null
    let closestDistance = Infinity

    for (const node of nodes) {
      const hitNode = this.intersectNode(node, parentModelMatrix)
      if (hitNode) {
        const worldPosition = hitNode.getWorldPosition(parentModelMatrix)
        const distance = vec3.distance(this.origin, worldPosition)
        if (distance < closestDistance) {
          closestDistance = distance
          closestNode = hitNode
        }
      }
    }

    return closestNode
  }
}
