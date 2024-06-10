import { mat4 } from 'gl-matrix'
import { ProgramInfo } from '../scene'

export abstract class ModelObject {
  public position: { x: number; y: number; z: number }
  public rotation: { x: number; y: number; z: number }
  public children: ModelObject[]

  constructor() {
    this.position = { x: 0, y: 0, z: 0 }
    this.rotation = { x: 0, y: 0, z: 0 }
    this.children = []
  }

  protected abstract update(deltaTime: number): void
  protected abstract draw(
    programInfo: ProgramInfo,
    projectionMatrix: mat4,
    modelViewMatrix: mat4,
  ): void

  public updateSelf(deltaTime: number): void {
    // 각 객체의 고유한 업데이트 로직
    this.update(deltaTime)
    // 자식 객체들 업데이트
    for (const child of this.children) {
      child.updateSelf(deltaTime)
    }
  }

  public drawSelf(programInfo: ProgramInfo, projectionMatrix: mat4, modelViewMatrix: mat4): void {
    // 현재 객체 그리기
    this.draw(programInfo, projectionMatrix, modelViewMatrix)
    // 자식 객체들 그리기
    for (const child of this.children) {
      const childModelViewMatrix = mat4.create()
      mat4.multiply(childModelViewMatrix, modelViewMatrix, child.getModelMatrix())
      child.drawSelf(programInfo, projectionMatrix, childModelViewMatrix)
    }
  }

  public getModelMatrix(): mat4 {
    const modelMatrix = mat4.create()
    mat4.translate(modelMatrix, modelMatrix, [this.position.x, this.position.y, this.position.z])
    mat4.rotate(modelMatrix, modelMatrix, this.rotation.x, [1, 0, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.rotation.y, [0, 1, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.rotation.z, [0, 0, 1])
    return modelMatrix
  }

  public add(child: ModelObject): void {
    this.children.push(child)
  }
}
