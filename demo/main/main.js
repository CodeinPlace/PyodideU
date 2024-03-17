import * as _ from "../graphics/graphics.js";
import { setPyodide, PyodideApi } from '../wrappers/unthrow/unthrow.js';

let editorInstance;
let pyodideClient = new PyodideApi();
let isCodeRunning = false;
let buffer = '';
let debounceTimer;

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
});



const onRunButtonClick = () => {
    if (isCodeRunning) {
        pyodideClient.setRunningFlag(false)
    } else {
        runCode();
    }
}

const runCode = async () => {
    isCodeRunning = true;
    document.getElementById('runButton').innerText = 'Running...';
    pyodideClient.setOutputHandlers(handleStdout, handleStderr)
    try {
        if (editorInstance) {
            const code = editorInstance.getValue();
            await setPyodide();
            await pyodideClient.runPython(code, { name: "main.py" });
        } else {
            console.error('Editor instance not found');
        }
    } catch (error) {
        console.error('Error running code', error);
    }
    document.getElementById('runButton').innerText = 'Run';
    isCodeRunning = false;
}

document.getElementById('runButton').onclick = onRunButtonClick;
