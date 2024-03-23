import { waitForPyodide } from "./site.js"


export const loadww = async () => {
  console.log("loading")
  await waitForPyodide()
  console.log("loaded")
}

export const run_py = async (code) => {
  let resolveFn;

  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
  });

  promise.resolve = resolveFn;

  console.log("here")
  console.log(window.run_pyodide)
  await window.run_pyodide(code,promise)
  await promise
}




export const updateCanvas = (shapes) => {
  debouncedRedraw(shapes)
}

let debouncedTimer  = null;


function debouncedRedraw(shapes) {
  const framesPerSecond = 60;
  const timeout = 1000 / framesPerSecond;
  if (!debouncedTimer) {
    debouncedTimer = setTimeout(() => {
      redrawShapes(shapes);
    }, timeout);
  }
}


function redrawShapes(shapes){
  // clear the debounced timer
  clearTimeout(debouncedTimer);
  debouncedTimer = null;
  window.requestAnimationFrame(() => {
    window.context.clearRect(0, 0, 400, 400);
    for (let objectId in shapes) {

      const data = shapes[objectId];
      if(!data || data.isHidden) continue;
      const objectType = data["type"];
      switch (objectType) {
        case "oval": renderOval(window.context, data); break;
      }
    }
  });
}

function renderOval(ctx, data) {

  var width = data.rightX - data.leftX;
  var height = data.bottomY - data.topY;

  // Calculate the center of the bounding box
  var centerX = data.leftX + width / 2;
  var centerY = data.topY + height / 2;

  // Start a new path
  ctx.beginPath();

  // Set the color
  ctx.strokeStyle = data.outline

  // Use the arc method to create the oval
  ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);

  // Fill the oval
  ctx.stroke();

}
