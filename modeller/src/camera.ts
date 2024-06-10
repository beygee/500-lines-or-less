import { vec3, mat4 } from 'gl-matrix'

export class Camera {
  public position: vec3
  public front: vec3
  public up: vec3
  public right: vec3
  private worldUp: vec3
  private yaw: number
  private pitch: number
  private speed: number
  private sensitivity: number

  constructor(position: vec3 = vec3.fromValues(0, 0, 3), yaw: number = -90, pitch: number = 0) {
    this.position = position
    this.worldUp = vec3.fromValues(0, 1, 0)
    this.yaw = yaw
    this.pitch = pitch
    this.front = vec3.fromValues(0, 0, -1)
    this.right = vec3.create()
    this.up = vec3.create()
    this.speed = 5
    this.sensitivity = 0.1

    this.updateCameraVectors()
  }

  public getViewMatrix(): mat4 {
    const viewMatrix = mat4.create()
    const center = vec3.create()
    vec3.add(center, this.position, this.front)
    mat4.lookAt(viewMatrix, this.position, center, this.up)
    return viewMatrix
  }

  public processKeyboard(direction: string, deltaTime: number): void {
    const velocity = this.speed * deltaTime
    if (direction === 'FORWARD') {
      vec3.scaleAndAdd(this.position, this.position, this.front, velocity)
    }
    if (direction === 'BACKWARD') {
      vec3.scaleAndAdd(this.position, this.position, this.front, -velocity)
    }
    if (direction === 'LEFT') {
      vec3.scaleAndAdd(this.position, this.position, this.right, -velocity)
    }
    if (direction === 'RIGHT') {
      vec3.scaleAndAdd(this.position, this.position, this.right, velocity)
    }
  }

  public processMouseMovement(xoffset: number, yoffset: number, constrainPitch = true): void {
    xoffset *= this.sensitivity
    yoffset *= this.sensitivity

    this.yaw += xoffset
    this.pitch -= yoffset // y-coordinates range from bottom to top

    if (constrainPitch) {
      if (this.pitch > 89.0) this.pitch = 89.0
      if (this.pitch < -89.0) this.pitch = -89.0
    }

    this.updateCameraVectors()
  }

  private updateCameraVectors(): void {
    const front = vec3.create()
    front[0] = Math.cos(this.yaw * (Math.PI / 180)) * Math.cos(this.pitch * (Math.PI / 180))
    front[1] = Math.sin(this.pitch * (Math.PI / 180))
    front[2] = Math.cos(this.pitch * (Math.PI / 180)) * Math.sin(this.yaw * (Math.PI / 180))
    vec3.normalize(this.front, front)

    vec3.cross(this.right, this.front, this.worldUp)
    vec3.normalize(this.right, this.right)

    vec3.cross(this.up, this.right, this.front)
    vec3.normalize(this.up, this.up)
  }
}
