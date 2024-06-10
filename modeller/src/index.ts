import { Cube } from './cube'
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

  const cube1 = new Cube(gl, { x: 1, y: 0, z: -6 })
  const cube2 = new Cube(gl, { x: -1, y: 2, z: -10 })

  scene.add(cube1)
  scene.add(cube2)
}

window.onload = main
