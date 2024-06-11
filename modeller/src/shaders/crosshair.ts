export interface CrosshairProgramInfo {
  program: WebGLProgram
  attribLocations: {
    vertexPosition: number
  }
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation
    modelViewMatrix: WebGLUniformLocation
  }
}

export class CrosshairShaderProgram {
  public init(gl: WebGLRenderingContext): CrosshairProgramInfo {
    const vertexShaderSource = `
    attribute vec4 aVertexPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uModelViewMatrix;

    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
`
    const fragmentShaderSource = `
    void main(void) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White color
    }
    `

    const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

    const shaderProgram = gl.createProgram()
    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram))
      return null
    }

    return {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      },
    }
  }

  private loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }
}
