import { loadww, run_py } from "../wrappers/webworker/main.js";


export const onThreadRunButtonClicked = () => {
    if (window.isCodeRunning) {
        window.stopExectution = true;
    } else {
        runCode()
    }
}

export const runCode = async () => {
    if(!window.editorInstance) {
        console.error('Editor instance not found');
        return
    }
    const code = window.editorInstance.getValue();
    await loadww();
    await run_py(code);
    return


}