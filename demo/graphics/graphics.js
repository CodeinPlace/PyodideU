// @ts-nocheck

import { GraphicTypes } from "./graphicsStructs.js";

var mouse_x = 0;
var mouse_y = 0;
var mouse_clicks = [];
var key_presses = [];
var imageCache = {};


function mouseMoved(e) {
  const canvas = document.getElementById(self.canvasInfo.id);
  const rect = canvas.getBoundingClientRect();
  mouse_x = Math.round(e.clientX - rect.left);
  mouse_y = Math.round(e.clientY - rect.top);
  e.stopPropagation(); // necessary in case the event is added twice
}

function mouseDown(e) {

  const canvas = document.getElementById(self.canvasInfo.id);
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  mouse_clicks.push([clickX, clickY]);
  e.stopPropagation(); // necessary in case the event is added twice
  if(self.canvasInfo.mouseDownPromise) {
    self.canvasInfo.mouseDownPromise.resolve()
  }
}

function keyPressed(e) {
  if(key_presses.length > 200) {
    key_presses.shift()
  }
  key_presses.push(e.key)
}

/**
 * Extension of TK:
 * This graphics library is an extension of tk. It should be able to
 * support the functions students would expect to use if implementing
 * a game like breakout. It also needs to work both in native python
 * and in pyodide. The most notable extension is that that mouse clicks
 * and mouse moves are specially written so that students do not need
 * classes or globals to write graphics.
 *
 * Debouncing redraws:
 * Our graphics library keeps track of objects (like tk). This means
 * that it needs to clear the canvas and redraw on our own, though
 * the user can do that too. There are two use cases
 * 1. a user draws static content and expects it to show up
 * 2. a user has an animation loop
 * I propose using a debounced redraw which fires if the canvas has
 * changed and over 1/20 seconds has passed since last redraw
 * Question: Could a user get a faster animation if we wrote our
 * own time.sleep?
 *
 * Collision detection:
 * We should keep track of a quad tree
 *
 * Images:
 * This is tricky and I don't have a good solution. Users give just image
 * paths. The actual image will be stored in our bucket with a link that
 * is saved in the firestore
 *
 * Z-Index:
 * We currently do not consider order of images
 */


export class Canvas {
  constructor(width, height, getImageURL) {
    this.canvas = document.getElementById(self.canvasInfo.id);
    this.getImageURL = getImageURL;
    mouse_x = -1;
    mouse_y = -1;
    mouse_clicks = [];
    key_presses = [];
    this.width = width;
    this.height = height;
    this.canvas.setAttribute("width", width);
    this.canvas.setAttribute("height", height);
    this.canvas.setAttribute("display", "");
    this.context = this.canvas.getContext("2d");
    this.canvas.style.width = width.toString() + "px";
    this.canvas.style.height = height.toString() + "px";
    this.context.clearRect(0, 0, width, height);
    this.canvas.addEventListener("mousemove", mouseMoved);
    this.canvas.addEventListener("mousedown", mouseDown);
    window.addEventListener('keydown',keyPressed);
    this.canvas.focus()


    this.debouncedTimer = null;
    this.canvasObjects = {};
    this.nextId = 0;
    this.dataList = [];
  }

  get_width() {
    return this.width;
  }

  get_height() {
    return this.height;
  }



  create_line(x1, y1, x2, y2, color = "black") {
    const objectId = this._getNextObjectId();
    this.canvasObjects[objectId] = {
      type: "line",
      start: [x1, y1],
      end: [x2, y2],
      color,
    };
    this.debouncedRedraw();
    return objectId;
  }

  create_rectangle(leftX, topY, rightX, bottomY, color = "black", outline="TRANSPARENT") {
    const objectId = this._getNextObjectId();
    this.canvasObjects[objectId] = {
      type: "rectangle",
      leftX,
      topY,
      rightX,
      bottomY,
      color,
      outline
    };
    this.debouncedRedraw();
    return objectId;
  }

  set_on_click(callback, ...args) {
    this.onClick = callback.create_once_callable();
    this.onClickArgs = args;
  }

  delete(objectId) {
    delete this.canvasObjects[objectId];
  }

  create_image(x, y, filePath) {
    const objectId = this._getNextObjectId();
    this.canvasObjects[objectId] = {
      type: "image",
      url: this.getImageURL(filePath),
      x,
      y,
    };
    this.debouncedRedraw();

    return objectId;
  }

  create_image_with_size(x, y, width, height, filePath) {
    const objectId = this._getNextObjectId();
    this.canvasObjects[objectId] = {
      type: "image",
      url: this.getImageURL(filePath),
      x,
      y,
      width,
      height,
    };
    this.debouncedRedraw();

    return objectId;
  }
  create_text(x, y, text,
    font="Arial",
    font_size="12px",
    color="BLACK",
    anchor="nw" ) {

    const objectId = this._getNextObjectId();
        this.canvasObjects[objectId] = {
          type: "text",
          x,
          y,
          text,
          anchor,
          color,
          size: font_size,
          font
    };
    this.debouncedRedraw();
    return objectId;
  }

  create_oval(leftX, topY, rightX, bottomY, color = "BLACK", outline="TRANSPARENT") {
    // Calculate the width and height of the bounding box
    const objectId = this._getNextObjectId();
    this.canvasObjects[objectId] = {
      type: "oval",
      leftX,
      topY,
      rightX,
      bottomY,
      color,
      outline
    };
    this.debouncedRedraw();
    return objectId;

  }

  create_polygon(coordinates, color="BLACK", outline="TRANSPARENT") {
    const objectId = this._getNextObjectId();
    this.canvasObjects[objectId] = {
      type: "polygon",
      coordinates:coordinates.toJs(),
      color,
      outline
    };
    this.debouncedRedraw();
    return objectId;
  }

  coords(objectId) {
    return [this.get_left_x(objectId), this.get_top_y(objectId)]
  }


  clear() {
    this.canvasObjects = {};
    this.context.clearRect(0, 0, this.width, this.height);
  }

  draw_circle(center_x, center_y, radius, color) {
    // depricated. not consistent with TK
    return this.create_circle(center_x, center_y, radius, color);
  }

  // WARNING: recipient needs to call .to_py() to convert the JS list proxy to python
  find_overlapping(leftX, topY, rightX, bottomY) {
    // not inclusive
    const cords = {
      leftX:leftX+1,
      topY:topY+1,
      rightX:rightX-1,
      bottomY:bottomY-1,
      width: rightX - leftX,
      height: bottomY - topY
    };
    // TODO: keep a quad tree to make this a more efficient algorithm
    const overlapping = [];
    for (let objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];

      if (_isOverlapping(data, cords)) {
        overlapping.push(objectId);
      }
    }
    return overlapping;
  }

  get_mouse_x() {
    return mouse_x;
  }

  get_mouse_y() {
    return mouse_y;
  }

  sleep(delta) {
    // not ready yet
    this.redraw();
    if (this.lastSleep) {
      delta = Date.now() - this.lastSleep;
    }
    this.lastSleep = Date.now();
  }

  move(objectId, dx, dy) {
    if (objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];
      const objectType = data.type;
      if (objectType == "rectangle" || objectType == "oval") {
        data.leftX += dx;
        data.rightX += dx;
        data.topY += dy;
        data.bottomY += dy;
      }
      if (objectType == "image") {
        data.x += dx;
        data.y += dy;
      }
      if (objectType == "line") {
        data.start[0] += dx;
        data.start[1] += dy;
        data.end[0] += dx;
        data.end[1] += dy;
      }
      this.debouncedRedraw();
    }
  }

  moveto(objectId, newX, newY) {
    if (objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];
      const objectType = data.type;
      if (objectType == "rectangle" || objectType == "oval") {
        const width = data.rightX - data.leftX;
        const height = data.bottomY - data.topY;
        data.leftX = newX;
        data.rightX = newX + width;
        data.topY = newY;
        data.bottomY = newY + height;
      }
      if (objectType == "image") {
        data.x = newX;
        data.y = newY;
      }
      if (objectType == "line") {
        const dx = newX - data.start[0];
        const dy = newY - data.start[1];
        this.move(objectId, dx, dy);
      }
      this.debouncedRedraw();
    }
  }

  get_left_x(objectId) {
    if (objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];
      switch (data.type) {
        case "text":
        case "image":
          return data.x;
        case "oval":
        case "rectangle":
          return data.leftX;
        case "line":
          return Math.min(data.start[0], data.end[0]);
      }
    }
    return null;
  }

  get_top_y(objectId) {
    if (objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];
      switch (data.type) {
        case "text":
        case "image":
          return data.y;
        case "oval":
        case "rectangle":
          return data.topY;
        case "line":
          return Math.min(data.start[1], data.end[1]);
      }
    }
    return null;
  }

  get_x(objectId) {
    // depricated
    return this.get_left_x(objectId);
  }

  get_y(objectId) {
    // depricated
    return this.get_top_y(objectId);
  }

  get_object_width(objectId) {
    if (objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];
      switch (data.type) {
        case "image":
          if(data.width) {
            return data.width;
          }
          break;
        case "oval":
        case "rectangle":
          return data.rightX - data.leftX;
        case "line":
          return Math.max(data.start[0], data.end[0]) - Math.min(data.start[0], data.end[0]);
      }
    }
    return null;
  }

  change_text(objectId, text) {
    if(this.canvasObjects[objectId].type === "text") {
      this.canvasObjects[objectId].text = text
      this.debouncedRedraw()
    }
  }

  get_object_height(objectId) {
    if (objectId in this.canvasObjects) {
      const data = this.canvasObjects[objectId];
      switch (data.type) {
        case "image":
          if(data.height) {
            return data.height;
          }
          break;
        case "oval":
        case "rectangle":
          return data.bottomY - data.topY;
        case "line":
          return Math.max(data.start[1], data.end[1]) - Math.min(data.start[1], data.end[1]);
      }
    }
    return null;
    return 0
  }


  mainloop() {
    // TODO
    console.log("mainloop")
    return
  }


  set_hidden(objectId, isHidden) {
    if( objectId in this.canvasObjects) {
      this.canvasObjects[objectId].isHidden = isHidden
    }
    this.debouncedRedraw()
    return;
  }

  set_color(objectId, color) {
    if( objectId in this.canvasObjects) {
      this.canvasObjects[objectId].color = color
    }
    this.debouncedRedraw()
    return;
  }

  set_outline_color(objectId, color) {
    if( objectId in this.canvasObjects) {
      this.canvasObjects[objectId].outline = color
    }
    this.debouncedRedraw()
    return;
  }

  async wait_for_click() {
    let resolveFunc;
// Returns object with promise member and resolve member
self.canvasInfo.mouseDownPromise =   {
        promise: new Promise(function (resolve, reject) {
          resolveFunc = resolve;
        }),
        resolve: resolveFunc,
      };

    await self.canvasInfo.mouseDownPromise.promise
    self.canvasInfo.mouseDownPromise = undefined;
  }

  get_last_click() {
    // return mouse_clicks[mouse_clicks.length - 1]
    return mouse_clicks.pop();
  }

  get_new_mouse_clicks() {
    // TODO
    const clicks = [...mouse_clicks]
    mouse_clicks = []
    return clicks;

  }


  get_new_key_presses() {
    // TODO
    const new_presses = [...key_presses]
    key_presses = [];
    return new_presses

  }

  get_last_key_press() {
    // change this to just return the last key press
    // without poping it off the stack
    // return key_presses[key_presses.length - 1]
    return key_presses.pop();
  }

  // WEB DEVELOPMENT ADD ONS
  create_button(title, location) {
    // TODO
  }

  get_new_button_clicks() {
    // TODO

  }

  create_text_field(label, location) {
    // TODO

  }

  delete_text_field(text_field_name) {
    // TODO

  }

  get_text_field_text(text_field_name) {
    // TODO

  }

  debouncedRedraw() {
    self.canvasInfo.active = true;
    this.saveState();
    if (self.testState.isTesting) {
      return;
    }
    const framesPerSecond = 60;
    const timeout = 1000 / framesPerSecond;
    if (!this.debouncedTimer) {
      this.debouncedTimer = setTimeout(() => {
        this.redraw();
      }, timeout);
    }
  }

  redraw() {
    this.redrawShapes(this.canvasObjects)
  }

  redrawShapes(shapes){
    // clear the debounced timer
    clearTimeout(this.debouncedTimer);
    this.debouncedTimer = null;
    const ctx = this.context;
    window.requestAnimationFrame(() => {
      this.canvas.setAttribute('aria-label', this.composeAltText(shapes))
      this.context.clearRect(0, 0, this.width, this.height);
      for (let objectId in shapes) {
        const data = shapes[objectId];
        if(!data || data.isHidden) continue;
        const objectType = data["type"];
        switch (objectType) {
          case "text": renderText(ctx, data); break;
          case "oval": renderOval(ctx, data); break;
          case "rectangle": renderRectangle(ctx, data); break;
          case "line": renderLine(ctx, data); break;
          case "image": renderImage(ctx, data, this); break;
          case "polygon": renderPolygon(ctx, data); break;
        }
      }
    });
  }

  redrawStep(canvasObjects) {
    this.redrawShapes(canvasObjects)
  }

  composeAltText(shapes) {
    // get metadata about canvas
    const numShapes = Object.keys(shapes).length
    let metadataText = ''
    if (numShapes == 0) {
      return "The canvas is currently blank."
    }
    if (numShapes == 1) {
      metadataText = `There is 1 shape on the canvas.\n`
    } else {
      metadataText = `There are ${numShapes} shapes on the canvas.\n`
    }

    let objectText = ""
    Object.entries(shapes).map(([shapeName, shape]) => {
      const type = shape.type
      const colorCase = shape.color?.charAt(0).toUpperCase() + shape.color?.slice(1);

      switch (type) {
        case GraphicTypes.OVAL:
          objectText += `${colorCase} oval with ${shape.outline} outline starting at (${shape.leftX}, ${shape.topY}) and ending at (${shape.rightX}, ${shape.bottomY}).\n`
          break
        case GraphicTypes.RECTANGLE:
          objectText += `${colorCase} rectangle with ${shape.outline} outline starting at (${shape.leftX}, ${shape.topY}) and ending at (${shape.rightX}, ${shape.bottomY}).\n`
          break
        case GraphicTypes.LINE:
          objectText += `${colorCase} line starting at ${shape.start} and ending at ${shape.end}.\n`
          break
        case GraphicTypes.IMAGE:
          objectText += `Image positioned at (${shape.x}, ${shape.y}).\n`
          if (shape.width && shape.height) {
            objectText += `Image has height of ${shape.height} and width of ${shape.width}`
          }
          break
        case GraphicTypes.TEXT:
          objectText += `Text positioned at (${shape.x}, ${shape.y}).\n`
          objectText += `The text is styled with ${shape.size} font size, ${shape.color} color, and ${shape.font} font.\n`
          objectText += `Text content: ${shape.text}.\n`
          break
        case GraphicTypes.POLYGON:
          objectText += `${colorCase} polygon with ${shape.outline} outline. Vertices at ${shape.coordinates}.\n`
          break
      }


    })
    return metadataText + objectText
  }

  _getNextObjectId() {
    let toReturn = this.nextId;
    this.nextId += 1;
    return `shape_${toReturn}`;
  }

  saveState() {
    self.canvasInfo.state = {...this.canvasObjects};
  }
}

function renderCircle(ctx, data) {
  if(data.isHidden) {return;}

  ctx.beginPath();
  ctx.fillStyle = data.color;
  ctx.arc(data.x, data.y, data.radius, 0, 2 * Math.PI);
  ctx.fill();
}
function renderOval(ctx, data) {
  if(data.isHidden) {return;}

  var width = data.rightX - data.leftX;
  var height = data.bottomY - data.topY;

  // Calculate the center of the bounding box
  var centerX = data.leftX + width / 2;
  var centerY = data.topY + height / 2;

  // Start a new path
  ctx.beginPath();

  // Set the color
  ctx.fillStyle = data.color;

  ctx.strokeStyle = data.outline

  // Use the arc method to create the oval
  ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);

  // Fill the oval
  ctx.fill();
  ctx.stroke();

  ctx.fill();
  ctx.stroke();

}
function renderText(ctx, data) {
  if(data.isHidden) {return;}

  const [anchorHorizontal, anchorVertical] = _tkinterAnchorToCanvas(data.anchor)
  // const fontString = data.size + " " + data.font
  // console.log(fontString)
  ctx.font = data.size + " " + data.font || '16px Arial';
  // ctx.font = '24px Arial'
  ctx.fillStyle = data.color || 'black';
  ctx.textAlign = anchorHorizontal;
  ctx.textBaseline = anchorVertical;
  // this.ctx.textAlign = data.anchor || 'start';

  // Draw the text
  ctx.fillText(data.text, data.x, data.y);

}
function renderPolygon(ctx, data) {
  if(data.isHidden) {return;}

  ctx.beginPath();
  ctx.fillStyle = data.color;
  ctx.strokeStyle = data.outline;
  ctx.moveTo(data.coordinates[0], data.coordinates[1]);

  for (let i = 2; i < data.coordinates.length; i+=2) {
    ctx.lineTo(data.coordinates[i], data.coordinates[i+1]);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
function renderRectangle(ctx, data) {
  if(data.isHidden) {return;}

  ctx.beginPath();
  ctx.fillStyle = data.color;
  ctx.strokeStyle = data.outline

  ctx.rect(
    data.leftX,
    data.topY,
    data.rightX - data.leftX,
    data.bottomY - data.topY
  );
  ctx.fill();
  ctx.stroke();

}
function renderImage(ctx, data, canvasClass) {
  if(data.isHidden) {return;}

  if (data.url in imageCache) {
    if (data.width) {
      ctx.drawImage(imageCache[data.url], data.x, data.y, data.width, data.height);
    } else {
      ctx.drawImage(imageCache[data.url], data.x, data.y);
    }
  } else {
    var img = new Image();
    img.onload = function () {
      if (data.width) {
        ctx.drawImage(img, data.x, data.y, data.width, data.height);
      } else {
        ctx.drawImage(img, data.x, data.y);
      }
      canvasClass.debouncedRedraw();
    };
    img.src = data.url;
    imageCache[data.url] = img;
  }
}
function renderLine(ctx, data) {

  if(data.isHidden) {return;}
  ctx.beginPath();
  ctx.strokeStyle = data.color;
  ctx.moveTo(data.start[0], data.start[1]);
  ctx.lineTo(data.end[0], data.end[1]);
  ctx.stroke();
}

function _isOverlapping(data, cords) {
  switch (data.type) {
    case "rectangle":
      return _isRectOverlapping(data, cords);
    case "oval":
      return _isOvalOverLapping(data, cords);
    case "line":
      return _isLineOverLapping(data, cords);
    case "image":
      return _isImageOverLapping(data, cords);
  }
  return false;
}

function _isRectOverlapping(r1, r2) {
  return !(
    r2.leftX > r1.rightX ||
    r2.rightX < r1.leftX ||
    r2.topY > r1.bottomY ||
    r2.bottomY < r1.topY
  );
}

function _isOvalOverLapping(o1, o2) {
  return _isRectOverlapping(o1, o2);
}

function _isLineOverLapping(data, coords) {
  if (_isPointInRectangle(data.start, coords) || _isPointInRectangle(data.end, coords)) {
      return true;
  }

  // Check for intersection with each side of the rectangle
  const coordsLines = [
      // Top line
      {start: [coords.leftX, coords.topY], end: [coords.rightX, coords.topY]},
      // Right line
      {start: [coords.rightX, coords.topY], end: [coords.rightX, coords.bottomY]},
      // Bottom line
      {start: [coords.rightX, coords.bottomY], end: [coords.leftX, coords.bottomY]},
      // Left line
      {start: [coords.leftX, coords.bottomY], end: [coords.leftX, coords.topY]},
  ];

  for (let coordsLine of coordsLines) {
      if (_lineIntersect(data, coordsLine)) {
          return true;
      }
  }

  // No intersection found
  return false;
}

function _isPointInRectangle(point, coords) {
  return (
      point[0] >= coords.leftX &&
      point[0] <= coords.rightX &&
      point[1] >= coords.topY &&
      point[1] <= coords.bottomY
  );
}

function _lineIntersect(data1, data2) {
  let data1StartX = data1.start[0];
  let data1StartY = data1.start[1];
  let data1EndX = data1.end[0];
  let data1EndY = data1.end[1];

  let data2StartX = data2.start[0];
  let data2StartY = data2.start[1];
  let data2EndX = data2.end[0];
  let data2EndY = data2.end[1];

  let denominator = ((data2EndY - data2StartY) * (data1EndX - data1StartX)) - ((data2EndX - data2StartX) * (data1EndY - data1StartY));

  // Make sure the lines aren't parallel
  if (denominator === 0) return false;

  let ua = ((data2EndX - data2StartX) * (data1StartY - data2StartY) - (data2EndY - data2StartY) * (data1StartX - data2StartX)) / denominator;
  let ub = ((data1EndX - data1StartX) * (data1StartY - data2StartY) - (data1EndY - data1StartY) * (data1StartX - data2StartX)) / denominator;

  // Check if there is an intersection
  return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
}

function _isImageOverLapping(data, coords) {
  // Assuming images are objects with properties x, y, width, height
  // Create temporary rectangles to represent the images
  if(! data.width || ! data.height) {
    return false;
  }
  const image1Rect = {leftX: data.x, rightX: data.x + data.width, topY: data.y, bottomY: data.y + data.height};
  return _isRectOverlapping(image1Rect, coords);
}



function _isPointOverlapping(point, cords) {
  if (point.x < cords.leftX) return false;
  if (point.y < cords.topY) return false;
  if (point.x > cords.rightX) return false;
  if (point.y > cords.bottomY) return false;
  return true;
}

function _tkinterAnchorToCanvas(anchor) {
  const anchorUpper = anchor.toUpperCase();
  let hAlign, vAlign;

  switch (anchorUpper) {
    case 'N':
        hAlign = 'center';
        vAlign = 'top';
        break;
    case 'NE':
        hAlign = 'right';
        vAlign = 'top';
        break;
    case 'E':
        hAlign = 'right';
        vAlign = 'middle';
        break;
    case 'SE':
        hAlign = 'right';
        vAlign = 'bottom';
        break;
    case 'S':
        hAlign = 'center';
        vAlign = 'bottom';
        break;
    case 'SW':
        hAlign = 'left';
        vAlign = 'bottom';
        break;
    case 'W':
        hAlign = 'left';
        vAlign = 'middle';
        break;
    case 'NW':
        hAlign = 'left';
        vAlign = 'top';
        break;
    case 'CENTER':
    default:
        hAlign = 'center';
        vAlign = 'middle';
        break;
}

  return [hAlign, vAlign];
}
