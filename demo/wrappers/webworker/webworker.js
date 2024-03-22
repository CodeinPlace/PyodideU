// webworker.js

// import { TestCanvas } from "../graphics/Canvas";

// Setup your project to serve `py-worker.js`. You should also serve
// `pyodide.js`, and all its associated `.asm.js`, `.data`, `.json`,
// and `.wasm` files as well:
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.1/full/pyodide.js");
// importScripts("./drawingPyLib2.js");
// importScripts("./platypusPyLib.js");

importScripts("/graphics/Canvas.js")


const tGraph = {
  create_canvas: () => {
    const canvas = new TestCanvas(updateCanvas)
    return canvas
  }
}

self.create_canvas = () => {
  console.log("here")
  const canvas = new TestCanvas(updateCanvas)
  return canvas
}


const MAX_SPEED = 1000;

async function loadPyodideAndPackages() {
    let first = true;
    self.pyodide = await loadPyodide({
        stdout: text => {
            if (text == "Python initialization complete" && first) {
                first = false;
                return;
            }
            // console.log("output: " + text);
            self.postMessage({outputText: text + '\n'});
        },
        stderr: text => {
            // console.log("output: " + text);
            self.postMessage({outputText: text + '\n'});
        }
    });

    console.log("loaded")
    // await self.pyodide.loadPackage(["numpy", "pytz"]);
}
let pyodideReadyPromise =  loadPyodideAndPackages();;

self.jsMessage = null;

self.onmessage = async (event) => {
    if (event.data.cmd === "stopProgram") {
        console.log("got stopProgram message");
        check_for_stop.stopped = true;
    }
    else if (event.data.cmd === "input_result") {
        console.log("got input!");
        input_fixed.inputResult = event.data.value;
    }


    else if (event.data.cmd === 'run_speed') {
        this.stepSleep = event.data.stepSleep;
    }
    else if (event.data.control !== undefined) {
        console.log("Control event");
        self.jsMessage = event.data.message;
    }
    else if (event.data.buffer !== undefined) {
        // got the shared buffers
        self.sharedArr = new Uint8Array(event.data.buffer);
        self.waitArr = new Int32Array(event.data.waitBuffer);
    }
    else {
        // make sure loading is done
        console.log("waiting")
        await pyodideReadyPromise;
        console.log("I've waited")

        self.pyodide.setInterruptBuffer(self.interruptBuffer);
        // Don't bother yet with this line, suppose our API is built in such a way:
        let { id, python, stepSleep, ...context } = event.data;
        this.stepSleep = stepSleep;
        // The worker copies the context in its own "memory" (an object mapping name to values)
        for (const key of Object.keys(context)) {
            self[key] = context[key];
        }
        check_for_stop.stopped = false;
        // Now is the easy part, the one that is similar to working in the main thread:

        try {

            await self.pyodide.runPythonAsync(`
            from js import input_fixed
            import asyncio
            import pyodide
            __builtins__.input = input_fixed
            `);
            // await self.pyodide.runPythonAsync(drawingLib);
            // await self.pyodide.runPythonAsync(platypusLib);
            await self.pyodide.loadPackagesFromImports(python);
            python = fixTimeImport(python)
            console.log(python)
            let results = await self.pyodide.runPythonAsync(python);
            self.postMessage({ cmd: "end" });

            self.postMessage({ results, id });
        } catch (error) {
          console.log("ERROR HERE", error)
            self.postMessage({ error: error.message, id });
        }
    }
};

const waitForInput = (r) => {
    if (input_fixed.inputResult !== null) {
        return r(input_fixed.inputResult);
    }
    setTimeout(() => {
        waitForInput(r);
    }, 100);
}

async function input_fixed(text, first) {
    console.log("input requested: " + text)
    input_fixed.inputResult = null;
    self.postMessage({outputText: text, getInput: true});
    return new Promise((r) => setTimeout(() => {
        waitForInput(r);
    }));

    if (first) {
        console.log("input requested: " + text)
        input_fixed.inputResult = null;
        self.postMessage({outputText: text, getInput: true});
    } else {
        // console.log('.');
        // check for result
        // see if we can force the message to be read
        return pyodide.toPy({'done': true, 'result': "5"});
        if (input_fixed.inputResult !== null) {
            return pyodide.toPy({'done': true, 'result': inputResult});
        }
    }
    return pyodide.toPy({'done': false, 'result': 0});
};

function sleep_fixed(t_sec) {
    return new Promise(resolve => setTimeout(resolve, t_sec * 1000));
}


const fixTimeImport = (code) => {
    // this function finds `import time` and on the next line
    // it inserts code to fix the time.sleep function to work with pyodide
    // Notes:
    // 1. it does not fix "import time, sys" constructs
    const insertCode1 = 'import time; from js import sleep_fixed; time.sleep = sleep_fixed\n';
    const insertCode2 = 'from time import sleep; from js import sleep_fixed; sleep = sleep_fixed\n';
    code = code.replace('import time\n', insertCode1);
    code = code.replace('from time import sleep\n', insertCode2);
    return code;
}

function updateCanvas(dict) {
    self.postMessage({cmd: 'updateCanvas', 'dict': dict});
}

const waitForMousePos = (r) => {
    if (getMousePos.x !== null && getMousePos.y !== null) {
        return r(pyodide.toPy({'x': getMousePos.x, 'y': getMousePos.y}));
    }
    setTimeout(() => {
        waitForMousePos(r);
    });
}

async function getMousePos(x_or_y) {
    getMousePos.x = null;
    getMousePos.y = null;
    self.postMessage({cmd: 'getMousePos'});
    return new Promise((r) => setTimeout(() => {
        waitForMousePos(r);
    }));
}

const waitForImageWidth = (r) => {
    if (getImageWidth.result !== null) {
        return r(getImageWidth.result);
    }
    setTimeout(() => {
        waitForImageWidth(r);
    });
}

async function getImageWidth(obj) {
    getImageWidth.result = null;
    self.postMessage({cmd: 'getImageWidth', obj: obj});
    return new Promise((r) => setTimeout(() => {
        waitForImageWidth(r);
    }));
}

const waitForImageHeight = (r) => {
    if (getImageHeight.result !== null) {
        return r(getImageHeight.result);
    }
    setTimeout(() => {
        waitImageHeight(r);
    });
}

async function getImageHeight(obj) {
    getImageHeight.result = null;
    self.postMessage({cmd: 'getImageHeight', obj: obj});
    return new Promise((r) => setTimeout(() => {
        waitForImageHeight(r);
    }));
}

const waitForMouseDown = (r) => {
    if (getMouseDown.x !== null && getMouseDown.y !== null) {
        return r(pyodide.toPy({'x': getMouseDown.x, 'y': getMouseDown.y}));
    }
    setTimeout(() => {
        waitForMouseDown(r);
    });
}

function getMouseDown(x_or_y) {
    getMouseDown.x = null;
    getMouseDown.y = null;
    self.postMessage({cmd: 'getMouseDown'});
    return new Promise((r) => setTimeout(() => {
        waitForMouseDown(r);
    }));
}

const waitForCanvasSize = (r) => {
    if (getCanvasSize.width !== null && getCanvasSize.height !== null) {
        return r(pyodide.toPy({'width': getCanvasSize.width, 'height': getCanvasSize.height}));
    }
    setTimeout(() => {
        waitForCanvasSize(r);
    });
}

function getCanvasSize() {
    getCanvasSize.width = null;
    getCanvasSize.height = null;
    self.postMessage({cmd: 'getCanvasSize'});
    return new Promise((r) => setTimeout(() => {
        waitForCanvasSize(r);
    }));
}

function clearTerminal() {
    self.postMessage({cmd: 'clearTerminal'});
}

function check_for_stop() {
    if (check_for_stop.count === undefined) {
        check_for_stop.count = 0;
    } else {
        check_for_stop.count++;
    }
    if (check_for_stop.count % 1000 == 0) {
        console.log(check_for_stop.count);
    }
    // return new Promise(resolve => setTimeout(resolve, 0, check_for_stop.stopped));
    return Promise.resolve(check_for_stop.stopped);
}

const until = (predFn) => {
  const poll = (done) => (predFn() ? done() : setTimeout(() => {
      poll(done);
  }, 1));
  return new Promise(poll);
};

