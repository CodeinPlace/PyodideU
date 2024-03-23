import * as _ from "../graphics/graphics.js";
import { setPyodide, PyodideApi } from '../wrappers/unthrow/unthrow.js';

let pyodideClient = new PyodideApi();
let stepList = [];
let stepLogs = [];
const STEP_MODE = true;



export const onUnthrowRunButtonClicked = () => {
    if (window.isCodeRunning) {
        pyodideClient.setRunningFlag(false)
    } else {
        runCode();
    }
}


export const onStepScroll = (e) => {
    const stepAsString = e.target.value
    const step = parseInt(stepAsString)
    const currentStep = stepList[step]
    window.highlightLine(currentStep.lineno)
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
}


const runCode = async () => {
    window.isCodeRunning = true;
    document.getElementById('runButton').innerText = 'Running...';
    pyodideClient.setOutputHandlers(window.handleStdout, window.handleStderr)
    try {
        if (window.editorInstance) {
            const code = window.editorInstance.getValue();
            await setPyodide();
            const result = await pyodideClient.runPython(code, { name: "main.py" }, STEP_MODE);
            if(STEP_MODE) {
                const stepInfo = pyodideClient.getStepInfo();
                stepList = stepInfo.list
                stepLogs = stepInfo.logs
                updateStepScroll()

            }
            console.log("Result:", result)
        } else {
            console.error('Editor instance not found');
        }
    } catch (error) {
        console.error('Error running code', error);
    }
    document.getElementById('runButton').innerText = 'Run';
    window.isCodeRunning = false;
    window.handleStdout("%");
}