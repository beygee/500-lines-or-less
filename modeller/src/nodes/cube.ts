import { mat4, vec3 } from 'gl-matrix'
import { Node } from './node'
import { AABB } from './aabb'
import { ShaderProgram } from '../shaders'

let cachedTexture: WebGLTexture | null = null

export class Cube extends Node {
  private gl: WebGLRenderingContext

  private positionBuffer: WebGLBuffer
  private indexBuffer: WebGLBuffer
  private textureCoordBuffer: WebGLBuffer
  private normalBuffer: WebGLBuffer

  private texture: WebGLTexture

  private vertexCount: number

  constructor(
    gl: WebGLRenderingContext,
    localPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  ) {
    super()
    this.gl = gl
    this.localPosition = vec3.fromValues(localPosition.x, localPosition.y, localPosition.z)
    this.localRotation = vec3.fromValues(0, 0, 0)
    this.initBuffers()
    this.updateAABB()
  }

  protected draw(shaderProgram: ShaderProgram, projectionMatrix: mat4, modelMatrix: mat4) {
    const { textureProgramInfo, outlineProgramInfo } = shaderProgram

    const normalMatrix = mat4.create()
    mat4.invert(normalMatrix, modelMatrix)
    mat4.transpose(normalMatrix, normalMatrix)

    this.setPositionAttribute(shaderProgram)
    this.setTextureAttribute(shaderProgram)
    this.setNormalAttribute(shaderProgram)

    // Tell WebGL which indices to use to index the vertices
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

    // Tell WebGL to use our program when drawing
    this.gl.useProgram(textureProgramInfo.program)

    this.gl.uniformMatrix4fv(
      textureProgramInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix,
    )
    this.gl.uniformMatrix4fv(
      textureProgramInfo.uniformLocations.modelViewMatrix,
      false,
      modelMatrix,
    )
    this.gl.uniformMatrix4fv(textureProgramInfo.uniformLocations.normalMatrix, false, normalMatrix)

    // Tell WebGL we want to affect texture unit 0
    this.gl.activeTexture(this.gl.TEXTURE0)

    // Bind the texture to texture unit 0
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)

    // Tell the shader we bound the texture to texture unit 0
    this.gl.uniform1i(textureProgramInfo.uniformLocations.uSampler, 0)

    if (this.picked) {
      this.gl.uniform1i(textureProgramInfo.uniformLocations.uUseBrighterColor, 1)
    } else {
      this.gl.uniform1i(textureProgramInfo.uniformLocations.uUseBrighterColor, 0)
    }

    const vertexCount = this.vertexCount
    const type = this.gl.UNSIGNED_SHORT
    const offset = 0
    this.gl.drawElements(this.gl.TRIANGLES, vertexCount, type, offset)
  }

  protected update(deltaTime: number) {
    this.updateAABB()
  }

  private initBuffers(): void {
    const positionBuffer = this.initPositionBuffer(this.gl)
    const indexBuffer = this.initIndexBuffer(this.gl)
    const textureCoordBuffer = this.initTextureBuffer(this.gl)
    const normalBuffer = this.initNormalBuffer(this.gl)

    // Check if the texture is already loaded and cached
    if (cachedTexture) {
      this.texture = cachedTexture
    } else {
      this.texture = this.loadTexture('./nodes/cubetexture.jpg')
      cachedTexture = this.texture
    }

    this.positionBuffer = positionBuffer
    this.indexBuffer = indexBuffer
    this.textureCoordBuffer = textureCoordBuffer
    this.normalBuffer = normalBuffer
    this.vertexCount = 36
  }

  private initPositionBuffer(gl: WebGLRenderingContext) {
    // Create a buffer for the square's positions.
    const positionBuffer = gl.createBuffer()

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

    // Now create an array of positions for the square.
    const positions = [
      // Front face
      -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

      // Back face
      -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,

      // Top face
      -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,

      // Bottom face
      -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,

      // Right face
      1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,

      // Left face
      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
    ]

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

    return positionBuffer
  }

  private initIndexBuffer(gl: WebGLRenderingContext) {
    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)

    // This array defines each face as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.

    const indices = [
      0,
      1,
      2,
      0,
      2,
      3, // front
      4,
      5,
      6,
      4,
      6,
      7, // back
      8,
      9,
      10,
      8,
      10,
      11, // top
      12,
      13,
      14,
      12,
      14,
      15, // bottom
      16,
      17,
      18,
      16,
      18,
      19, // right
      20,
      21,
      22,
      20,
      22,
      23, // left
    ]

    // Now send the element array to GL

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)

    return indexBuffer
  }

  private initTextureBuffer(gl: WebGLRenderingContext) {
    const textureCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer)

    const textureCoordinates = [
      // Front
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Back
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Top
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Bottom
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Right
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
      // Left
      0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    ]

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW)

    return textureCoordBuffer
  }

  private initNormalBuffer(gl: WebGLRenderingContext) {
    const normalBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)

    const vertexNormals = [
      // Front
      0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,

      // Back
      0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,

      // Top
      0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,

      // Bottom
      0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,

      // Right
      1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,

      // Left
      -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    ]

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW)

    return normalBuffer
  }

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute.
  private setPositionAttribute(shaderProgram: ShaderProgram) {
    const textureProgramInfo = shaderProgram.textureProgramInfo

    const numComponents = 3 // pull out 3 values per iteration
    const type = this.gl.FLOAT // the data in the buffer is 32bit floats
    const normalize = false // don't normalize
    const stride = 0 // how many bytes to get from one set of values to the next
    // 0 = use type and numComponents above
    const offset = 0 // how many bytes inside the buffer to start from
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.vertexAttribPointer(
      textureProgramInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset,
    )
    this.gl.enableVertexAttribArray(textureProgramInfo.attribLocations.vertexPosition)
  }

  // tell webgl how to pull out the texture coordinates from buffer
  private setTextureAttribute(shaderProgram: ShaderProgram) {
    const textureProgramInfo = shaderProgram.textureProgramInfo

    const num = 2 // every coordinate composed of 2 values
    const type = this.gl.FLOAT // the data in the buffer is 32-bit float
    const normalize = false // don't normalize
    const stride = 0 // how many bytes to get from one set to the next
    const offset = 0 // how many bytes inside the buffer to start from
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer)
    this.gl.vertexAttribPointer(
      textureProgramInfo.attribLocations.textureCoord,
      num,
      type,
      normalize,
      stride,
      offset,
    )
    this.gl.enableVertexAttribArray(textureProgramInfo.attribLocations.textureCoord)
  }

  // Tell WebGL how to pull out the normals from
  // the normal buffer into the vertexNormal attribute.
  private setNormalAttribute(shaderProgram: ShaderProgram) {
    const textureProgramInfo = shaderProgram.textureProgramInfo

    const numComponents = 3
    const type = this.gl.FLOAT
    const normalize = false
    const stride = 0
    const offset = 0
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer)
    this.gl.vertexAttribPointer(
      textureProgramInfo.attribLocations.vertexNormal,
      numComponents,
      type,
      normalize,
      stride,
      offset,
    )
    this.gl.enableVertexAttribArray(textureProgramInfo.attribLocations.vertexNormal)
  }

  //
  // Initialize a texture and load an image.
  // When the image finished loading copy it into the texture.
  //
  private loadTexture(url: string) {
    const texture = this.gl.createTexture()
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)

    // Because images have to be downloaded over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0
    const internalFormat = this.gl.RGBA
    const width = 1
    const height = 1
    const border = 0
    const srcFormat = this.gl.RGBA
    const srcType = this.gl.UNSIGNED_BYTE
    const pixel = new Uint8Array([0, 0, 255, 255]) // opaque blue
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel,
    )

    const image = new Image()
    image.onload = () => {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
      this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image)

      // WebGL1 has different requirements for power of 2 images
      // vs. non power of 2 images so check if the image is a
      // power of 2 in both dimensions.
      if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
        // Yes, it's a power of 2. Generate mips.
        this.gl.generateMipmap(this.gl.TEXTURE_2D)
      } else {
        // No, it's not a power of 2. Turn off mips and set
        // wrapping to clamp to edge
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
      }
    }
    image.src = url

    return texture
  }

  private isPowerOf2(value: number) {
    return (value & (value - 1)) === 0
  }

  private updateAABB() {
    const halfSize = vec3.fromValues(this.localScale[0], this.localScale[1], this.localScale[2])
    const min = vec3.create()
    const max = vec3.create()
    vec3.subtract(min, vec3.create(), halfSize)
    vec3.add(max, vec3.create(), halfSize)
    this.aabb = new AABB(min, max)
  }
}
