import * as _ from "../graphics/graphics.js";
import { setPyodide, PyodideApi } from '../wrappers/unthrow/unthrow.js';

let editorInstance;
let pyodideClient = new PyodideApi();
let isCodeRunning = false;
let buffer = '';
let debounceTimer;
let stepList = [];
let stepLogs = [];
let highlightLine;

const STEP_MODE = true;

function appendToTerminal() {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML += buffer;
    buffer = '';

    // Limit to 200 lines
    let lines = terminal.innerHTML.split('\n');
    if (lines.length > 200) {
        lines = lines.slice(lines.length - 200);
    }
    terminal.innerHTML = lines.join('\n');
    terminal.scrollTop = terminal.scrollHeight; // Scroll to the bottom
}

function scheduleFlush() {
    if (!debounceTimer) {
        debounceTimer = setTimeout(() => {
            appendToTerminal();
            debounceTimer = null;
        }, 100); // Adjust debounce time as needed
    }
}

function handleStdout(output) {
    if(output === "__PREMESSAGE_TEST_IGNORE__") {
        return
    }
    buffer += output + '\n';
    scheduleFlush();
}

function handleStderr(error) {
    console.log('Error:', error)
    buffer += `<span class="error">${error}</span>\n`;
    scheduleFlush();
}



require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editorInstance = monaco.editor.create(document.getElementById('editor'), {
        value: [
            '# Your Python code goes here'
        ].join('\n'),
        language: 'python'
    });

    highlightLine = function(lineNumber) {
        const highlightStyle = {
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
                isWholeLine: true,
                className: 'myHighlightClass'
            }
        };

        // Apply the decoration
        editorInstance.deltaDecorations([], [highlightStyle]);
    };
});



const onRunButtonClick = () => {
    if (isCodeRunning) {
        pyodideClient.setRunningFlag(false)
    } else {
        runCode();
    }
}

const updateStepScroll = () => {
    const min = 0
    const max = stepList.length - 1
    console.log(stepList)
    const stepper = document.getElementById('step-scroll')
    stepper.max = max
    stepper.min = min
    stepper.value = max
    stepper.disabled = max === 0
    console.log('set max', max)
    console.log("set min", min)
    console.log(editorInstance)
    editorInstance.
}

const onStepScroll = (e) => {
    const stepAsString = e.target.value
    const step = parseInt(stepAsString)
    const currentStep = stepList[step]
    highlightLine(currentStep.lineno)



}


const runCode = async () => {
    isCodeRunning = true;
    document.getElementById('runButton').innerText = 'Running...';
    pyodideClient.setOutputHandlers(handleStdout, handleStderr)
    try {
        if (editorInstance) {
            const code = editorInstance.getValue();
            await setPyodide();
            const result = await pyodideClient.runPython(code, { name: "main.py" }, STEP_MODE);
            if(STEP_MODE) {
                const stepInfo = pyodideClient.getStepInfo();
                stepList = stepInfo.list
                stepLogs = stepInfo.logs
                updateStepScroll()
                console.log(stepList)

            }
            console.log("Result:", result)
        } else {
            console.error('Editor instance not found');
        }
    } catch (error) {
        console.error('Error running code', error);
    }
    document.getElementById('runButton').innerText = 'Run';
    isCodeRunning = false;
    handleStdout("%");
}

document.getElementById('runButton').onclick = onRunButtonClick;
document.getElementById("step-scroll").onchange = onStepScroll;
handleStdout("%");
