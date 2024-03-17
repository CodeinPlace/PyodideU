


class TestCanvas {
  constructor(updateCanvas) {
    this.canvasObjs = {}
    this.nextId = 0;
    this.updateCanvas = updateCanvas;

  }


  _getNextObjectId() {
    let toReturn = this.nextId;
    this.nextId += 1;
    return `shape_${toReturn}`;
  }


  create_oval(leftX, topY, rightX, bottomY) {
    const objectId = this._getNextObjectId()
    const type = "oval"
    this.canvasObjs[objectId] = {
      type,
      leftX,
      topY,
      bottomY,
      rightX
    }
    this.updateCanvas(this.canvasObjs)
    return objectId;
  }

  move(objectId, dx, dy) {
    this.canvasObjs[objectId].leftX += dx;
    this.canvasObjs[objectId].rightX += dx;
    this.canvasObjs[objectId].topY += dy;
    this.canvasObjs[objectId].bottomY += dy;


    this.updateCanvas(this.canvasObjs)
  }

}
