# PyodideU
## A system for running blockable Python in the browser, with [Pyodide](https://pyodide.org) and [Unthrow](https://github.com/joemarshall/unthrow), built specifically for CS1

### Features
* Line by line debugger with access to local variable scope.
* Synchronous I/O
* Graphics!

# Demo (Work in Progress)
1. Run `npm install`
2. Then to run the main thread version by running `npm run main` or the web worker version by running `npm run thread`.

# TODO: 
- [ ] Add docs
- [ ] Add graphics, stdout, stderr to webworker demo
- [ ] Add input to both demos
- [ ] Fix stepper on unthrow demo

Please see our paper for more info and contact details: https://dl.acm.org/doi/pdf/10.1145/3626252.3630913

Our work builds upon the work done with Pyodide, and Unthrow (Joe Marshall), so go check them out too!
Pyodide: https://pyodide.org
Unthrow: https://github.com/joemarshall/unthrow
