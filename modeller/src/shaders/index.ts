import { CrosshairProgramInfo, CrosshairShaderProgram } from './crosshair'
import { OutlineProgramInfo, OutlineShaderProgram } from './outline'
import { TextureProgramInfo, TextureShaderProgram } from './texture'

export class ShaderProgram {
  private textureShaderProgram: TextureShaderProgram
  private crosshairShaderProgram: CrosshairShaderProgram
  private outlineShaderProgram: OutlineShaderProgram

  public textureProgramInfo: TextureProgramInfo
  public crosshairProgramInfo: CrosshairProgramInfo
  public outlineProgramInfo: OutlineProgramInfo

  constructor(gl: WebGLRenderingContext) {
    this.textureShaderProgram = new TextureShaderProgram()
    this.crosshairShaderProgram = new CrosshairShaderProgram()
    this.outlineShaderProgram = new OutlineShaderProgram()

    this.textureProgramInfo = this.textureShaderProgram.init(gl)
    this.crosshairProgramInfo = this.crosshairShaderProgram.init(gl)
    this.outlineProgramInfo = this.outlineShaderProgram.init(gl)
  }
}
