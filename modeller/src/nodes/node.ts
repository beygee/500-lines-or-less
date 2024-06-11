import { mat4, vec3 } from 'gl-matrix'
import { AABB } from './aabb'
import { TextureProgramInfo } from '../shaders/texture'
import { ShaderProgram } from '../shaders'

export class Node {
  public localPosition: vec3
  public localRotation: vec3
  public localScale: vec3
  public children: Node[]
  public aabb: AABB | null
  public picked: boolean

  constructor() {
    this.localPosition = vec3.fromValues(0, 0, 0)
    this.localRotation = vec3.fromValues(0, 0, 0)
    this.localScale = vec3.fromValues(1, 1, 1)
    this.children = []
    this.aabb = null
    this.picked = false
  }

  protected update(deltaTime: number): void {}
  protected draw(
    shaderProgram: ShaderProgram,
    projectionMatrix: mat4,
    modelViewMatrix: mat4,
  ): void {}

  public updateSelf(deltaTime: number): void {
    // 각 객체의 고유한 업데이트 로직
    this.update(deltaTime)
    // 자식 객체들 업데이트
    for (const child of this.children) {
      child.updateSelf(deltaTime)
    }
  }

  public drawSelf(
    shaderProgram: ShaderProgram,
    projectionMatrix: mat4,
    parentModelMatrix: mat4,
  ): void {
    const modelMatrix = mat4.create()
    mat4.multiply(modelMatrix, parentModelMatrix, this.getLocalModelMatrix())

    // 현재 객체 그리기
    this.draw(shaderProgram, projectionMatrix, modelMatrix)
    // 자식 객체들 그리기
    for (const child of this.children) {
      child.drawSelf(shaderProgram, projectionMatrix, modelMatrix)
    }
  }

  public getLocalModelMatrix(): mat4 {
    const modelMatrix = mat4.create()
    mat4.translate(modelMatrix, modelMatrix, this.localPosition)
    mat4.rotate(modelMatrix, modelMatrix, this.localRotation[0], [1, 0, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.localRotation[1], [0, 1, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.localRotation[2], [0, 0, 1])
    mat4.scale(modelMatrix, modelMatrix, this.localScale)
    return modelMatrix
  }

  public getWorldPosition(parentModelMatrix: mat4): vec3 {
    const worldPosition = vec3.create()
    const modelMatrix = this.getLocalModelMatrix()
    const worldMatrix = mat4.create()
    mat4.multiply(worldMatrix, parentModelMatrix, modelMatrix)
    mat4.getTranslation(worldPosition, worldMatrix)
    return worldPosition
  }

  public add(child: Node): void {
    this.children.push(child)
  }

  public setPosition(x: number, y: number, z: number): void {
    vec3.set(this.localPosition, x, y, z)
  }

  public addPosition(x: number, y: number, z: number): void {
    vec3.add(this.localPosition, this.localPosition, vec3.fromValues(x, y, z))
  }

  public setRotation(x: number, y: number, z: number): void {
    vec3.set(this.localRotation, x, y, z)
  }

  public addRotation(x: number, y: number, z: number): void {
    vec3.add(this.localRotation, this.localRotation, vec3.fromValues(x, y, z))
  }

  public setScale(x: number, y: number, z: number): void {
    vec3.set(this.localScale, x, y, z)
  }

  public addScale(x: number, y: number, z: number): void {
    vec3.add(this.localScale, this.localScale, vec3.fromValues(x, y, z))
  }

  public getAABB(): AABB | null {
    return this.aabb
  }
}
