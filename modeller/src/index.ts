import { Cube } from './nodes/cube'
import { Node } from './nodes/node'
import { RotatingCube } from './nodes/rotating.cube'
import { Scene } from './scene'

function main() {
  const canvas = document.querySelector('#glcanvas') as HTMLCanvasElement
  // Initialize the GL context
  const gl = canvas.getContext('webgl')

  // Only continue if WebGL is available and working
  if (gl === null) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.')
    return
  }

  // Flip image pixels into the bottom-to-top order that WebGL expects.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

  const scene = new Scene(gl)

  // const cube = new Cube(gl, { x: 0, y: 0, z: -10 })

  // const cube2 = new Cube(gl, { x: 2, y: 2, z: 2 })
  // const cube3 = new Cube(gl, { x: 2, y: 2, z: 2 })

  // cube.add(cube2)
  // cube2.add(cube3)

  // cube.setRotation(1, 1, 0.5)

  // scene.add(cube)

  const ground = new Node()
  generateTerrain(gl, ground)
  scene.add(ground)

  const cube1 = new RotatingCube(gl, { x: 8, y: -1, z: -20 })
  const cube2 = new RotatingCube(gl, { x: -2, y: 2, z: 0 })
  // cube2.setScale(0.5, 0.5, 0.5)

  scene.add(cube1)
  cube1.add(cube2)
}

function generateTerrain(gl: WebGLRenderingContext, ground: Node) {
  for (let i = -5; i < 5; i++) {
    for (let j = -5; j < 5; j++) {
      const cube = new Cube(gl, { x: i * 2, y: -5, z: j * 2 - 5 })
      ground.add(cube)
    }
  }

  const heightLevels = [-3, -1, 1, 3, 5, 7]
  const iLimits = [0, -2, -4, -6, -8, -10]
  const jOffsets = [15, 17, 19, 21, 23, 25]

  for (let k = 0; k < heightLevels.length; k++) {
    for (let i = -10; i <= iLimits[k]; i += 2) {
      for (let j = -15; j <= -i - jOffsets[k]; j += 2) {
        ground.add(new Cube(gl, { x: i, y: heightLevels[k], z: j }))
      }
    }
  }
}

window.onload = main
