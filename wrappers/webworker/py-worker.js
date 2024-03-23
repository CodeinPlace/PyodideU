import { updateCanvas } from "./main.js";

let pyodideWorker;
if (typeof window !== "undefined") {
    window.codeRunning = false;
}
const callbacks = {};

const interruptExecution = () => {
    // sometimes, the program does not handle the interrupt
    // so, we'll just keep trying to interrupt until we
    // get confirmation that the program has stopped
    // Basically, we'll keep hitting ctrl-c until we stop the program!
    window.codeRunning = false;
    pyodideWorker.terminate();
    setupWorker();
}

const setupWorker = () => {
  console.log("here1")
    pyodideWorker = new Worker("/webworker/webworker.js");

    window.pyodideWorker = pyodideWorker;

    pyodideWorker.onmessage = async (event) => {
        const { id, ...data } = event.data;
        if( event.data.outputText) {
          console.log(event.data.outputText)
        }
        else if (event.data.cmd === 'updateCanvas') {
            updateCanvas(event.data.dict);
        }
        else if (event.data.cmd === 'end') {
          window.onEndPromise.resolve()
      }

        else if (event.data.cmd === 'getMousePos') {
            const lastX = window.lastMouse.x;
            const lastY = window.lastMouse.y;

            pyodideWorker.postMessage({cmd: "mouse_pos", x: lastX, y: lastY});
        }

        else if (event.data.cmd === 'getMouseDown') {
            const lastX = window.lastMouseDown.x;
            const lastY = window.lastMouseDown.y;
            // update so we indicate that we've read it
            window.lastMouseDown.x = -1;
            window.lastMouseDown.y = -1;
            pyodideWorker.postMessage({cmd: "mouse_down", x: lastX, y: lastY});
        }

        else if (event.data.cmd === 'getImageWidth') {
            const canvas = document.getElementById('mainCanvas');
            const obj = canvas._objects[event.data.obj];
            // may have to wait for image to load
            const waitForLoad = () => {
                if (obj.imageLoaded) {
                    pyodideWorker.postMessage({cmd:"image_width", width: obj.image.width});
                } else {
                    setTimeout(waitForLoad, 0);
                }
            }
            waitForLoad();
        }

        else if (event.data.cmd === 'getImageHeight') {
            const canvas = document.getElementById('mainCanvas');
            const obj = canvas._objects[event.data.obj];
            // may have to wait for image to load
            const waitForLoad = () => {
                if (obj.imageLoaded) {
                    pyodideWorker.postMessage({cmd:"image_height", height: obj.image.height});
                } else {
                    setTimeout(waitForLoad, 0);
                }
            }
            waitForLoad();
        }

        else if (event.data.cmd === 'getCanvasSize') {
            const canvas = document.querySelector('#mainCanvas');
            pyodideWorker.postMessage({cmd: "canvas_size", width: canvas.width, height: canvas.height});
        }
        else if (event.data.cmd === 'clearTerminal') {
          console.log("clearing")
        }
        else {
            window.codeRunning = false;
            const onSuccess = callbacks[id];
            delete callbacks[id];
            if (typeof(onSuccess) === 'function') {
                onSuccess(data);
            } else {
                console.log("Error: " + onSuccess);
            }
        }
    };
    console.log("here2")

}

const sendMessageToWorker = (message) => {
    // console.log("Sending ");
    // console.log({'control': true, "message": message});
    pyodideWorker.postMessage({'control': true, "message": message});
};

const passSharedBuffer = (buf, waitBuf) => {
    pyodideWorker.postMessage({'buffer': buf, 'waitBuffer': waitBuf});
}

const asyncRun = ((script, context, stepSleep=50) => {
    let id = 0; // identify a Promise
    return (script, context, stepSleep) => {
        // the id could be generated more carefully
        id = (id + 1) % Number.MAX_SAFE_INTEGER;
        window.codeRunning = true;
        return new Promise((onSuccess) => {
            callbacks[id] = onSuccess;

            pyodideWorker.postMessage({
                ...context,
                python: script,
                id,
                stepSleep,
            });
        });
    };
})();

const consoleListener = () => {
    // first, check to see that the original text is still
    // present (otherwise, change back)
    pyodideWorker.postMessage({cmd: "input_result", value: prompt()});

}

const getInputFromTerminal = () => {

}

const updateSpeed = () => {
    console.log("updating speed2");
    const speed = document.querySelector('#speed-slider').value;
    console.log("speed:", speed);
    pyodideWorker.postMessage({cmd: "run_speed", stepSleep:speed});
}

export { setupWorker, asyncRun, sendMessageToWorker, interruptExecution, updateSpeed };
