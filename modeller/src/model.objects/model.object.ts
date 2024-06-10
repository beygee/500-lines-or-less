import { mat4 } from 'gl-matrix'
import { ProgramInfo } from '../scene'

export abstract class ModelObject {
  public abstract update(deltaTime: number): void
  public abstract draw(programInfo: ProgramInfo, projectionMatrix: mat4): void
}
