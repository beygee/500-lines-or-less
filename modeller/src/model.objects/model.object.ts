import { mat4 } from 'gl-matrix'
import { ProgramInfo } from '../scene'

export abstract class ModelObject {
  public position: { x: number; y: number; z: number }
  public rotation: { x: number; y: number; z: number }

  public abstract update(deltaTime: number): void
  public abstract draw(
    programInfo: ProgramInfo,
    projectionMatrix: mat4,
    modelViewMatrix: mat4,
  ): void

  public getModelMatrix(): mat4 {
    const modelMatrix = mat4.create()
    mat4.translate(modelMatrix, modelMatrix, [this.position.x, this.position.y, this.position.z])
    mat4.rotate(modelMatrix, modelMatrix, this.rotation.x, [1, 0, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.rotation.y, [0, 1, 0])
    mat4.rotate(modelMatrix, modelMatrix, this.rotation.z, [0, 0, 1])
    return modelMatrix
  }
}
