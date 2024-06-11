export interface OutlineProgramInfo {
  program: WebGLProgram
  attribLocations: {
    vertexPosition: number
  }
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation
    modelViewMatrix: WebGLUniformLocation
    colorBuffer: WebGLUniformLocation
    normalBuffer: WebGLUniformLocation
    outlineColor: WebGLUniformLocation
    multiplierParameters: WebGLUniformLocation
    outlineOnly: WebGLUniformLocation
    screenSize: WebGLUniformLocation
  }
}

export class OutlineShaderProgram {
  public init(gl: WebGLRenderingContext) {
    const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    
    varying vec2 vUv;
    
    void main(void)
    {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vUv = aVertexPosition.xy * 0.5 + 0.5;
    }
    
`
    const fsSource = `
    precision mediump float;
    
    uniform sampler2D uColorBuffer;
    uniform sampler2D uNormalBuffer;
    uniform vec3 uOutlineColor;
    uniform vec4 uMultiplierParameters;
    uniform bool uOutlineOnly;
    uniform vec2 uScreenSize;

    varying vec2 vUv;

    float getLinearScreenDepth(sampler2D depthTexture, vec2 uv) {
        float z = texture2D(depthTexture, uv).x;
        return 2.0 * z - 1.0;
    }

    void main(void)
    {
        // gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White color
        // return;
        // Color, depth, and normal for current pixel.
        vec4 sceneColor = texture2D(uColorBuffer, vUv);
        vec3 normal = texture2D(uNormalBuffer, vUv).rgb;

        float depth = getLinearScreenDepth(uColorBuffer, vUv);

        // Get the difference between depth of neighboring pixels and current.
        float depthDiff = 0.0;
        depthDiff += abs(depth - getLinearScreenDepth(uColorBuffer, vUv + vec2(uScreenSize.x, 0.0)));
        depthDiff += abs(depth - getLinearScreenDepth(uColorBuffer, vUv - vec2(uScreenSize.x, 0.0)));
        depthDiff += abs(depth - getLinearScreenDepth(uColorBuffer, vUv + vec2(0.0, uScreenSize.y)));
        depthDiff += abs(depth - getLinearScreenDepth(uColorBuffer, vUv - vec2(0.0, uScreenSize.y)));

        // Get the difference between normals of neighboring pixels and current
        float normalDiff = 0.0;
        normalDiff += distance(normal, texture2D(uNormalBuffer, vUv + vec2(uScreenSize.x, 0.0)).rgb);
        normalDiff += distance(normal, texture2D(uNormalBuffer, vUv - vec2(uScreenSize.x, 0.0)).rgb);
        normalDiff += distance(normal, texture2D(uNormalBuffer, vUv + vec2(0.0, uScreenSize.y)).rgb);
        normalDiff += distance(normal, texture2D(uNormalBuffer, vUv - vec2(0.0, uScreenSize.y)).rgb);

        // Apply multiplier & bias to each 
        float depthBias = uMultiplierParameters.x;
        float depthMultiplier = uMultiplierParameters.y;
        float normalBias = uMultiplierParameters.z;
        float normalMultiplier = uMultiplierParameters.w;

        depthDiff = depthDiff * depthMultiplier;
        depthDiff = clamp(depthDiff, 0.0, 1.0);
        depthDiff = pow(depthDiff, depthBias);

        normalDiff = normalDiff * normalMultiplier;
        normalDiff = clamp(normalDiff, 0.0, 1.0);
        normalDiff = pow(normalDiff, normalBias);

        float outline = normalDiff + depthDiff;

        // Combine outline with scene color.
        vec4 outlineColor = vec4(uOutlineColor, 1.0);
        gl_FragColor = mix(sceneColor, outlineColor, outline);

        if (uOutlineOnly) {
            gl_FragColor = vec4(uOutlineColor * outline, 1.0);
        }
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
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        colorBuffer: gl.getUniformLocation(shaderProgram, 'uColorBuffer'),
        normalBuffer: gl.getUniformLocation(shaderProgram, 'uNormalBuffer'),
        outlineColor: gl.getUniformLocation(shaderProgram, 'uOutlineColor'),
        multiplierParameters: gl.getUniformLocation(shaderProgram, 'uMultiplierParameters'),
        outlineOnly: gl.getUniformLocation(shaderProgram, 'uOutlineOnly'),
        screenSize: gl.getUniformLocation(shaderProgram, 'uScreenSize'),
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
