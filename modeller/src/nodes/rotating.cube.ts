import { Cube } from './cube'

export class RotatingCube extends Cube {
  private rotationSpeed: number

  constructor(
    gl: WebGLRenderingContext,
    localPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    rotationSpeed: number = 1,
  ) {
    super(gl, localPosition)
    this.rotationSpeed = rotationSpeed
  }

  protected update(deltaTime: number): void {
    super.update(deltaTime)
    this.localRotation[0] += this.rotationSpeed * deltaTime
    this.localRotation[1] += this.rotationSpeed * deltaTime
    this.localRotation[2] += this.rotationSpeed * deltaTime
  }
}
