// Globals
import { setupWorker,
  asyncRun,
  sendMessageToWorker,
  interruptExecution,
  updateSpeed,
} from "./py-worker.js";



var platypus = {};
var world = {};

const MAIN_CANVAS_WIDTH = 250;
const FINAL_CANVAS_WIDTH = 250;
const INIT_ROWS = 5;
const INIT_COLS = 5;
const INSERTION_CODE = '# __insertion will start here (leave this line)__';


export const waitForPyodide = async () => {
  if (window.loadPyodide !== undefined) {
      window.pyodide  = await window.loadPyodide();
      window.stopExecution = false; // we aren't running

      setupWorker();
  } else {
      console.log("waiting for pyodide...");
      setTimeout(waitForPyodide, 500);
  }
}


const populateWorldSelector = (numWorlds) => {
  const worldSelector = document.querySelector('#world-selector');
  worldSelector.innerHTML = '';
  for (let i = 0; i < numWorlds; i++) {
      const opt = '<option value="' + i + '">' + (i + 1) + '</option>';
      worldSelector.innerHTML += opt;
  }
}

const changeWorld = () => {
  window.currentWorldIdx = parseInt(document.querySelector('#world-selector').value);
  const world = window.worlds[currentWorldIdx];
  window.world = world;
  world.drawWorld();
  updateCorrectBox('');
}
if (typeof window !== "undefined") {
  window.changeWorld = changeWorld;
}

const rotatePlatypus = (clockwise) => {
  let directionMap;
  if (clockwise) {
      directionMap = { E: 'S', S: 'W', W: 'N', N: 'E', };
      addCommandToProgram('turn_right()');
  } else {
      directionMap = { E: 'N', S: 'E', W: 'S', N: 'W', };
      addCommandToProgram('turn_left()');
  }
  const platypus = window.world._platypus.current;
  const new_dir = directionMap[platypus.direction];
  platypus.direction = new_dir;
  window.world.drawWorld();
}
if (typeof window !== "undefined") {
  window.rotatePlatypus = rotatePlatypus;
}

const gridLoc = (row, col) => row * world.numCols + col;

const check_is_water = (area) => {
  // area: 'front', 'side', 'right'
  const grid = window.world._grids.current;
  const platypus = window.world._platypus.current;
  const numRows = window.world.numRows;
  const numCols = window.world.numCols;
  let temp_direction = platypus.direction; // front
  if (area == 'left') {
      const directionMap = { E: 'N', S: 'E', W: 'S', N: 'W', };
      temp_direction = directionMap[platypus.direction];
  } else if (area == 'right') {
      const directionMap = { E: 'S', S: 'W', W: 'N', N: 'E', };
      temp_direction = directionMap[platypus.direction];
  }

  switch(temp_direction) {
      case 'E':
          if (platypus.col == numCols - 1 ||
              grid[platypus.row][platypus.col + 1].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          break;
      case 'S':
          if (platypus.row == numRows - 1 ||
              grid[platypus.row + 1][platypus.col].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          break;
      case 'W':
          if (platypus.col == 0 ||
              grid[platypus.row][platypus.col - 1].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          break;
      case 'N':
          if (platypus.row == 0 ||
              grid[platypus.row - 1][platypus.col].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          break;
  }
  return true;
}

if (typeof window !== "undefined") {
  window.check_is_water = check_is_water;
}

const movePlatypus = (base) => {
  const grid = window.world._grids.current;
  const platypus = window.world._platypus.current;

  // mode and color must match
  if (base != grid[platypus.row][platypus.col].base) {
      return false;
  }

  switch(platypus.direction) {
          // cannot go out of bounds or through land
      case 'E':
          if (platypus.col == window.world.numCols - 1 ||
              grid[platypus.row][platypus.col + 1].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          platypus.col++;
          break;
      case 'S':
          if (platypus.row == window.world.numRows - 1 ||
              grid[platypus.row + 1][platypus.col].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          platypus.row++;
          break;
      case 'W':
          if (platypus.col == 0 ||
              grid[platypus.row][platypus.col - 1].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          platypus.col--;
          break;
      case 'N':
          if (platypus.row == 0 ||
              grid[platypus.row - 1][platypus.col].base == 'l') {
              // alert("Cannot go outside of grid!");
              return false;
          }
          platypus.row--;
          break;
  }
  switch (base) {
      case 'w':
          addCommandToProgram('swim()');
          break;
  }

  window.world.drawWorld();
  return true;
}
if (typeof window !== "undefined") {
  window.movePlatypus = movePlatypus;
}

const facing = (direction) => {
  return window.world._platypus.current.direction == direction;
}
if (typeof window !== "undefined") {
  window.facing = facing;
}

const count = (who, obj) => {
  let objects;
  switch(who) {
      case 'platypus':
          objects = window.world._platypus.current;
          break;
      case 'square':
          objects = window.world._grids.current[window.world._platypus.current.row][window.world._platypus.current.col];
          break;
  }
  if (obj in objects) {
      return objects[obj];
  } else {
      return 0;
  }
}
if (typeof window !== "undefined") {
  window.count = count;
}

const pick_up = (item) => {
  const grid = window.world._grids.current;
  const platypus = window.world._platypus.current;
  const currentSpace = grid[platypus.row][platypus.col];

  if (item in currentSpace) {
      if (currentSpace[item] > 0) {
          currentSpace[item]--;
          if (currentSpace[item] == 0) {
              delete currentSpace[item];
          }
          addCommandToProgram("pick_up('" + item + "')");
          window.world.drawWorld();
          return true;
      }
  }
  return false;
}
if (typeof window !== "undefined") {
  window.pick_up = pick_up;
}

const put_down = (obj) => {
  const grid = window.world._grids.current;
  const platypus = window.world._platypus.current;
  const currentSpace = grid[platypus.row][platypus.col];

  if (platypus[obj] > 0) {
      platypus[obj]--;
      if (!(obj in currentSpace)) {
          currentSpace[obj] = 0;
      }
      currentSpace[obj]++;
      addCommandToProgram("put_down('egg')");
      window.world.drawWorld();
      return true;
  }
  return false;
}

if (typeof window !== "undefined") {
  window.put_down = put_down;
}


const addCommandToProgram = (command) => {
  return;
  if (!window.codeRunning && document.querySelector('#interactive').checked) {
      // only add if we aren't running and if the button is checked
      let oldEditor = window.cmEditor;
      // const newCode = oldEditor.state.doc.toString() + command + '\n';
      const cursorPos = cmEditor.viewState.state.selection.main.head;

      // handle indentation
      const allText = oldEditor.state.doc.toString();
      const priorNewline = allText.lastIndexOf('\n', cursorPos - 1);
      // count spaces
      let numSpaces = 0;
      for (let i = priorNewline; i < cursorPos; i++) {
          if (allText[i] == ' ') {
              numSpaces++;
          }
      }
      const suffix = '\n' + ' '.repeat(numSpaces);
      oldEditor.dispatch({
          changes: {from: cursorPos, to: cursorPos, insert: command + suffix}
      });

      const newCursorPos = cursorPos + (command + suffix).length;
      oldEditor.dispatch({selection: {anchor: newCursorPos, head: newCursorPos}, scrollIntoView: true});
  }
}

if (typeof window !== "undefined") {
  window.eraseCode = (editorRef) => {
      if (editorRef !== undefined) {
          window.eraseCode.editorRef = editorRef;
          const cursorLoc = window.starterCode.indexOf(INSERTION_CODE);
          const starterCode = window.starterCode.replace(INSERTION_CODE, '');
          editorRef.editor.setValue(starterCode);
          editorRef.editor.moveCursorToPosition(getPos(starterCode, cursorLoc));
          editorRef.editor.clearSelection();
      }
  }
}

const getPos = (code, loc) => {
  // returns the row and column at loc for a block of code
  const subText = code.substring(0, loc);
  const lines = subText.split('\n');
  let row = lines.length - 1;
  let column = lines[row].length;
  return { row: row, column: column };
}


const mouseMove = (event) => {
  const canvas = document.getElementById('mainCanvas');
  const rect = canvas.getBoundingClientRect();
  let x;
  let y;
  if (event.touches) {
      x = Math.round((event.touches[0].clientX - rect.left) / (rect.right - rect.left) * canvas.width);
      y = Math.round((event.touches[0].clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);
  } else {
      x = Math.round((event.clientX - rect.left) / (rect.right - rect.left) * canvas.width);
      y = Math.round((event.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);
  }
  if (x > canvas.width + 1) {
      x = 0;
  }
  if (y > canvas.height + 1) {
      y = 0;
  }
  window.lastMouse = {x: x, y: y};
}

const mouseDown = (event) => {
  const canvas = document.getElementById('mainCanvas');
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) / (rect.right - rect.left) * canvas.width);
  if (x > canvas.width + 1) {
      x = 0;
  }
  const y = Math.round((event.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);
  if (y > canvas.height + 1) {
      y = 0;
  }
  window.lastMouseDown = {x: x, y: y};
}

const runExercise = () => {
  const ex = 'worlds/' + document.querySelector('#examples').value + '.json';
  init_main(ex);
}
if (typeof window !== "undefined") {
  window.runExercise = runExercise;
}

const updateCorrectBox = (val) => {
  const correctBox = document.querySelector('#correctBox');
  if (correctBox) {
      correctBox.innerText = val;
  }
}


if (typeof window !== "undefined") {
  window.showDocs = (show) => {
      const docsButton = document.querySelector('#docsButton');
      const docsDiv = document.querySelector('#documentation');
      docsDiv.hidden = !show;
      if (show) {
          docsButton.innerText = "Hide Commands";
          docsButton.setAttribute( "onClick", "javascript: showDocs(false);" );
      } else {
          docsButton.innerText = "Show Commands";
          docsButton.setAttribute( "onClick", "javascript: showDocs(true);" );
      }
  }
}

async function python_runner(script, context, lineMap) {
  try {
      const stepSpeed = 1000;
      const { results, error } = await asyncRun(script, context, stepSpeed);
      if (results) {
          console.log("pyodideWorker return results: ", results);
      } else if (error) {
          console.log("pyodideWorker error: ", error);
          updateCorrectBox('❌');
          // put partial error in the terminal
          if (error.startsWith('Traceback')) {
              const firstNewline = error.indexOf('\n');
              const firstUsefulError = error.lastIndexOf('\n', error.indexOf('___WRAPPER'));
              let usefulMessage = '\n' + error.substring(0, firstNewline + 1)
                  + error.substring(firstUsefulError);
              usefulMessage = updateLineNumbers(usefulMessage, lineMap);
              console.log(usefulMessage);
              terminal.blur();
              terminal.focus();
          }
      }
  } catch (e) {
      console.log(
          `Error in pyodideWorker at ${e.filename}, Line: ${e.lineno}, ${e.message}`
      );
      updateCorrectBox('❌');
  }
}

const platsEqual = (plat1, plat2) => {
  return plat1.row == plat2.row && plat1.col == plat2.col && plat1.direction == plat2.direction;
}

// found here: https://stackoverflow.com/a/32922084/561677
const deepEqual = (x, y) => {
  const ok = Object.keys, tx = typeof x, ty = typeof y;
  return x && y && tx === 'object' && tx === ty ? (
      ok(x).length === ok(y).length &&
      ok(x).every(key => deepEqual(x[key], y[key]))
  ) : (x === y);
}

const updateLineNumbers = (text, lineMap) => {
  let linePos = text.indexOf('line ');
  while (linePos != -1) {
      const commaPos = text.indexOf(',', linePos);
      const oldLineNum = parseInt(text.substring(linePos + 'line '.length, commaPos));
      let newLineNum = '??';
      if (lineMap.has(oldLineNum)) {
          newLineNum = lineMap.get(oldLineNum);
      }
      text = text.substring(0, linePos + 'line '.length) + newLineNum.toString() + text.substr(commaPos);
      linePos = text.indexOf('line ', linePos + 1);
  }
  text = text.replace('___WRAPPER', 'Platypus');
  return text;
}


/////

async function transform_code_for_async(code) {
  window.pyodide.globals.set('the_code', code);
  const transform_code = `import ast

parse_functions = {'input': [], 'time': ["sleep"], 'canvas': ["get_mouse_x", "get_mouse_y", "get_mouse_down", "set_canvas_size", "get_image_width", "get_image_height"],
                 'Canvas': ['create'],
                 'turn_right': [], 'turn_left': [], 'swim': [], 'put_down': [],
                 'pick_up': [], 'front_is_water': [], 'right_is_water': [], 'left_is_water': [],
                 'facing': [], 'count': []}
def make_await(node):
  if hasattr(node.func, 'id') and node.func.id in parse_functions.keys():
      # top-level
      return True
  if hasattr(node.func, 'value') and hasattr(node.func.value, 'id') and node.func.value.id in parse_functions.keys():
      if node.func.attr in parse_functions[node.func.value.id]:
          return True
  return False

class TransformFunc(ast.NodeTransformer):
  global parse_functions
  def visit_FunctionDef(self, node):
      self.generic_visit(node)
      parse_functions[node.name] = []
      return ast.AsyncFunctionDef(node.name, node.args, node.body, node.decorator_list,
                                  node.returns, node.type_comment)

class TransformCall(ast.NodeTransformer):
  global parse_functions_list
  def visit_Call(self, node):
      self.generic_visit(node)
      # import pdb;pdb.set_trace()
      """
      if hasattr(node.func, 'id'):
          print(node.func.id)
      else:
          print(node.func.value.id)
      """
      if make_await(node):
          return ast.Await(node)
      else:
          return node

def transform_to_async(code):
  global transformed_code
  tree = ast.parse(code)
  ast.fix_missing_locations(TransformFunc().visit(tree))
  ast.fix_missing_locations(TransformCall().visit(tree))
  transformed_code = ast.unparse(tree)

transform_to_async(the_code)
`
  try {
      window.pyodide.runPython(transform_code);
  }
  catch(err) {
      const file_txt = 'File "<unknown>", ';
      const line_idx = err.message.indexOf(file_txt) + file_txt.length;
      const error_msg = err.message.substr(line_idx);
      console.error(error_msg);
      return "";
  }
  const transformed_code = window.pyodide.globals.get('transformed_code');
  console.log(transformed_code);
  return transformed_code;
}

if (typeof window !== "undefined") {
  window.reset_platypus = () => {
      // need to make deep copy
      window.world._grids.current = JSON.parse(JSON.stringify(window.world._grids.initial));
      window.world._platypus.current = JSON.parse(JSON.stringify(window.world._platypus.initial));
      window.world.drawWorld();
      const correctBox = document.querySelector('#correctBox');
      if (correctBox) {
          correctBox.innerText = '';
      }
  }
}

if (typeof window !== "undefined") {

  window.run_pyodide = async (originalCode, onEndPromise) => {
    window.onEndPromise = onEndPromise;
      const context = {}; // we might use this to pass parameters to a program,
      // e.g. { name: "Chris", num: 5, arr: [1, 2, 3], }
      // const originalCode = window.cmEditor.state.doc.toString();
      let transformedCode = await transform_code_for_async(originalCode);
      if (transformedCode == "") {
          updateCorrectBox('❌');
          return;
      }
      transformedCode = wrap_code(transformedCode);
      const lineMap = findClosestMatches(transformedCode, originalCode);

      // only run python_runner if we've stopped execution
      const python_runner_fn = () => {
          if (window.codeRunning) {
              // not stopped yet
              setTimeout(python_runner_fn, 100);
          } else {
              window.stopExecution = false;

              python_runner(transformedCode, context, lineMap);
          }
      }
      setTimeout(python_runner_fn, 100);
  }
}

// calculate the "distance" between two strings
// code by ChatGPT:
// https://chat.openai.com/share/60685c00-9ded-4c70-98be-d891b099b40b
const calculateLevenshteinDistance = (str1, str2) => {
  // Create a 2D array to store the distances
  const distances = Array(str1.length + 1)
      .fill(null)
      .map(() => Array(str2.length + 1).fill(null));

  // Initialize the first row and column of the array
  for (let i = 0; i <= str1.length; i++) {
      distances[i][0] = i;
  }
  for (let j = 0; j <= str2.length; j++) {
      distances[0][j] = j;
  }

  // Calculate the Levenshtein distance
  for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          distances[i][j] = Math.min(
              distances[i - 1][j] + 1, // deletion
              distances[i][j - 1] + 1, // insertion
              distances[i - 1][j - 1] + cost // substitution
          );
      }
  }

  // Return the final Levenshtein distance
  const levLen = distances[str1.length][str2.length]
  return levLen;
}

function findClosestMatches(transformedCode, originalCode) {
  const transformedLines = transformedCode.split('\n');
  const originalLines = originalCode.split('\n');
  // transformed will not have comments, and whitespace may be different.
  // we want to match each line in transformed with a line in original,
  // although there won't be as many lines in the original
  const closestMatches = new Map();

  // iterate over the lines in transformedLines
  let nextOrigIndex = 0;
  for (let i = 0; i < transformedLines.length; i++) {
      let transformedLine = transformedLines[i];
      // if the line doesn't start with four spaces, it isn't the original
      if (!transformedLine.startsWith('    ')) {
          continue;
      }
      // let's remove the "async" and "await "
      // and four spaces of whitespace because we added a bunch
      transformedLine = transformedLines[i].replace('await ', '').replace('async ', '').substr(4);
      // check each line in orig, starting with the line we left off at
      for (let j = nextOrigIndex; j < originalLines.length; j++) {
          const originalLine = originalLines[j];
          const dist = calculateLevenshteinDistance(transformedLine, originalLine);
          if (dist == 0) {
              // found a match!
              nextOrigIndex = j + 1;
              closestMatches.set(i + 1, j + 1);
              break;
          }
      }
  }

  return closestMatches;
}

const wrap_code = (code) => {
  // indent everything by 4 spaces
  console.log(code)
  // prepend function def and tracer code
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

code = `import sys

from js import sleep_fixed
from js import check_for_stop
from js import create_canvas


async def ___WRAPPER():
${indentedCode}
await ___WRAPPER()
  `
  console.log(code);
  return code;
}

if (typeof window !== "undefined") {
  window.reset_console = () => {
      if (window.codeRunning) {
          interruptExecution();
      }
      console.log('')
  }

  window.interruptExecution = () => {
      interruptExecution();
      console.log("stopping program");
  }
}


if (typeof window !== "undefined") {
  window.update_terminal = () => {
      const snippets = [`print('Hello, World!')`,

          `first_number = int(input("Please type a number: "))
  second_number = int(input("Please type another number: "))
  result = first_number + second_number
  print(f"The sum of {first_number} + {second_number} = {result}")`,

          `def main():
      size = int(input("Size of triangle (5-21)? "))
      triangle(size)

  def triangle(n):
      for i in range(0, n, 2):
          for j in range((n - i) // 2):
              print(' ', end='')
          for j in range(i + 1):
              print('*', end='')
          print()

  if __name__ == '__main__':
      main()`,
          `import time
  for i in range(10):
      print(i)
      time.sleep(1)`,
          `def main():
      print('in main()')
      nextFunc()

  def nextFunc():
      print("about to divide by zero...")
      a = 1 / 0

  if __name__ == "__main__":
      main()`,
          `import time
  import random

  NUM_BALLS = 50
  RADIUS = 20

  def main():
      canvas = Canvas()
      radius = RADIUS
      x = canvas.width / 2 - radius
      y = canvas.height / 2 - radius

      balls = []
      for i in range(NUM_BALLS):
          color = f"#{random.randrange(0x1000000):06x}"
          dx = random.random() * 20 - 10
          dy = random.random() * 20 - 10
          balls.append({'ball': canvas.create_oval(x, y, x + radius, y + radius,
                                color=color, fill=color), 'x': x, 'y': y, 'dx': dx, 'dy': dy})
      while True:
          for ball in balls:
              canvas.move(ball['ball'], ball['dx'], ball['dy'])
              ball['x'] += ball['dx']
              ball['y'] += ball['dy']
              if ball['x'] > canvas.width - radius or ball['x'] < 0:
                  ball['dx'] *= -1
              if ball['y'] > canvas.height - radius or ball['y'] < 0:
                  ball['dy'] *= -1
          print(f"first ball: x: {round(balls[0]['x'], 2)}, "
                             f"y: {round(balls[0]['y'], 2)}")
          time.sleep(0.01)
          clear_terminal()

  if __name__ == "__main__":
      main()
      `,
          `import time
  def main():
      canvas = Canvas()
      # Move your mouse around the white canvas!
      while True:
          mouseX = canvas.get_mouse_x()
          mouseY = canvas.get_mouse_y()
          canvas.create_oval(mouseX, mouseY, mouseX + 20, mouseY + 20,
                             color="blue", fill="blue")
          time.sleep(0.2)

  if __name__ == "__main__":
      main()`,
          `import time
  import random
  import math

  canvas = Canvas()
  PLAY_DIFFICULTY = 5 # (0-10) lower is easier
                      # decrease PLAY_DIFFICULTY for a slower ball
  PADDLE_WIDTH = 10
  PADDLE_HEIGHT = 40
  PADDLE_MARGIN = 10
  LEFT_PADDLE_X = PADDLE_MARGIN
  RIGHT_PADDLE_X = canvas.width - PADDLE_MARGIN
  PADDLE_COLOR = 'green'
  BALL_RADIUS = 5
  BALL_COLOR = 'blue'
  BALL_VELOCITY = 10

  def main():
      print("Move the mouse up and down")
      print("inside the white box to play!")
      ball, paddles = setup_game()
      play(ball, paddles)

  def setup_game():
      paddles = {}
      leftY = canvas.height / 2
      rightY = canvas.height / 2
      paddles['left'] = canvas.create_rectangle(LEFT_PADDLE_X,
                         leftY - PADDLE_HEIGHT / 2,
                         LEFT_PADDLE_X + PADDLE_WIDTH,
                         leftY - PADDLE_HEIGHT / 2 + PADDLE_HEIGHT,
                         color=PADDLE_COLOR,
                         fill=PADDLE_COLOR)

      paddles['right'] = canvas.create_rectangle(RIGHT_PADDLE_X - PADDLE_WIDTH,
                         rightY - PADDLE_HEIGHT / 2,
                         RIGHT_PADDLE_X,
                         rightY - PADDLE_HEIGHT / 2 + PADDLE_HEIGHT,
                         color=PADDLE_COLOR,
                         fill=PADDLE_COLOR)

      ball = {}
      ball_x1 = canvas.width / 2 - BALL_RADIUS
      ball_y1 = canvas.height / 2 - BALL_RADIUS
      ball_x2 = ball_x1 + 2 * BALL_RADIUS
      ball_y2 = ball_y1 + 2 * BALL_RADIUS

      ball['obj'] = canvas.create_oval(ball_x1, ball_y1, ball_x2, ball_y2,
                      fill=BALL_COLOR, color=BALL_COLOR)

      ball['dx'] = random.randint(5, 9)
      if random.randint(0, 1) % 2 == 0: ball['dx'] *= -1

      ball['dy'] = math.sqrt(BALL_VELOCITY ** 2 - ball['dx'] ** 2)
      if random.randint(0, 1) % 2 == 0: ball['dy'] *= -1

      return ball, paddles


  def draw_paddles(paddles, leftY, rightY):
      canvas.coords(paddles['left'],
                  LEFT_PADDLE_X,
                         leftY - PADDLE_HEIGHT / 2,
                         LEFT_PADDLE_X + PADDLE_WIDTH,
                         leftY - PADDLE_HEIGHT / 2 + PADDLE_HEIGHT)

      canvas.coords(paddles['right'],
                  RIGHT_PADDLE_X - PADDLE_WIDTH,
                         rightY - PADDLE_HEIGHT / 2,
                         RIGHT_PADDLE_X,
                         rightY - PADDLE_HEIGHT / 2 + PADDLE_HEIGHT)

  def move_ball(ball):
      canvas.move(ball['obj'], ball['dx'], ball['dy'])

      # bounce at ceiling and floor
      x1, y1, x2, y2 = canvas.coords(ball['obj'])

      if y1 < 0:
          ball['dy'] = abs(ball['dy'])
      if y2 > canvas.height:
          ball['dy'] = -abs(ball['dy'])

  def bounce_off_paddles(ball, paddles):
      # if any part of the ball is touching the paddle, bounce
      ball_x1, ball_y1, ball_x2, ball_y2 = canvas.coords(ball['obj'])
      lpad_x1, lpad_y1, lpad_x2, lpad_y2 = canvas.coords(paddles['left'])
      rpad_x1, rpad_y1, rpad_x2, rpad_y2 = canvas.coords(paddles['right'])

      # left
      if lpad_x2 >= ball_x1 and ball_y2 >= lpad_y1 and ball_y1 <= lpad_y2:
          bounce_and_fuzz(ball, 1)

      # right
      if rpad_x1 <= ball_x2 and ball_y2 >= rpad_y1 and ball_y1 <= rpad_y2:
          bounce_and_fuzz(ball, -1)

  def bounce_and_fuzz(ball, final_direction):
      if final_direction == -1:
          ball['dx'] = -abs(ball['dx'])
      else:
          ball['dx'] = abs(ball['dx'])
      if ball['dx'] < 0:
          ball['dx'] = max(-9, min(-4, ball['dx'] + random.randint(-3, 3)))
      else:
          ball['dx'] = max(4, min(4, ball['dx'] + random.randint(-3, 3)))
      fix_speed(ball)

  def fix_speed(ball):
      # change dy to match dx
      dy_neg = ball['dy'] < 0
      ball['dy'] = math.sqrt(BALL_VELOCITY ** 2 - ball['dx'] ** 2)
      if dy_neg:
          ball['dy'] *= -1

  def score_and_reset(ball, paddles, score, score_obj):
      # if the ball is outside the bounds of the canvas,
      # someone scored
      x1, y1, x2, y2 = canvas.coords(ball['obj'])
      if x1 < 0:
          # score for right player
          score[1] += 1
          canvas.delete(ball['obj'])
          canvas.delete(paddles['left'])
          canvas.delete(paddles['right'])
          score_str = f"{score[0]} | {score[1]}"
          canvas.itemconfigure(score_obj, score_str)
          ball, paddles = setup_game()
      elif x2 > canvas.width:
          # score for left player
          score[0] += 1
          canvas.delete(ball['obj'])
          canvas.delete(paddles['left'])
          canvas.delete(paddles['right'])
          score_str = f"{score[0]} | {score[1]}"
          canvas.itemconfigure(score_obj, score_str)
          # canvas.erase()
          ball, paddles = setup_game()

      return ball, paddles



  def play(ball, paddles):
      score = [0, 0]
      score_str = f"{score[0]} | {score[1]}"
      score_obj = canvas.create_text(canvas.width / 2 - 20, 20, score_str, fill='black', color='black')
      while True:
          last_mouse_y = canvas.get_mouse_y()
          draw_paddles(paddles, last_mouse_y, canvas.coords(ball['obj'])[1])
          bounce_off_paddles(ball, paddles)
          time.sleep((11 - PLAY_DIFFICULTY) * 0.001)
          move_ball(ball)
          ball, paddles = score_and_reset(ball, paddles, score, score_obj)

  if __name__ == "__main__":
      main()
  `,
          `import random
  import sys
  import time

  NUM_TO_CONNECT = 4
  NUM_COLS = 7
  NUM_ROWS = 6
  COLOR1 = "red"
  COLOR2 = "yellow"

  # graphics
  START_X = 10
  START_Y = 20
  BACKGROUND_COLOR = "white"
  BOARD_COLOR = "blue"
  DROP_RATE = 5

  def print_board(board):
      # top
      for i in range(NUM_COLS):
          print(f' {i}', end='')
      print()
      print('-' * (len(board[0]) * 2 + 1))
      for row in board:
          for piece in row:
              if piece is None:
                  ch = ' '
              else:
                  ch = piece[0].upper()
              print(f"|{ch}", end='')
          print('|')
      # bottom
      print(f"-" * (len(board[0]) * 2 + 1))
      print(f"|{' ' * (len(board[0]) * 2 - 1)}|")

  def drop_piece(board, col, color):
      """
      This is a bit tricky, because we have rows in our board.
      We need to look at the col in each row and stop when
      we get to the bottom of the board
      Special case: top row is not None: cannot put a piece there
      """
      row = 0
      while row < NUM_ROWS and board[row][col] is None:
          row += 1
      if row > 0 and board[row - 1][col] is None:
          board[row - 1][col] = color
          return True
      return False # full column, could not place piece

  def remove_piece(board, col):
      """
      Nice function to have for testing strategies
      """
      # find the first row that has a piece in that column
      for row in board:
          if row[col]:
              # and remove it
              row[col] = None
              return

  def we_have_a_winner(board, num_to_connect):
      """
      determines if there is a winner
      returns a dict with a 'start_row', a 'start_col',
      a 'direction' of 'horizontal', 'vertical', 'diag_up', or 'diag_down'
      and the 'winner', or None if there is no winning NUM_TO_CONNECT-token sequence
      e.g., {'start_row': 0, 'start_col': 1, 'direction': 'diagonal': 'winner': 'red'}
      """
      for row_num in range(len(board)):
          for col_num in range(len(board[0])):
              for fn in [check_for_row_win, check_for_col_win,
                         check_for_diag_down_win, check_for_diag_up_win]:
                  # note: the next line needs "await" because behind-the-scenes
                  # translations make functions in this program async
                  winner = await fn(board, row_num, col_num, num_to_connect)
                  if winner:
                      return winner
      return None

  def check_for_row_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the row, or there isn't a piece,
      # we don't have a winner
      if col_num > len(row) - num_to_connect or color is None:
          return None

      for c in range(num_to_connect - 1): # only need to find three more
          if row[c + col_num + 1] != color:
              return None

      return populate_winner(row_num, col_num, 'horizontal', color)

  def check_for_col_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the col, or there isn't a piece,
      # we don't have a winner
      if row_num > len(board) - num_to_connect or color is None:
          return None

      for r in range(num_to_connect - 1): # only need to find three more
          row = board[r + row_num + 1]
          if row[col_num] != color:
              return None

      return populate_winner(row_num, col_num, 'vertical', color)

  def check_for_diag_down_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the row or col, or there isn't a piece,
      # we don't have a winner
      if (row_num > len(board) - num_to_connect or
            col_num > len(row) - num_to_connect or
            color is None):
          return None

      for r in range(num_to_connect - 1): # only need to find three more
          row = board[r + row_num + 1]
          if row[col_num + r + 1] != color:
              return None

      return populate_winner(row_num, col_num, 'diag_down', color)

  def check_for_diag_up_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the row or col, or there isn't a piece,
      # we don't have a winner
      if (row_num < num_to_connect - 1 or
            col_num > len(row) - num_to_connect or
            color is None):
          return None

      for r in range(num_to_connect - 1): # only need to find three more
          row = board[row_num - r - 1]
          if row[col_num + r + 1] != color:
              return None

      return populate_winner(row_num, col_num, 'diag_up', color)

  def find_open_spots(board, no_drop_columns, color):
      """
      Here, we see if there are any rows that have a space between two opposing player
      tokens
      """
      # start from the top row
      for row in range(len(board)):
          # no need to check last two columns
          for col in range(len(board[0]) - 2):
              if col + 1 not in no_drop_columns and board[row][col] == color:
                  # check the row below, and one column over
                  # if there is a token, this is a possible play
                  if (row == len(board) - 1 or board[row + 1][col + 1] is not None):
                      # check the second column for a blank
                      if board[row][col + 1] is None:
                          # check the third column over
                          if board[row][col + 2] == color:
                              # we found one!
                              return col + 1
      return None

  def populate_winner(row_num, col_num, direction, winner):
      return {
              'start_row': row_num,
              'start_col': col_num,
              'direction': direction,
              'winner': winner,
              }

  def play_turn(board, color):
      print_board(board)
      print(f"It is the {color} player's turn.")
      while True:
          try:
              col = int(input("Please choose a column: "))
              if 0 <= col < len(board[0]) and drop_piece(board, col, color):
                   return col
          except ValueError:
              pass

  def copy_board(board):
      """
      make a deep copy of the board
      """
      new_board = []
      for row in range(len(board)):
          new_row = []
          for col in range(len(board[0])):
              new_row.append(board[row][col])
          new_board.append(new_row)
      return new_board

  def ai_turn(board, color, other_color):
      # go in a winning space if we can
      col = col_to_win(board, color)
      if col is not None:
          drop_piece(board, col, color)
          return col

      # we must block our opponent from a win
      col = col_to_win(board, other_color)
      if col is not None:
          drop_piece(board, col, color)
          return col

      # find columns that would lead
      # to an immediate win if we dropped there
      no_drop_columns = []
      for our_col in range(len(board[0])):
          # drop a piece into a column
          full_c1 = not drop_piece(board, our_col, color)
          if not full_c1:
              # now drop the opponent's piece into each column
              # in turn and see if it produces a win
              for opponent_col in range(len(board[0])):
                  full_c2 = not drop_piece(board, opponent_col, other_color)
                  if not full_c2:
                      winner = we_have_a_winner(board, NUM_TO_CONNECT)
                      # remove other player's test piece
                      remove_piece(board, opponent_col)
                      if winner:
                          no_drop_columns.append(our_col)
                          break
              remove_piece(board, our_col)
          else:
              no_drop_columns.append(our_col)

      # if there are any open spots between two opposing player tokens, go there
      col = find_open_spots(board, no_drop_columns, other_color)
      if col is not None:
          drop_piece(board, col, color)
          return col

      # if there are two in a row (for 4-win) with space on both sides,
      # block to avoid easy three-in-a-row situation
      # we only have to check one side
      # this function still needs work
      for row_num in range(len(board)):
          for col_num in range(len(board[0])):
              row_check = check_for_row_win(board, row_num, col_num,
                                            NUM_TO_CONNECT - 2)
              if row_check:
                  if (row_check['start_col'] != 0 and
                      board[row_check['start_row']]
                      [row_check['start_col'] - 1] is None):
                      col = row_check['start_col'] - 1
                      if col not in no_drop_columns:
                          drop_piece(board, col, color)
                          return col

      # we can't find a good spot, so we'll just start from
      # the center and place one where we can, but not
      # in a no_drop column
      # Why the center? So if we're the starting player,
      # we go in the center!
      # Special case: no good columns (we lose) :(
      if len(no_drop_columns) == len(board[0]):
          # just remove them
          no_drop_columns = []
          print("The AI will lose!")
      col = len(board[0]) // 2
      while True:
          if col not in no_drop_columns and drop_piece(board, col, color):
              return col
          col = (col + 1) % len(board[0])

  def col_to_win(board, color):
      for col in range(len(board[0])):
          test_board = copy_board(board)
          drop_piece(test_board, col, color)
          possible_winner = we_have_a_winner(test_board, NUM_TO_CONNECT)
          if possible_winner:
              return col
      return None

  def print_report(player1_turns, player2_turns, turn_number):
      print(f"Player 1 made the following turns: {player1_turns}")
      print(f"Player 2 made the following turns: {player2_turns}")
      print(f"The game took {turn_number} turns")


  # Graphics routines
  def get_circle_coords(canvas, row, col):
      inset_perc = 0.8
      width = canvas.width - 2 * START_X
      height = canvas.height - 2 * START_Y
      block_height = height / NUM_ROWS
      block_width = width / NUM_COLS
      y_offset = (block_height - block_height * inset_perc) / 2
      x_offset = (block_width - block_height * inset_perc) / 2
      radius = block_height * inset_perc
      return (START_X + x_offset + block_width * col,
              START_Y + y_offset + block_height * row,
              radius)

  def draw_board(canvas, board):
      canvas.create_rectangle(0, 0, canvas.width, canvas.height,
                         color=BACKGROUND_COLOR, fill=BACKGROUND_COLOR)
      width = canvas.width - 2 * START_X
      height = canvas.height - 2 * START_Y
      canvas.create_rectangle(START_X, START_Y,
                         START_X + width, START_Y + height,
                         color=BOARD_COLOR, fill=BOARD_COLOR)
      block_height = height / NUM_ROWS
      block_width = width / NUM_COLS
      for row in range(NUM_ROWS + 1):
          canvas.create_line(START_X, START_Y + block_height * row,
                           START_X + width, START_Y + block_height * row,
                           color="black")
      for col in range(NUM_COLS + 1):
          canvas.create_line(START_X + block_width * col, START_Y,
                           START_X + block_width * col, START_Y + height,
                           color="black")
      for row in range(NUM_ROWS):
          for col in range(NUM_COLS):
              x, y, radius = get_circle_coords(canvas, row, col)
              if board[row][col] is None:
                  circle_color = "white"
              else:
                  circle_color = board[row][col]
              canvas.create_oval(x, y, x + radius, y + radius,
                                 color=circle_color, fill=circle_color)

  def draw_drop(canvas, board, col, color):
      # remove the last piece from the board
      remove_piece(board, col)
      row = 0
      while row < NUM_ROWS and board[row][col] is None:
          row += 1
      if row > 0 and board[row - 1][col] is None:
          x, last_y, radius = get_circle_coords(canvas, row - 1, col)
          start_y = last_y % DROP_RATE
          token = canvas.create_oval(x, start_y, x + radius, start_y + radius,
                             color=color, fill=color)
          while start_y < last_y:
              canvas.move(token, 0, DROP_RATE)
              time.sleep(0.001)
              start_y += DROP_RATE
          drop_piece(board, col, color)
          return True
      drop_piece(board, col, color)
      return False

  def click_in_col(canvas):
      x = canvas.get_mouse_down()[0]
      if x != -1:
          width = canvas.width - 2 * START_X
          height = canvas.height - 2 * START_Y
          block_height = height / NUM_ROWS
          block_width = width / NUM_COLS

          for col in range(NUM_COLS):
              left_x = START_X + block_width * col
              right_x = START_X + block_width * (col + 1)
              if left_x <= x < right_x:
                  return col
      return -1

  # end of graphics routines

  def main():
      player_turns = []
      # the following are wins for the player:
      # player_turns = [3, 2, 5, 3, 4, 1, 1, 6, 0, 0, 4, 2, 2]
      # player_turns = [3, 2, 1, 2, 1, 2, 3, 4, 4, 5, 5, 1, 1, 2, 2, 6, 4]
      # player_turns = [1, 2, 4, 3, 2, 1, 4, 5, 1, 1, 1, 5, 5, 4, 2]
      # player_turns = [3, 2, 2, 3, 1, 1, 5, 6, 5, 2, 2, 5, 6, 6, 6, 1, 2, 4]

      # the following player moves produces a tie:
      # player_turns = [3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0, 4, 4, 5, 5, 5, 5, 6, 6]
      canvas = Canvas()
      # seed = random.randrange(sys.maxsize)
      # seed = 5205063475235326885
      # random.seed(seed)
      # print(f"Seed: {seed}")
      board = []
      # Even though it is harder to drop a piece through a column
      # we'll stick with the traditional board with rows
      for row in range(NUM_ROWS):
          new_row = []
          for col in range(NUM_COLS):
              new_row.append(None)
          board.append(new_row)

      turn_number = 1
      player1_turns = []
      player2_turns = []
      draw_board(canvas, board)
      while turn_number < NUM_COLS * NUM_ROWS + 1:
          print(f"Turn {turn_number}. ", end='')
          if turn_number % 2 == 1:
              color = COLOR1
              if len(player_turns) > 0:
                  col = player_turns.pop(0)
                  drop_piece(board, col, color)
              else:
                  # col = play_turn(board, color)
                  print_board(board)
                  print("Click in a column to play...")
                  while True:
                      col = click_in_col(canvas)
                      if col != -1:
                          drop_piece(board, col, color)
                          print(f"You played in column {col}.")
                          break
                      time.sleep(0.001)
              draw_drop(canvas, board, col, color)
              player1_turns.append(col)
              print_board(board)
          else:
              print(f"It is the AI's turn.")
              color = COLOR2
              print("before")
              col = ai_turn(board, color, COLOR1)
              print("after")
              draw_drop(canvas, board, col, color)
              player2_turns.append(col)
              print(f"AI played in column {col}.")
          turn_number += 1
          winner = we_have_a_winner(board, NUM_TO_CONNECT)
          if winner:
              print("Winner!")
              print(winner)
              print_report(player1_turns, player2_turns, turn_number)
              player_won = turn_number % 2 == 0
              if player_won:
                  canvas.create_text(10, 15, "Game over! You beat the AI!",
                                     fill='black')
              else:
                  canvas.create_text(10, 15, "Game over! You got beaten by an AI!", fill='black')

              print_board(board)
              break

          if None not in board[0]:
              print("The board is full and you tied!")
              print_report(player1_turns, player2_turns, turn_number)
              canvas.create_text(10, 15, "Game over! You tied the AI!",
                                 fill='black')
              print_board(board)
              break

  if __name__ == "__main__":
      main()
  `,
          `import random
  import sys

  def count_matching_dice(d1, d2, d3, d4, d5, num):
      """
      counts the total number of dice that num
      returns the total
      """
      total = 0
      if d1 == num:
          total += 1
      if d2 == num:
          total += 1
      if d3 == num:
          total += 1
      if d4 == num:
          total += 1
      if d5 == num:
          total += 1
      return total

  def score_matching_dice(d1, d2, d3, d4, d5, num):
      """
      The score is determined by the count of that num times num
      Returns the score for dice matching num.
      """
      return count_matching_dice(d1, d2, d3, d4, d5, num) * num

  def score_three_or_four_of_a_kind_or_yahtzee(d1, d2, d3, d4, d5, kind_type):
      """
      dice_num will be either 3, 4, or 5.
      Returns the score for a three-of-a-kind (3)
      or a four-of-a-kind (4), or yahtzee (5)
      where at least three dice are the same number for a three-of-a-kind,
      and at least four dice are the same number for four-of-a-kind,
      and all five dice are the same number for yahtzee.
      The score is the sum of all the dice for
      three-of-a-kind and four-of-a-kind
      and the score is 50 for yahtzee.
      If there isn't a match, returns 0
      """
      total = d1 + d2 + d3 + d4 + d5
      dice_num = 1
      while (dice_num <= 6):
          count = count_matching_dice(d1, d2, d3, d4, d5, dice_num)
          if count >= kind_type:
              if kind_type == 5:
                  return 50
              else:
                  return total
          dice_num += 1
      return 0

  def score_full_house(d1, d2, d3, d4, d5):
      # a full house has exactly 3 of one number dice
      # and two of another
      # A full house scores 25 points
      count1s = count_matching_dice(d1, d2, d3, d4, d5, 1)
      count2s = count_matching_dice(d1, d2, d3, d4, d5, 2)
      count3s = count_matching_dice(d1, d2, d3, d4, d5, 3)
      count4s = count_matching_dice(d1, d2, d3, d4, d5, 4)
      count5s = count_matching_dice(d1, d2, d3, d4, d5, 5)
      count6s = count_matching_dice(d1, d2, d3, d4, d5, 6)

      if count1s == 3:
          if count2s == 2 or count3s == 2 or count4s == 2 or count5s == 2 or count6s == 2:
              return 25
      if count2s == 3:
          if count1s == 2 or count3s == 2 or count4s == 2 or count5s == 2 or count6s == 2:
              return 25
      if count3s == 3:
          if count1s == 2 or count2s == 2 or count4s == 2 or count5s == 2 or count6s == 2:
              return 25
      if count4s == 3:
          if count1s == 2 or count2s == 2 or count3s == 2 or count5s == 2 or count6s == 2:
              return 25
      if count5s == 3:
          if count1s == 2 or count2s == 2 or count3s == 2 or count4s == 2 or count6s == 2:
              return 25
      if count6s == 3:
          if count1s == 2 or count2s == 2 or count3s == 2 or count4s == 2 or count5s == 2:
              return 25
      return 0


  def score_straight(d1, d2, d3, d4, d5, straight_type):
      """
      Scores a small or large straight.
      A small straight must be four
      in a row (1-2-3-4, 2-3-4-5, or 3-4-5-6) and scores 30.
      A large straight is five in a row (1-2-3-4-5, or 2-3-4-5-6)
      and scores 40.
      If there isn't a straight of straight_type, returns 0
      """
      count1s = count_matching_dice(d1, d2, d3, d4, d5, 1)
      count2s = count_matching_dice(d1, d2, d3, d4, d5, 2)
      count3s = count_matching_dice(d1, d2, d3, d4, d5, 3)
      count4s = count_matching_dice(d1, d2, d3, d4, d5, 4)
      count5s = count_matching_dice(d1, d2, d3, d4, d5, 5)
      count6s = count_matching_dice(d1, d2, d3, d4, d5, 6)

      if straight_type == 4:
          # count small straights
          if count1s >= 1 and count2s >= 1 and count3s >= 1 and count4s >= 1:
              return 30
          if count2s >= 1 and count3s >= 1 and count4s >= 1 and count5s >= 1:
              return 30
          if count3s >= 1 and count4s >= 1 and count5s >= 1 and count6s >= 1:
              return 30
          # none found
          return 0

      if straight_type == 5:
          # count large straights
          if count1s >= 1 and count2s >= 1 and count3s >= 1 and count4s >= 1 and count5s >= 1:
              return 40
          if count2s >= 1 and count3s >= 1 and count4s >= 1 and count5s >= 1 and count6s >= 1:
              return 40
          return 0

  def roll_die():
      """
      returns the result of a single die roll (1-6)
      """
      return random.randint(1, 6)

  # tests
  def test_matches(d1, d2, d3, d4, d5):
      """
      test the score for matching dice: 1s, 2s, ..., 6s
      """
      total = d1 + d2 + d3 + d4 + d5
      sums_total = 0
      num = 1
      while num <= 6:
          score = score_matching_dice(d1, d2, d3, d4, d5, num)
          print(f"{num}s sum: {score} ")
          sums_total += score
          num += 1
      # if sums_total == total:
      #     print("Total sums match.")
      # else:
      #     print("Total sums do not match!")

  def test_X_of_a_kinds(d1, d2, d3, d4, d5):
      kind_type = 3
      while kind_type <= 5:
          score = score_three_or_four_of_a_kind_or_yahtzee(d1, d2, d3, d4, d5, kind_type)
          if score > 0:
              if kind_type == 5:
                  print(f"Yahtzee! Score: {score}")
              else:
                  print(f"{kind_type}-of-a-kind! Score: {score}")
          else:
              if kind_type == 5:
                  print(f"Not a yahtzee")
              else:
                  print(f"Not a {kind_type}-of-a-kind")
          kind_type += 1

  def test_full_house(d1, d2, d3, d4, d5):
      score = score_full_house(d1, d2, d3, d4, d5)
      if score > 0:
          print(f"Full house! Score: {score}")
      else:
          print(f"Not a full house")

  def test_straights(d1, d2, d3, d4, d5):
      small_straight_score = score_straight(d1, d2, d3, d4, d5, 4)
      if small_straight_score > 0:
          print(f"Small straight! Score: {small_straight_score}")
      else:
          print(f"Not a small straight")

      large_straight_score = score_straight(d1, d2, d3, d4, d5, 5)
      if large_straight_score > 0:
          print(f"Large straight! Score: {large_straight_score}")
      else:
          print(f"Not a large straight")

  def run_tests():
      # to test for yahtzee fast:
      # bash: while [ 1 ]; do python3 yahtzee.py | egrep "seed|5-"; done
      # full house seed: 3124296115595568993
      # three-of-a-kind seed: 7015785909153204237
      # four-of-a-kind seeds: 3906350539248440928, 4228015625983181528
      # yahtzee seed: 8610573526024559617
      # small straight seed: 7545246043489357022
      # large straight seed: 7966523343836331803
      seed = random.randrange(sys.maxsize)
      random.seed(seed)
      print(f"seed (for debugging): {seed}")
      d1 = roll_die()
      d2 = roll_die()
      d3 = roll_die()
      d4 = roll_die()
      d5 = roll_die()
      print(f"Random Roll: {d1} {d2} {d3} {d4} {d5}")
      test_matches(d1, d2, d3, d4, d5)
      test_X_of_a_kinds(d1, d2, d3, d4, d5)
      test_full_house(d1, d2, d3, d4, d5)
      test_straights(d1, d2, d3, d4, d5)

      print()
      print(f"Testing known dice rolls:")
      known_inputs = [[1, 5, 2, 4, 4], # matches
                      [4, 3, 4, 3, 3], # full house
                      [1, 3, 4, 3, 3], # 3-of-a-kind
                      [6, 6, 1, 6, 6], # 4-of-a-kind
                      [2, 2, 2, 2, 2], # yahtzee!
                      [2, 1, 3, 5, 4], # large straight
                      [2, 1, 3, 3, 4], # small straight
                      ]
      for test_input in known_inputs:
          print(f"Testing {test_input}:")
          test_matches(*test_input)
          test_full_house(*test_input)
          test_X_of_a_kinds(*test_input)
          test_straights(*test_input)
          print(f"***********************")

  def print_roll(roll):
      print(f"You rolled:")
      print(f"A B C D E")
      for d in roll:
          print(f"{d} ", end='')
      print()

  def roll_dice(num_to_roll):
      dice = []
      for i in range(num_to_roll):
          dice.append(roll_die())
      return dice

  def play_game():
      print(f"Welcome to Yahtzee!")
      while True:
          input(f"Press the <return> key for your first roll...")
          roll = roll_dice(5)
          print_roll(roll)
          print()

          keepers = input("What dice would you like to keep for your second roll? (e.g., A C D): ").upper()
          second_roll = roll_dice(5)
          for idx, letter in enumerate("ABCDE"):
              if letter in keepers:
                  second_roll.pop()
                  second_roll = [roll[idx]] + second_roll # push onto beginning
          print_roll(second_roll)
          print()

          keepers = input("What dice would you like to keep for your third roll? (e.g., A C D): ").upper()
          third_roll = roll_dice(5)
          for idx, letter in enumerate("ABCDE"):
              if letter in keepers:
                  third_roll.pop()
                  third_roll = [second_roll[idx]] + third_roll # push onto beginning
          print_roll(third_roll)
          print()

          test_matches(*third_roll)
          test_full_house(*third_roll)
          test_X_of_a_kinds(*third_roll)
          test_straights(*third_roll)

          print()
          play_again = input("Would you like to play again? (Y/n): ").lower()
          if play_again != "" and play_again[0] == 'n':
              print("Thank you for playing Yahtzee!")
              break
          print()


  def main():
      # run_tests()
      play_game()

  if __name__ == "__main__":
      main()
  `,
          `import random
  import sys
  import time

  NUM_TO_CONNECT = 4
  NUM_COLS = 7
  NUM_ROWS = 6
  COLOR1 = "red"
  COLOR2 = "yellow"

  # graphics
  START_X = 10
  START_Y = 20
  BACKGROUND_COLOR = "white"
  BOARD_COLOR = "blue"
  DROP_RATE = 5

  def print_board(board):
      # top
      for i in range(NUM_COLS):
          print(f' {i}', end='')
      print()
      print('-' * (len(board[0]) * 2 + 1))
      for row in board:
          for piece in row:
              if piece is None:
                  ch = ' '
              else:
                  ch = piece[0].upper()
              print(f"|{ch}", end='')
          print('|')
      # bottom
      print(f"-" * (len(board[0]) * 2 + 1))
      print(f"|{' ' * (len(board[0]) * 2 - 1)}|")

  def drop_piece(board, col, color):
      """
      This is a bit tricky, because we have rows in our board.
      We need to look at the col in each row and stop when
      we get to the bottom of the board
      Special case: top row is not None: cannot put a piece there
      """
      row = 0
      while row < NUM_ROWS and board[row][col] is None:
          row += 1
      if row > 0 and board[row - 1][col] is None:
          board[row - 1][col] = color
          return True
      return False # full column, could not place piece

  def remove_piece(board, col):
      """
      Nice function to have for testing strategies
      """
      # find the first row that has a piece in that column
      for row in board:
          if row[col]:
              # and remove it
              row[col] = None
              return

  def we_have_a_winner(board, num_to_connect):
      """
      determines if there is a winner
      returns a dict with a 'start_row', a 'start_col',
      a 'direction' of 'horizontal', 'vertical', 'diag_up', or 'diag_down'
      and the 'winner', or None if there is no winning NUM_TO_CONNECT-token sequence
      e.g., {'start_row': 0, 'start_col': 1, 'direction': 'diagonal': 'winner': 'red'}
      """
      for row_num in range(len(board)):
          for col_num in range(len(board[0])):
              for fn in [check_for_row_win, check_for_col_win,
                         check_for_diag_down_win, check_for_diag_up_win]:
                  winner = await fn(board, row_num, col_num, num_to_connect)
                  if winner:
                      return winner
      return None

  def check_for_row_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the row, or there isn't a piece,
      # we don't have a winner
      if col_num > len(row) - num_to_connect or color is None:
          return None

      for c in range(num_to_connect - 1): # only need to find three more
          if row[c + col_num + 1] != color:
              return None

      return populate_winner(row_num, col_num, 'horizontal', color)

  def check_for_col_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the col, or there isn't a piece,
      # we don't have a winner
      if row_num > len(board) - num_to_connect or color is None:
          return None

      for r in range(num_to_connect - 1): # only need to find three more
          row = board[r + row_num + 1]
          if row[col_num] != color:
              return None

      return populate_winner(row_num, col_num, 'vertical', color)

  def check_for_diag_down_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the row or col, or there isn't a piece,
      # we don't have a winner
      if (row_num > len(board) - num_to_connect or
            col_num > len(row) - num_to_connect or
            color is None):
          return None

      for r in range(num_to_connect - 1): # only need to find three more
          row = board[r + row_num + 1]
          if row[col_num + r + 1] != color:
              return None

      return populate_winner(row_num, col_num, 'diag_down', color)

  def check_for_diag_up_win(board, row_num, col_num, num_to_connect):
      row = board[row_num]
      color = row[col_num]
      # if there aren't four more in the row or col, or there isn't a piece,
      # we don't have a winner
      if (row_num < num_to_connect - 1 or
            col_num > len(row) - num_to_connect or
            color is None):
          return None

      for r in range(num_to_connect - 1): # only need to find three more
          row = board[row_num - r - 1]
          if row[col_num + r + 1] != color:
              return None

      return populate_winner(row_num, col_num, 'diag_up', color)

  def find_open_spots(board, no_drop_columns, color):
      """
      Here, we see if there are any rows that have a space between two opposing player
      tokens
      """
      # start from the top row
      for row in range(len(board)):
          # no need to check last two columns
          for col in range(len(board[0]) - 2):
              if col + 1 not in no_drop_columns and board[row][col] == color:
                  # check the row below, and one column over
                  # if there is a token, this is a possible play
                  if (row == len(board) - 1 or board[row + 1][col + 1] is not None):
                      # check the second column for a blank
                      if board[row][col + 1] is None:
                          # check the third column over
                          if board[row][col + 2] == color:
                              # we found one!
                              return col + 1
      return None

  def populate_winner(row_num, col_num, direction, winner):
      return {
              'start_row': row_num,
              'start_col': col_num,
              'direction': direction,
              'winner': winner,
              }

  def play_turn(board, color):
      print_board(board)
      print(f"It is the {color} player's turn.")
      while True:
          try:
              col = int(input("Please choose a column: "))
              if 0 <= col < len(board[0]) and drop_piece(board, col, color):
                   return col
          except ValueError:
              pass

  def copy_board(board):
      """
      make a deep copy of the board
      """
      new_board = []
      for row in range(len(board)):
          new_row = []
          for col in range(len(board[0])):
              new_row.append(board[row][col])
          new_board.append(new_row)
      return new_board

  def ai_turn(board, color, other_color):
      # go in a winning space if we can
      print("checking col_to_win")
      col = col_to_win(board, color)
      if col is not None:
          drop_piece(board, col, color)
          return col

      # we must block our opponent from a win
      col = col_to_win(board, other_color)
      if col is not None:
          drop_piece(board, col, color)
          return col

      # find columns that would lead
      # to an immediate win if we dropped there
      no_drop_columns = []
      for our_col in range(len(board[0])):
          # drop a piece into a column
          full_c1 = not drop_piece(board, our_col, color)
          if not full_c1:
              # now drop the opponent's piece into each column
              # in turn and see if it produces a win
              for opponent_col in range(len(board[0])):
                  full_c2 = not drop_piece(board, opponent_col, other_color)
                  if not full_c2:
                      winner = we_have_a_winner(board, NUM_TO_CONNECT)
                      # remove other player's test piece
                      remove_piece(board, opponent_col)
                      if winner:
                          no_drop_columns.append(our_col)
                          break
              remove_piece(board, our_col)
          else:
              no_drop_columns.append(our_col)

      # if there are any open spots between two opposing player tokens, go there
      col = find_open_spots(board, no_drop_columns, other_color)
      if col is not None:
          drop_piece(board, col, color)
          return col

      # if there are two in a row (for 4-win) with space on both sides,
      # block to avoid easy three-in-a-row situation
      # we only have to check one side
      # this function still needs work
      for row_num in range(len(board)):
          for col_num in range(len(board[0])):
              row_check = check_for_row_win(board, row_num, col_num,
                                            NUM_TO_CONNECT - 2)
              if row_check:
                  if (row_check['start_col'] != 0 and
                      board[row_check['start_row']]
                      [row_check['start_col'] - 1] is None):
                      col = row_check['start_col'] - 1
                      if col not in no_drop_columns:
                          drop_piece(board, col, color)
                          return col

      # we can't find a good spot, so we'll just start from
      # the center and place one where we can, but not
      # in a no_drop column
      # Why the center? So if we're the starting player,
      # we go in the center!
      # Special case: no good columns (we lose) :(
      if len(no_drop_columns) == len(board[0]):
          # just remove them
          no_drop_columns = []
          print("The AI will lose!")
      # col = len(board[0]) // 2
      col = random.randint(0, 6)
      while True:
          if col not in no_drop_columns and drop_piece(board, col, color):
              return col
          # col = (col + 1) % len(board[0])
          col = random.randint(0, 6)

  def col_to_win(board, color):
      print("in col_to_win")
      for col in range(len(board[0])):
          print("still in col_to_win")
          test_board = copy_board(board)
          drop_piece(test_board, col, color)
          possible_winner = we_have_a_winner(test_board, NUM_TO_CONNECT)
          if possible_winner:
              return col
      return None

  def print_report(color1, color2, player1_turns, player2_turns, turn_number):
      print(f"{color1} made the following turns: {player1_turns}")
      print(f"{color2} made the following turns: {player2_turns}")
      print(f"The game took {turn_number} turns")


  # Graphics routines
  def get_circle_coords(canvas, row, col):
      inset_perc = 0.8
      width = canvas.width - 2 * START_X
      height = canvas.height - 2 * START_Y
      block_height = height / NUM_ROWS
      block_width = width / NUM_COLS
      y_offset = (block_height - block_height * inset_perc) / 2
      x_offset = (block_width - block_height * inset_perc) / 2
      radius = block_height * inset_perc
      return (START_X + x_offset + block_width * col,
              START_Y + y_offset + block_height * row,
              radius)

  def draw_board(canvas, board):
      canvas.create_rectangle(0, 0, canvas.width, canvas.height,
                         color=BACKGROUND_COLOR, fill=BACKGROUND_COLOR)
      width = canvas.width - 2 * START_X
      height = canvas.height - 2 * START_Y
      canvas.create_rectangle(START_X, START_Y,
                         START_X + width, START_Y + height,
                         color=BOARD_COLOR, fill=BOARD_COLOR)
      block_height = height / NUM_ROWS
      block_width = width / NUM_COLS
      for row in range(NUM_ROWS + 1):
          canvas.create_line(START_X, START_Y + block_height * row,
                           START_X + width, START_Y + block_height * row,
                           color="black")
      for col in range(NUM_COLS + 1):
          canvas.create_line(START_X + block_width * col, START_Y,
                           START_X + block_width * col, START_Y + height,
                           color="black")
      for row in range(NUM_ROWS):
          for col in range(NUM_COLS):
              x, y, radius = get_circle_coords(canvas, row, col)
              if board[row][col] is None:
                  circle_color = "white"
              else:
                  circle_color = board[row][col]
              canvas.create_oval(x, y, x + radius, y + radius,
                                 color=circle_color, fill=circle_color)

  def draw_drop(canvas, board, col, color):
      # remove the last piece from the board
      remove_piece(board, col)
      row = 0
      while row < NUM_ROWS and board[row][col] is None:
          row += 1
      if row > 0 and board[row - 1][col] is None:
          x, last_y, radius = get_circle_coords(canvas, row - 1, col)
          start_y = last_y % DROP_RATE
          token = canvas.create_oval(x, start_y, x + radius, start_y + radius,
                             color=color, fill=color)
          while start_y < last_y:
              canvas.move(token, 0, DROP_RATE)
              time.sleep(0.01)
              start_y += DROP_RATE
          drop_piece(board, col, color)
          return True
      drop_piece(board, col, color)
      return False

  def click_in_col(canvas):
      x = canvas.get_mouse_down()[0]
      if x != -1:
          width = canvas.width - 2 * START_X
          height = canvas.height - 2 * START_Y
          block_height = height / NUM_ROWS
          block_width = width / NUM_COLS

          for col in range(NUM_COLS):
              left_x = START_X + block_width * col
              right_x = START_X + block_width * (col + 1)
              if left_x <= x < right_x:
                  return col
      return -1

  # end of graphics routines

  def main():
      player_turns = []
      # the following are wins for the player:
      # player_turns = [3, 2, 5, 3, 4, 1, 1, 6, 0, 0, 4, 2, 2]
      # player_turns = [3, 2, 1, 2, 1, 2, 3, 4, 4, 5, 5, 1, 1, 2, 2, 6, 4]
      # player_turns = [1, 2, 4, 3, 2, 1, 4, 5, 1, 1, 1, 5, 5, 4, 2]
      # player_turns = [3, 2, 2, 3, 1, 1, 5, 6, 5, 2, 2, 5, 6, 6, 6, 1, 2, 4]

      # the following player moves produces a tie:
      # player_turns = [3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0, 4, 4, 5, 5, 5, 5, 6, 6]
      canvas = Canvas()
      # seed = random.randrange(sys.maxsize)
      # seed = 5205063475235326885
      # random.seed(seed)
      # print(f"Seed: {seed}")
      board = []
      # Even though it is harder to drop a piece through a column
      # we'll stick with the traditional board with rows
      for row in range(NUM_ROWS):
          new_row = []
          for col in range(NUM_COLS):
              new_row.append(None)
          board.append(new_row)

      turn_number = 0
      player1_turns = []
      player2_turns = []
      draw_board(canvas, board)
      print(f"{COLOR1} goes first.")
      while turn_number < NUM_COLS * NUM_ROWS + 1:
          turn_number += 1
          print_board(board)
          print(f"Turn {turn_number}. ", end='')
          if turn_number % 2 == 1:
              color = COLOR1
              print(f"It is {color}'s turn.")
              if len(player_turns) > 0:
                  col = player_turns.pop(0)
                  drop_piece(board, col, color)
              col = ai_turn(board, color, COLOR2)
              draw_drop(canvas, board, col, color)
              player1_turns.append(col)
              print(f"{color} played in column {col}.")
          else:
              color = COLOR2
              print(f"It is {color}'s turn.")
              col = ai_turn(board, color, COLOR1)
              draw_drop(canvas, board, col, color)
              player2_turns.append(col)
              print(f"{color} played in column {col}.")
          winner = we_have_a_winner(board, NUM_TO_CONNECT)
          if winner:
              print("Winner!")
              print(winner)
              print_report(COLOR1, COLOR2, player1_turns, player2_turns, turn_number)
              canvas.create_text(10, 15, f'Game over! {winner["winner"].capitalize()} won!', fill='black')

              print_board(board)
              break

          if None not in board[0]:
              print("The board is full and the players tied!")
              print_report(COLOR1, COLOR2, player1_turns, player2_turns, turn_number)
              canvas.create_text(10, 15, "Game over! The players tied!",
                                 fill='black')
              print_board(board)
              break

  if __name__ == "__main__":
      main()
  `,
      ]
      const value = document.getElementById('examples').value;
      const currentValue = window.cmEditor.state.doc.toString();
      const endPosition = currentValue.length;
      window.cmEditor.dispatch({
          changes: {
              from: 0,
              to: endPosition,
              insert: snippets[value]
          }
      });
      const examplesSel = document.getElementById('examples');
      const search = examplesSel.options[examplesSel.selectedIndex].value;
      const fullURL = window.location.origin + window.location.pathname + '?example=' + search;
      window.history.pushState({},"", fullURL);
  }
}


