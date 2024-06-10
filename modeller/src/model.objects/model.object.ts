import { mat4, vec3 } from 'gl-matrix'
import { ProgramInfo } from '../scene'

export abstract class ModelObject {
  public localPosition: vec3
  public localRotation: vec3
  public children: ModelObject[]

  constructor() {
    this.localPosition = vec3.fromValues(0, 0, 0)
    this.localRotation = vec3.fromValues(0, 0, 0)
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

  public drawSelf(programInfo: ProgramInfo, projectionMatrix: mat4, parentModelMatrix: mat4): void {
    const modelMatrix = mat4.create()
    mat4.multiply(modelMatrix, parentModelMatrix, this.getLocalModelMatrix())

    // 현재 객체 그리기
    this.draw(programInfo, projectionMatrix, modelMatrix)
    // 자식 객체들 그리기
    for (const child of this.children) {
      child.drawSelf(programInfo, projectionMatrix, modelMatrix)
    }
  }

  public getLocalModelMatrix(): mat4 {
    const modelMatrix = mat4.create()
    mat4.translate(modelMatrix, modelMatrix, this.localPosition)
    mat4.rotate(modelMatrix, modelMatrix, this.localRotation[0], [1, 0, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.localRotation[1], [0, 1, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.localRotation[2], [0, 0, 1])
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

  public add(child: ModelObject): void {
    this.children.push(child)
  }
}
