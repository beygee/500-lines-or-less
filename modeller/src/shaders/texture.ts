export interface TextureProgramInfo {
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
    uUseBrighterColor: WebGLUniformLocation
  }
}

export class TextureShaderProgram {
  public init(gl: WebGLRenderingContext) {
    // Vertex shader program
    const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    attribute vec2 aTextureCoord;

    uniform mat4 uNormalMatrix;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 vTextureCoord;
    varying highp vec3 vLighting;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;

      // Apply lighting effect

      highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
      highp vec3 directionalLightColor = vec3(1, 1, 1);
      highp vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));

      highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);

      highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
      vLighting = ambientLight + (directionalLightColor * directional);
    }
`

    const fsSource = `
    precision mediump float;

    varying highp vec2 vTextureCoord;
    varying highp vec3 vLighting;

    uniform sampler2D uSampler;
    uniform bool uUseBrighterColor; // Boolean to control brightness

    void main(void) {
      highp vec4 texelColor = texture2D(uSampler, vTextureCoord);

      // Increase the brightness slightly if uUseBrighterColor is true
      highp vec3 color = texelColor.rgb;
      if (uUseBrighterColor) {
          color += vec3(0.15, 0.15, 0.15);
      }

      // Apply lighting and set the final color
      gl_FragColor = vec4(color * vLighting, texelColor.a);
    }
`

    // Initialize a shader program; this is where all the lighting
    // for the vertices and so forth is established.
    const shaderProgram = this.initShaderProgram(gl, vsSource, fsSource)

    // Collect all the info needed to use the shader program.
    // Look up which attribute our shader program is using
    // for aVertexPosition and look up uniform locations.
    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
        textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
        uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
        uUseBrighterColor: gl.getUniformLocation(shaderProgram, 'uUseBrighterColor'),
      },
    }

    return programInfo
  }

  //
  // Initialize a shader program, so WebGL knows how to draw our data
  //
  private initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string) {
    const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

    // Create the shader program

    const shaderProgram = gl.createProgram()
    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`)
      return null
    }

    return shaderProgram
  }

  private initOutlineShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string) {
    const outlineVertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource)
    const outlineFragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

    const outlineShaderProgram = gl.createProgram()
    gl.attachShader(outlineShaderProgram, outlineVertexShader)
    gl.attachShader(outlineShaderProgram, outlineFragmentShader)
    gl.linkProgram(outlineShaderProgram)

    if (!gl.getProgramParameter(outlineShaderProgram, gl.LINK_STATUS)) {
      alert(
        'Unable to initialize the outline shader program: ' +
          gl.getProgramInfoLog(outlineShaderProgram),
      )
      return null
    }

    return outlineShaderProgram
  }

  //
  // creates a shader of the given type, uploads the source and
  // compiles it.
  //
  private loadShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)

    // Send the source to the shader object

    gl.shaderSource(shader, source)

    // Compile the shader program

    gl.compileShader(shader)

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`)
      gl.deleteShader(shader)
      return null
    }

    return shader
  }
}
