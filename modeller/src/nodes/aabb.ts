import { mat4, vec3 } from 'gl-matrix'

export class AABB {
  public min: vec3
  public max: vec3

  constructor(min: vec3, max: vec3) {
    this.min = min
    this.max = max
  }

  // 충돌 감지 메서드
  public intersects(other: AABB): boolean {
    return (
      this.min[0] <= other.max[0] &&
      this.max[0] >= other.min[0] &&
      this.min[1] <= other.max[1] &&
      this.max[1] >= other.min[1] &&
      this.min[2] <= other.max[2] &&
      this.max[2] >= other.min[2]
    )
  }

  // 레이캐스팅 메서드 (Ray-AABB Intersection Test)
  public intersectRay(origin: vec3, direction: vec3): boolean {
    let t1 = (this.min[0] - origin[0]) / direction[0]
    let t2 = (this.max[0] - origin[0]) / direction[0]

    let t3 = (this.min[1] - origin[1]) / direction[1]
    let t4 = (this.max[1] - origin[1]) / direction[1]

    let t5 = (this.min[2] - origin[2]) / direction[2]
    let t6 = (this.max[2] - origin[2]) / direction[2]

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6))

    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6))

    if (tmax < 0) {
      return false
    }

    if (tmin > tmax) {
      return false
    }

    return true
  }

  public transform(matrix: mat4): AABB {
    const min = vec3.create()
    const max = vec3.create()
    vec3.transformMat4(min, this.min, matrix)
    vec3.transformMat4(max, this.max, matrix)
    return new AABB(min, max)
  }
}
