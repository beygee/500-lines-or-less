import { mat4, vec3 } from 'gl-matrix'
import { TextureProgramInfo, TextureShaderProgram } from './shaders/texture'
import { Node } from './nodes/node'
import { Camera } from './camera'
import { InputHandler } from './input.handler'
import { Raycaster } from './raycast'
import { CrosshairProgramInfo, CrosshairShaderProgram } from './shaders/crosshair'
import { ShaderProgram } from './shaders'

export class Scene {
  private gl: WebGLRenderingContext
  private shaderProgram: ShaderProgram
  private then: number
  private camera: Camera
  private inputHandler: InputHandler

  private children: Node[]

  private crosshairBuffer: WebGLBuffer

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
    this.initShaders()
    this.crosshairBuffer = this.initCrosshairBuffers()

    this.children = []
    this.then = 0
    this.camera = new Camera()

    this.inputHandler = new InputHandler()

    this.inputHandler.onMouseMove((xOffset, yOffset) => {
      this.camera.processMouseMovement(xOffset, yOffset)
    })

    requestAnimationFrame((now) => this.render(now))
  }

  public add(node: Node): void {
    this.children.push(node)
  }

  private initShaders(): void {
    this.shaderProgram = new ShaderProgram(this.gl)
  }

  private processInput(deltaTime: number): void {
    if (this.inputHandler.isKeyPressed('KeyW')) {
      this.camera.processKeyboard('FORWARD', deltaTime)
    }
    if (this.inputHandler.isKeyPressed('KeyS')) {
      this.camera.processKeyboard('BACKWARD', deltaTime)
    }
    if (this.inputHandler.isKeyPressed('KeyA')) {
      this.camera.processKeyboard('LEFT', deltaTime)
    }
    if (this.inputHandler.isKeyPressed('KeyD')) {
      this.camera.processKeyboard('RIGHT', deltaTime)
    }
  }

  private render(now: number): void {
    now *= 0.001 // convert to seconds
    const deltaTime = now - this.then
    this.then = now

    this.processInput(deltaTime)
    this.processRaycast()
    this.update(deltaTime)
    this.drawScene()

    this.drawCrosshair(this.crosshairBuffer)

    requestAnimationFrame((now) => this.render(now))
  }

  private update(deltaTime: number): void {
    for (const node of this.children) {
      node.updateSelf(deltaTime)
    }
  }

  private drawScene(): void {
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0)
    this.gl.clearDepth(1.0)
    this.gl.enable(this.gl.DEPTH_TEST)
    this.gl.depthFunc(this.gl.LEQUAL)

    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)

    // Set the drawing position to the "identity" point, which is the center of the scene.
    const fieldOfView = (45 * Math.PI) / 180
    // @ts-ignore
    const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight
    const zNear = 0.1
    const zFar = 100.0
    const projectionMatrix = mat4.create()
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar)

    const viewMatrix = this.camera.getViewMatrix()

    for (const node of this.children) {
      node.drawSelf(this.shaderProgram, projectionMatrix, viewMatrix)
    }
  }

  private processRaycast(): void {
    const origin = this.camera.position
    const direction = this.camera.getFrontDirection()
    const raycaster = new Raycaster(origin, direction)
    const hitNode = raycaster.intersectNodes(this.children, mat4.create()) // Pass identity matrix as the initial parent model matrix

    for (const node of this.children) {
      this.resetPickedState(node)
    }

    if (hitNode) {
      hitNode.picked = true
    }
  }

  private resetPickedState(node: Node): void {
    node.picked = false
    for (const child of node.children) {
      this.resetPickedState(child)
    }
  }

  private initCrosshairBuffers(): WebGLBuffer {
    // Crosshair vertices
    const crosshairVertices = new Float32Array([
      -0.015,
      0.0,
      0.0, // Horizontal line
      0.015,
      0.0,
      0.0,
      0.0,
      -0.02,
      0.0, // Vertical line
      0.0,
      0.02,
      0.0,
    ])

    // Create a buffer for the crosshair's positions.
    const crosshairBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, crosshairBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, crosshairVertices, this.gl.STATIC_DRAW)

    return crosshairBuffer
  }

  private drawCrosshair(crosshairBuffer: WebGLBuffer) {
    const projectionMatrix = mat4.create()
    const modelViewMatrix = mat4.create()
    mat4.ortho(projectionMatrix, -1, 1, -1, 1, -1, 1) // Orthographic projection

    this.gl.useProgram(this.shaderProgram.crosshairProgramInfo.program)

    this.gl.uniformMatrix4fv(
      this.shaderProgram.crosshairProgramInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix,
    )
    this.gl.uniformMatrix4fv(
      this.shaderProgram.crosshairProgramInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix,
    )

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, crosshairBuffer)
    this.gl.vertexAttribPointer(
      this.shaderProgram.crosshairProgramInfo.attribLocations.vertexPosition,
      3,
      this.gl.FLOAT,
      false,
      0,
      0,
    )
    this.gl.enableVertexAttribArray(
      this.shaderProgram.crosshairProgramInfo.attribLocations.vertexPosition,
    )

    this.gl.drawArrays(this.gl.LINES, 0, 4)
  }
}
