
const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const angleButton = document.getElementById("angleMode");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");

let expression = "";
let answer = 0;
let memory = 0;
let isRadians = false;
let justCalculated = false;
let history = [];

function updateExpression() {
  expressionDisplay.textContent = expression || "Ready to calculate";
}

function formatNumber(number) {
  if (!Number.isFinite(number)) {
    throw new Error("Result is outside the supported range");
  }

  if (Object.is(number, -0)) number = 0;

  if (Math.abs(number) >= 1e12 ||
      (Math.abs(number) < 1e-8 && number !== 0)) {
    return number.toExponential(8);
  }

  return Number(number.toPrecision(12)).toString();
}

function append(value) {
  if (justCalculated) {
    const continuesCalculation = [
      "+", "-", "*", "/", "^", "%", "!", ")"
    ].includes(value);

    if (!continuesCalculation) {
      expression = "";
    }

    justCalculated = false;
  }

  expression += value;
  updateExpression();
}

function clearAll() {
  expression = "";
  justCalculated = false;
  expressionDisplay.textContent = "Ready to calculate";
  resultDisplay.textContent = "0";
}

function backspace() {
  if (justCalculated) {
    expression = "";
    justCalculated = false;
  } else {
    expression = expression.slice(0, -1);
  }

  updateExpression();
}

function toggleSign() {
  if (!expression) {
    expression = "-";
  } else if (expression.startsWith("-(") &&
             expression.endsWith(")")) {
    expression = expression.slice(2, -1);
  } else {
    expression = "-(" + expression + ")";
  }

  justCalculated = false;
  updateExpression();
}

function square() {
  if (!expression) return;

  expression = "(" + expression + ")^2";
  justCalculated = false;
  updateExpression();
}

function reciprocal() {
  expression = "1/(" + (expression || "Ans") + ")";
  justCalculated = false;
  updateExpression();
}

function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const rest = input.slice(i);

    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    const number = rest.match(
      /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i
    );

    if (number) {
      tokens.push({
        type: "number",
        value: Number(number[0])
      });

      i += number[0].length;
      continue;
    }

    const identifier = rest.match(/^[a-zA-Z]+/);

    if (identifier) {
      const name = identifier[0];

      if (!["sin", "cos", "tan", "log", "ln",
            "sqrt", "Ans", "pi"].includes(name)) {
        throw new Error("Unknown function");
      }

      tokens.push({ type: "name", value: name });
      i += name.length;
      continue;
    }

    if (input[i] === "π") {
      tokens.push({ type: "number", value: Math.PI });
      i++;
      continue;
    }

    if ("+-*/^()%!".includes(input[i])) {
      tokens.push({ type: "symbol", value: input[i] });
      i++;
      continue;
    }

    throw new Error("Invalid character");
  }

  return tokens;
}

function evaluate(input) {
  const tokens = tokenize(input);
  let position = 0;

  function peek(value) {
    return tokens[position]?.value === value;
  }

  function take(value) {
    if (peek(value)) {
      position++;
      return true;
    }

    return false;
  }

  function primary() {
    if (take("(")) {
      const value = addSub();

      if (!take(")")) {
        throw new Error("Missing closing parenthesis");
      }

      return value;
    }

    const token = tokens[position++];

    if (!token) {
      throw new Error("Incomplete expression");
    }

    if (token.type === "number") {
      return token.value;
    }

    if (token.type === "name") {
      if (token.value === "Ans") return answer;
      if (token.value === "pi") return Math.PI;

      if (token.value === "e") return Math.E;

      if (!take("(")) {
        throw new Error("Function needs parentheses");
      }

      const value = addSub();

      if (!take(")")) {
        throw new Error("Missing closing parenthesis");
      }

      switch (token.value) {
        case "sin":
          return Math.sin(
            isRadians ? value : value * Math.PI / 180
          );

        case "cos":
          return Math.cos(
            isRadians ? value : value * Math.PI / 180
          );

        case "tan": {
          const angle = isRadians
            ? value
            : value * Math.PI / 180;

          if (Math.abs(Math.cos(angle)) < 1e-12) {
            throw new Error("Tangent is undefined here");
          }

          return Math.tan(angle);
        }

        case "log":
          if (value <= 0) {
            throw new Error("Log requires a positive number");
          }
          return Math.log10(value);

        case "ln":
          if (value <= 0) {
            throw new Error("Ln requires a positive number");
          }
          return Math.log(value);

        case "sqrt":
          if (value < 0) {
            throw new Error("Cannot square-root a negative number");
          }
          return Math.sqrt(value);
      }
    }

    throw new Error("Invalid expression");
  }

  function postfix() {
    let value = primary();

    while (true) {
      if (take("!")) {
        if (value < 0 || !Number.isInteger(value) || value > 170) {
          throw new Error("Factorial requires an integer from 0 to 170");
        }

        let factorial = 1;

        for (let n = 2; n <= value; n++) {
          factorial *= n;
        }

        value = factorial;
      } else if (take("%")) {
        value /= 100;
      } else {
        break;
      }
    }

    return value;
  }

  function unary() {
    if (take("+")) return unary();
    if (take("-")) return -unary();

    return power();
  }

  function power() {
    let value = postfix();

    if (take("^")) {
      value = Math.pow(value, unary());
    }

    return value;
  }

  function multiplyDivide() {
    let value = unary();

    while (true) {
      if (take("*")) {
        value *= unary();
      } else if (take("/")) {
        const divisor = unary();

        if (divisor === 0) {
          throw new Error("Cannot divide by zero");
        }

        value /= divisor;
      } else {
        break;
      }
    }

    return value;
  }

  function addSub() {
    let value = multiplyDivide();

    while (true) {
      if (take("+")) {
        value += multiplyDivide();
      } else if (take("-")) {
        value -= multiplyDivide();
      } else {
        break;
      }
    }

    return value;
  }

  if (tokens.length === 0) {
    throw new Error("Enter a calculation");
  }

  const result = addSub();

  if (position !== tokens.length) {
    throw new Error("Check your expression");
  }

  if (!Number.isFinite(result)) {
    throw new Error("Invalid mathematical result");
  }

  return result;
}

function calculate() {
  if (!expression) return;

  const original = expression;

  try {
    const value = evaluate(original);
    const formatted = formatNumber(value);

    answer = value;
    resultDisplay.textContent = formatted;
    expressionDisplay.textContent = original + " =";

    history.unshift({
      expression: original,
      result: formatted
    });

    history = history.slice(0, 10);
    renderHistory();

    expression = formatted;
    justCalculated = true;
  } catch (error) {
    resultDisplay.textContent = error.message;
  }
}

// Memory functions.
function memoryClear() {
  memory = 0;
}

function memoryRecall() {
  append(formatNumber(memory));
}

function memoryAdd() {
  try {
    memory += expression ? evaluate(expression) : 0;
  } catch {
    resultDisplay.textContent = "Invalid memory calculation";
  }
}

function memorySubtract() {
  try {
    memory -= expression ? evaluate(expression) : 0;
  } catch {
    resultDisplay.textContent = "Invalid memory calculation";
  }
}

function renderHistory() {
  historyList.replaceChildren();

  if (history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "Your calculations will appear here.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.tabIndex = 0;

    const left = document.createElement("span");
    left.className = "history-expression";
    left.textContent = item.expression;

    const right = document.createElement("span");
    right.className = "history-result";
    right.textContent = item.result;

    row.append(left, right);

    function reuseCalculation() {
      expression = item.expression;
      justCalculated = false;
      updateExpression();
      historyPanel.hidden = true;
    }

    row.addEventListener("click", reuseCalculation);

    row.addEventListener("keydown", event => {
      if (event.key === "Enter") reuseCalculation();
    });

    historyList.appendChild(row);
  });
}

document.querySelector(".calculator").addEventListener("click", event => {
  const button = event.target.closest("button");

  if (!button) return;

  if (button.dataset.value !== undefined) {
    append(button.dataset.value);
    return;
  }

  switch (button.dataset.action) {
    case "clear":
      clearAll();
      break;

    case "backspace":
      backspace();
      break;

    case "calculate":
      calculate();
      break;

    case "square":
      square();
      break;

    case "reciprocal":
      reciprocal();
      break;

    case "sign":
      toggleSign();
      break;

    case "memory-clear":
      memoryClear();
      break;

    case "memory-recall":
      memoryRecall();
      break;

    case "memory-add":
      memoryAdd();
      break;

    case "memory-subtract":
      memorySubtract();
      break;

    case "history":
      historyPanel.hidden = !historyPanel.hidden;
      break;

    case "clear-history":
      history = [];
      renderHistory();
      break;
  }
});

angleButton.addEventListener("click", () => {
  isRadians = !isRadians;
  angleButton.textContent = isRadians ? "RAD" : "DEG";
});

document.addEventListener("keydown", event => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  if (/^[0-9.]$/.test(event.key)) {
    append(event.key);
  } else if (["+", "-", "*", "/", "^", "(", ")", "%", "!"].includes(event.key)) {
    append(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculate();
  } else if (event.key === "Backspace") {
    backspace();
  } else if (event.key === "Escape") {
    clearAll();
  }
});

renderHistory();
