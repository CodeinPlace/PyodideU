import { PYODIDE_BUILD, INIT_SYSTEM_CODE, RUN_MAINAPP, RESET_MODULES, SET_STEPPING_LISTS, SETUP_SCRIPT } from "./scripts.js";
import { Canvas } from "../../demo/graphics/graphics.js";
// Inits global variables
// See PyodideGlobals.ts for info
export const updateCanvas = (shapes) => {
  debouncedRedraw(shapes)
}

self.jsgraphics = {
    create_canvas: (width, height) => {
      self.canvasInfo.client = new Canvas(width, height, self.canvasInfo.getImage);
      self.canvasInfo.active = true;
      return self.canvasInfo.client
    },
    // retrieved in python trace function
    _getGraphicsState: () => {
      return {... self.canvasInfo.state}
    },
    canvasactive : () => {
      return self.canvasInfo.active
    },
    getCreateCanvasCount: () => {
      self.canvasInfo.initCount += 1
      return self.canvasInfo.initCount
    }
  };
  

self.canvasInfo = {
    client: undefined,
    active: false,
    initCount: 0,
    state: {},
    getImage: null,
    id: "canvas",
    mouseDownPromise: undefined
}
  
self.testState = {
    isTesting: false,
    testLock: undefined,
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
  ctx.fillStyle = data.color;

  ctx.strokeStyle = data.outline

  // Use the arc method to create the oval
  ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);

  // Fill the oval
  ctx.fill();
  ctx.stroke();

}


function renderCircle(ctx, data) {
  ctx.beginPath();
  ctx.fillStyle = data.color;
  ctx.arc(data.x, data.y, data.r, 0, 2 * Math.PI);
  ctx.fill();
}

self.stepInfo = {
  frames: [],
  stdout: [],
  offset: 5,
  active: false,
  currlp: 0,
  error: [],
  error_message: [],
}

self.jsPyQuery = {
  getFileName : () => {
    return `/home/pyodide/main.py`
  },

  getStep() {
    if (self.canvasInfo.active) {
      return ["graphics", deepCopy(self.canvasInfo.client.canvasObjects), self.stepInfo.currlp]
    }

    return ["", {}, self.stepInfo.currlp]

  }
}

// Step tracking
let runningPromise = null;
let initialGlobals = null;
// Output functions:
let handleOutput = (stdout, nl = true) => console.log(stdout)
let handleError = (stderr) => console.log(stderr)

let pyodide;
let code;

export async function setPyodide() {
  // check if pyodide already exists
  if (pyodide) {
    return "Pyodide Already Initialized";
  }

  // Load pyodide and packages
  pyodide = await loadPyodide({
    indexURL: PYODIDE_BUILD,
    stderr: (stderr) => handleError(stderr),
    stdout: (stdout) => handleOutput(stdout)
  });
  await pyodide.loadPackage(`${PYODIDE_BUILD}unthrow.js`);
  await pyodide.loadPackage(`${PYODIDE_BUILD}pyparsing.js`);
  await pyodide.loadPackage(`${PYODIDE_BUILD}packaging.js`);
  await pyodide.loadPackage(`${PYODIDE_BUILD}micropip.js`);

  // Run Initialization code
  await pyodide.runPythonAsync(INIT_SYSTEM_CODE);

  // Get globals
  initialGlobals = new Set(pyodide.globals.toJs().keys());
  return "Pyodide Initialization Complete";
}




// Class handles pyodide logic
export class PyodideApi {
  constructor() {
    this.isPythonRunning = false;
  }


  async handleStdin(opt="") {
    return ""
  }

  async handleRunEnd() {
    // If in step mode, set step list
    if(self.stepInfo.active) {
      await this._setStepList()
      self.stepInfo.frames = self.stepInfo.frames.map((frame) => Object.fromEntries(frame))
      const stdoutOffset = self.stepInfo.currlp - 1000;
      if(stdoutOffset > 0) {

        for(let i of self.stepInfo.frames)  {
          i["logptr"] = i["logptr"] - stdoutOffset
          i["locals"] = Object.fromEntries(i["locals"])
        }
      }
      if(self.stepInfo.error) {
        self.stepInfo.stdout.push(...self.stepInfo.error)
      }
      const newInfo = {
        lineno: -1,
        logptr: self.stepInfo.currlp + 1,
        codenm: "Program Ended",
        locals: {}
      }

      if(self.canvasInfo.active) {
        newInfo["graphics"] = { ...self.canvasInfo.client.canvasObjects }
      }

      self.stepInfo.frames.push(newInfo)
    }
    // Reset globals/Remove prior imports
    try {
      await pyodide.runPython(RESET_MODULES);
    } catch(e) {}
    this.setRunningFlag();
    try {
      // Remove files
      this._resetPyodideFS()
    } catch (e) {
      handleOutput(e.message);
    }
    if (runningPromise) {

      runningPromise.resolve()
    }
  }

  async runPython(codeToRun, activeFile, stepmode = false, uninterrupted=3000, inputSize=0, canvasId="canvas") {
    // this.setCanvasId(canvasId)
    code = codeToRun
    self.stepInfo.active = stepmode
    // self.currentFile = activeFile.name
    if(runningPromise) {
      await runningPromise.promise;
    }
    let resolveFunc;
    runningPromise = {
      promise: new Promise(function (resolve) {
        resolveFunc = resolve;
      }),
      resolve: resolveFunc,
    };
    if(pyodide) {
      // If libraries were used in last run, set as unused
      // this._resetLibraries()
      this._resetStep()
      // load imports
      await pyodide.loadPackagesFromImports(codeToRun)
      // formate and exec scripts
      const mainApp = this._formatUserCodeFunction(codeToRun)
      const setupScript = this._formatSetupScript(self.stepInfo.active, uninterrupted)
      await this._executeScripts(mainApp, setupScript)
      await runningPromise.promise
      const endStates = {
        graphics: {...self.canvasInfo.state},
        error: [...self.stepInfo.error],
        output: [...self.stepInfo.stdout],
        error_message: [...self.stepInfo.error_message],
      }

      return endStates;
    }
    else {
      // Indicate that Python is still Loading
      console.warn("Python Is Still Loading")
    }
    return {}
  }

  getStepInfo() {
    return {
      list: self.stepInfo.frames,
      logs: self.stepInfo.stdout,
    };
  }



  setInitialGlobals(ig ) {
    initialGlobals = ig;
  }

  setRunningFlag(flagValue = false) {
    // if(self.canvasInfo && self.canvasInfo.mouseDownPromise) {
    //   self.canvasInfo.mouseDownPromise.resolve()
    // }
    this.isPythonRunning = flagValue
  }



  setCanvasId(id) {
    self.canvasInfo.id = id;
  }

  getRunningFlag() {
    return this.isPythonRunning;
  }

  setOutputHandlers(
    stdoutHandler = (stdout) => console.log(stdout),
    stderrHandler = (stderr) => console.log(stderr)
  ) {
    handleOutput = stdoutHandler;
    handleError = stderrHandler;
  }



  getStepListLength() {
    if(self.stepInfo.active) {
      return self.stepInfo.frames.length
    }
    else {
      return 0
    }
  }

  getStepOutput(ptr) {
    if(self.stepInfo.active) {
      return self.stepInfo.stdout.slice(0, self.stepInfo.frames[ptr]["logptr"])
    } else {
      return []
    }
  }




  _formatUserCodeFunction(code) {
    const mainDef = `
def mainApp(___arg):
    pass`;
    const codeSplit = code.split("\n");
    let indentedCode = ``;
    let imports = ``;
    let lineNo = 0
    for (let line of codeSplit) {
      if ((line.substring(0, 4) !== "from" && line.substring(line.length - 1) !== "*")) {
        indentedCode = indentedCode + `    ${line}\n`;
      }
      else if(line !== "") {
        imports = imports + `${line}\n`;
      }
      lineNo += 1
    }

      const formattedUserCodeFunction = `
${imports}
${mainDef}
${indentedCode}
`;

    return formattedUserCodeFunction
  }

  _formatSetupScript(stepOn, uninterrupted = 3000) {
    return SETUP_SCRIPT(stepOn, uninterrupted);
  }

  async _executeScripts(mainAppScript, setupScript) {
    try {
      this.setRunningFlag(true);
      await pyodide.runPython(setupScript);
      await pyodide.runPython(mainAppScript);

      await this._runResumerCallback();
    } catch (e) {
      await this.handleRunEnd()
      this.setRunningFlag();
    }
  }

  async _runResumerCallback() {
    try {
      await pyodide.runPython(RUN_MAINAPP)
    } catch (e) {
      await this.handleRunEnd()
      this.setRunningFlag();
      return;
    }
    const userCmd = pyodide.globals.get("__unthrowActiveCommand__").toJs();
    const runFinished = pyodide.globals.get("finished");
    if(runFinished) {
      await this.handleRunEnd()
    } else if(! this.isPythonRunning) {
      handleOutput("KeyboardInterrupt")
      await this.handleRunEnd()
    } else {
      await this._handleUnthrow(userCmd);
    }
  }

  async _handleUnthrow(userCmdMap) {
    switch (userCmdMap.get("cmd")) {
      case "sleep":
        const s = userCmdMap.get("data");
        setTimeout(this._runResumerCallback.bind(this), 1000 * s);

        break;
      case "input":
        const printMsg = userCmdMap.get("data")
        const result = await this.handleStdin(printMsg);
        self.stepInfo.stdout[self.stepInfo.stdout.length - 1] = self.stepInfo.stdout[self.stepInfo.stdout.length - 1] + result
        pyodide.globals.set("____unthrowActiveInput", result);
        setTimeout(this._runResumerCallback.bind(this));
        break;
      case "awaitclick":
        await self.canvasInfo.client.wait_for_click();
        setTimeout(this._runResumerCallback.bind(this));
        break;
      default:
        setTimeout(this._runResumerCallback.bind(this));
        break;
    }
  }

   async _setStepList() {
    await pyodide.runPython(SET_STEPPING_LISTS)
    self.stepInfo.frames = pyodide.globals.get("step_list").toJs()
  }





  _resetPyodideFS() {
    for (const globalKey of pyodide.globals.toJs().keys()) {
      if (!initialGlobals.has(globalKey)) {
        pyodide.globals.delete(globalKey);
      }
    }
  }


  _resetStep() {
    self.stepInfo = {
      frames: [],
      stdout: [],
      offset: 5,
      active: self.stepInfo.active,
      currlp: 0,
      error: [],
      error_message: [],
    }
  }



}




