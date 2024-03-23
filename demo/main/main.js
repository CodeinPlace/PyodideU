

import { PYODIDEU } from "./statics.js";
import { onUnthrowRunButtonClicked, onStepScroll } from "./unthrowHelpers.js";
import { onThreadRunButtonClicked } from "./threadHelper.js";

const TYPE = window.location.port === '8080' ? PYODIDEU.MAIN : PYODIDEU.THREAD;

let buffer = '';
let debounceTimer;
window.isCodeRunning = false;



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

window.handleStdout = (output) => {
    console.log("Output:", output)
    if(output === "__PREMESSAGE_TEST_IGNORE__") {
        return
    }
    buffer += output + '\n';
    scheduleFlush();
}

window.handleStderr = (error) => {
    console.log('Error:', error)
    buffer += `<span class="error">${error}</span>\n`;
    scheduleFlush();
}



require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    window.editorInstance = monaco.editor.create(document.getElementById('editor'), {
        value: [
            '# Your Python code goes here'
        ].join('\n'),
        language: 'python'
    });

    window.highlightLine = function(lineNumber) {
        const highlightStyle = {
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
                isWholeLine: true,
                className: 'myHighlightClass'
            }
        };

        // Apply the decoration
        window.editorInstance.deltaDecorations([], [highlightStyle]);
    };
});




window.handleStdout("%");

if (TYPE === PYODIDEU.MAIN) {
    console.log("is main")
    document.getElementById('runButton').onclick = onUnthrowRunButtonClicked;
    document.getElementById("step-scroll").onchange = onStepScroll;
} else if (TYPE === PYODIDEU.THREAD) {
    document.getElementById('runButton').onclick = onThreadRunButtonClicked;
}