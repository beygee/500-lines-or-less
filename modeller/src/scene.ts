import { mat4 } from 'gl-matrix'
import { Cube } from './model.objects/cube'
import { ShaderProgram } from './shader'
import { ModelObject } from './model.objects/model.object'
import { Camera } from './camera'
import { InputHandler } from './input.handler'

export interface ProgramInfo {
  program: WebGLProgram
  attribLocations: {
    vertexPosition: number
    vertexNormal: number
    textureCoord: number
  }
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation
    modelViewMatrix: WebGLUniformLocation
    normalMatrix: WebGLUniformLocation
    uSampler: WebGLUniformLocation
  }
}

export class Scene {
  private gl: WebGLRenderingContext
  private programInfo: any
  private then: number
  private camera: Camera
  private inputHandler: InputHandler

  private children: ModelObject[]

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
    this.initShaders()

    this.children = []
    this.then = 0
    this.camera = new Camera()

    this.inputHandler = new InputHandler()

    this.inputHandler.onMouseMove((xOffset, yOffset) => {
      this.camera.processMouseMovement(xOffset, yOffset)
    })

    requestAnimationFrame((now) => this.render(now))
  }

  public add(modelObject: ModelObject): void {
    this.children.push(modelObject)
  }

  private initShaders(): void {
    // Initialize shaders, programInfo, and attribute/uniform locations here.
    // This method should set up this.programInfo with the necessary shader program and locations.
    const shaderProgram = new ShaderProgram()
    const programInfo = shaderProgram.init(this.gl)
    this.programInfo = programInfo
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
    this.update(deltaTime)
    this.drawScene()

    requestAnimationFrame((now) => this.render(now))
  }

  private update(deltaTime: number): void {
    for (const modelObject of this.children) {
      modelObject.updateSelf(deltaTime)
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

    for (const modelObject of this.children) {
      modelObject.drawSelf(this.programInfo, projectionMatrix, viewMatrix)
    }
  }
}
