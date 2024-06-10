import { mat4 } from 'gl-matrix'

export class Box {
  gl: WebGLRenderingContext
  position: [number, number, number]
  positionBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer

  constructor(gl: WebGLRenderingContext, x: number, y: number, z: number) {
    this.gl = gl
    this.position = [x, y, z]
    this.initBuffers()
  }

  initBuffers() {
    this.positionBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)

    const positions = [
      1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
      1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ]

    const indices = [
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0, 3, 7, 0, 7, 4, 1,
      2, 6, 1, 6, 5,
    ]

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW)

    this.indexBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW)
  }

  draw(programInfo, projectionMatrix) {
    const modelViewMatrix = mat4.create()
    mat4.translate(modelViewMatrix, modelViewMatrix, this.position)

    {
      const numComponents = 3
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
      this.gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset,
      )
      this.gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition)
    }

    this.gl.useProgram(programInfo.program)

    this.gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix)
    this.gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix)

    {
      const offset = 0
      const vertexCount = 36
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
      this.gl.drawElements(this.gl.TRIANGLES, vertexCount, this.gl.UNSIGNED_SHORT, offset)
    }
  }
}
