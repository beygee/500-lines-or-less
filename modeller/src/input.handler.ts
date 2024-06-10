export class InputHandler {
  private keys: { [key: string]: boolean }
  private isMouseDown: boolean
  private mouseMoveCallback: (xOffset: number, yOffset: number) => void

  constructor() {
    this.keys = {}
    this.isMouseDown = false
    this.mouseMoveCallback = () => {}

    this.initEventHandlers()
  }

  private initEventHandlers(): void {
    window.addEventListener('keydown', (e) => (this.keys[e.code] = true))
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false))
    window.addEventListener('mousedown', () => (this.isMouseDown = true))
    window.addEventListener('mouseup', () => (this.isMouseDown = false))
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e))
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isMouseDown) {
      const xOffset = event.movementX
      const yOffset = event.movementY
      this.mouseMoveCallback(xOffset, yOffset)
    }
  }

  public isKeyPressed(code: string): boolean {
    return this.keys[code] || false
  }

  public onMouseMove(callback: (xOffset: number, yOffset: number) => void): void {
    this.mouseMoveCallback = callback
  }
}
