// ==================================================
// 初期表示する教材用コード
// 学習者はこの形式に沿って文字列と正解番号を編集します。
// ==================================================

const INITIAL_CODE = `// 第1問
const question1 = "JavaScriptで文字を画面に表示するときに使う命令はどれ？";
const choice1_1 = "console.log";
const choice1_2 = "style.color";
const choice1_3 = "border-radius";

if (selectedIndex1 === 0) {
  result1 = "正解！";
} else {
  result1 = "不正解";
}

// 第2問
const question2 = "変数を作るときに使うキーワードはどれ？";
const choice2_1 = "let";
const choice2_2 = "click";
const choice2_3 = "window";

if (selectedIndex2 === 0) {
  result2 = "正解！";
} else {
  result2 = "不正解";
}

// 第3問
const question3 = "条件によって処理を分けるときに使う書き方はどれ？";
const choice3_1 = "if / else";
const choice3_2 = "font-size";
const choice3_3 = "padding";

if (selectedIndex3 === 0) {
  result3 = "正解！";
} else {
  result3 = "不正解";
}`;

// ==================================================
// 画面要素
// ==================================================

const codeEditor = document.getElementById("code-editor");
const lineNumbers = document.getElementById("line-numbers");
const highlightLayer = document.getElementById("highlight-layer");
const editorWrap = document.getElementById("editor-wrap");
const runButton = document.getElementById("run-button");
const resetCodeButton = document.getElementById("reset-code-button");
const consoleOutput = document.getElementById("console-output");
const consolePanel = document.getElementById("console-panel");
const consoleResize = document.getElementById("console-resize");
const clearConsoleButton = document.getElementById("clear-console-button");
const furiganaToggle = document.getElementById("furigana-toggle");
const furiganaToggleLabel = document.getElementById("furigana-toggle-label");
const tokenDetail = document.getElementById("token-detail");
const stepButtons = document.getElementById("step-buttons");
const stepTitle = document.getElementById("step-title");
const stepDescription = document.getElementById("step-description");
const stepProgress = document.getElementById("step-progress");
const hintButton = document.getElementById("hint-button");
const hintList = document.getElementById("hint-list");
const activityEditor = document.getElementById("activity-editor");
const activityGuide = document.getElementById("activity-guide");
const guideSidebar = document.getElementById("guide-sidebar");
const guideCloseButton = document.getElementById("guide-close-button");
const statusParse = document.getElementById("status-parse");
const statusToken = document.getElementById("status-token");
const statusCursor = document.getElementById("status-cursor");

const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const questionNumber = document.getElementById("question-number");
const questionText = document.getElementById("question-text");
const answerMessage = document.getElementById("answer-message");
const nextButton = document.getElementById("next-button");
const scoreText = document.getElementById("score-text");
const resultMessage = document.getElementById("result-message");
const restartButton = document.getElementById("restart-button");

const choiceButtons = [
  document.getElementById("choice-0"),
  document.getElementById("choice-1"),
  document.getElementById("choice-2")
];

let quizData = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let answered = false;
let lastValidQuizData = null;
let lastValidSourceCode = null;
let latestParsedSupportData = null;
let initialQuizSnapshot = null;
let currentStep = 1;
let consoleResizeState = null;
let guideIsOpen = false;
const revealedHintCounts = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0
};

const STEP_GUIDE = [
  {
    number: 1,
    title: "STEP 1：コードを読む",
    description: "まずは初期コードを解析して、部品の意味を確認しましょう。",
    hints: [
      "`const` は、名前を付けて文字を入れておく合図です。",
      "`if` の中では、選んだ番号と正解番号を比べています。",
      "ふりがなをONにして、同じ部品の意味を探してみましょう。"
    ]
  },
  {
    number: 2,
    title: "STEP 2：問題文を変える",
    description: "`question1` の文字列を、自分の問題文に変えてみましょう。",
    hints: [
      "変える場所は `const question1 = \"...\";` の `\"` の中だけです。",
      "最後の `;` は消さずに残します。",
      "問題文は、答えが3つの選択肢から選べる形にすると作りやすいです。"
    ]
  },
  {
    number: 3,
    title: "STEP 3：選択肢を変える",
    description: "`choice1_1` から `choice1_3` の文字列を、問題に合う選択肢へ変えましょう。",
    hints: [
      "`choice1_1` は第1問の1番目、`choice1_2` は2番目、`choice1_3` は3番目です。",
      "まず1つだけ変えて実行し、プレビューに反映されるか確認しましょう。",
      "3つの選択肢のうち、どれを正解にするか先に決めておくと進めやすいです。"
    ]
  },
  {
    number: 4,
    title: "STEP 4：正解番号を変える",
    description: "`selectedIndex1 === 0` の番号を、正解にしたい選択肢の番号へ変えましょう。",
    hints: [
      "1番目の選択肢は `0`、2番目は `1`、3番目は `2` です。",
      "`===` の左側や `selectedIndex1` は変えず、右側の番号だけを変えます。",
      "実行したら、プレビューで正解と不正解の両方を試してみましょう。"
    ]
  },
  {
    number: 5,
    title: "STEP 5：3問分を完成させる",
    description: "3問すべての問題文・選択肢・正解番号を整えて、クイズデータとして完成させましょう。",
    hints: [
      "`question2` や `choice3_2` の数字は、何問目かを表しています。",
      "各問題の `selectedIndex` と `result` の数字は、同じ問題番号にそろえます。",
      "最後に3問を通してプレイし、結果画面まで進めるか確認しましょう。"
    ]
  }
];

// ==================================================
// 疑似IDEの表示制御
// ==================================================

function setEditorCode(code) {
  codeEditor.value = code;
  updateEditorView();
}

function updateEditorView() {
  applyFuriganaMode();
  updateLineNumbers();
  renderEditorHighlight(codeEditor.value);
  syncEditorScroll();
  updateLearningSupport();
  updateCursorStatus();
}

function applyFuriganaMode() {
  const enabled = furiganaToggle.checked;
  editorWrap.classList.toggle("furigana-on", enabled);
  editorWrap.classList.toggle("furigana-off", enabled === false);
  furiganaToggleLabel.textContent = enabled ? "ふりがな ON" : "ふりがな OFF";
}

function updateLineNumbers() {
  const lineCount = codeEditor.value.split("\n").length;
  let html = "";

  for (let i = 1; i <= lineCount; i++) {
    html = html + "<span>" + i + "</span>";
  }

  lineNumbers.innerHTML = html;
}

function syncEditorScroll() {
  highlightLayer.scrollTop = codeEditor.scrollTop;
  highlightLayer.scrollLeft = codeEditor.scrollLeft;
  lineNumbers.scrollTop = codeEditor.scrollTop;
}

function highlightCode(code) {
  let html = "";
  let i = 0;

  while (i < code.length) {
    const char = code[i];
    const next = code[i + 1];

    if (char === "/" && next === "/") {
      const start = i;
      i = i + 2;
      while (i < code.length && code[i] !== "\n") {
        i = i + 1;
      }
      html = html + wrapToken("comment", code.slice(start, i));
    } else if (char === "\"") {
      const start = i;
      i = i + 1;
      while (i < code.length) {
        if (code[i] === "\\" && i + 1 < code.length) {
          i = i + 2;
        } else if (code[i] === "\"") {
          i = i + 1;
          break;
        } else {
          i = i + 1;
        }
      }
      html = html + wrapToken("string", code.slice(start, i));
    } else if (isIdentifierStart(char)) {
      const start = i;
      i = i + 1;
      while (i < code.length && isIdentifierPart(code[i])) {
        i = i + 1;
      }

      const word = code.slice(start, i);
      if (word === "const" || word === "if" || word === "else") {
        html = html + wrapToken("keyword", word);
      } else {
        html = html + escapeHtml(word);
      }
    } else if (isDigit(char)) {
      const start = i;
      i = i + 1;
      while (i < code.length && isDigit(code[i])) {
        i = i + 1;
      }
      html = html + wrapToken("number", code.slice(start, i));
    } else if ("=;(){}".indexOf(char) !== -1) {
      html = html + wrapToken("operator", char);
      i = i + 1;
    } else {
      html = html + escapeHtml(char);
      i = i + 1;
    }
  }

  if (html.endsWith("\n")) {
    html = html + " ";
  }

  return html;
}

function wrapToken(type, text) {
  return "<span class=\"token-" + type + "\">" + escapeHtml(text) + "</span>";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showSuccess(message) {
  appendConsole("success", message);
  statusParse.textContent = "準備完了";
}

function showErrors(errors) {
  for (let i = 0; i < errors.length; i++) {
    appendConsole("error", errors[i]);
  }
  statusParse.textContent = "エラーあり";
}

function appendConsole(kind, message) {
  const line = document.createElement("div");
  line.className = "console-line console-" + kind;
  const prefix = kind === "error" ? "[エラー]" : kind === "success" ? "[実行]" : "[学習]";
  line.textContent = prefix + " " + message;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
  clearChildren(consoleOutput);
}

// ==================================================
// 限定構文の字句解析
// 入力コードは実行せず、許可した形だけを読み取ります。
// ==================================================

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === " " || char === "\t" || char === "\r") {
      advance(char);
    } else if (char === "\n") {
      advance(char);
    } else if (char === "/" && next === "/") {
      skipLineComment();
    } else if (char === "\"") {
      tokens.push(readString());
    } else if (isDigit(char)) {
      tokens.push(readNumber());
    } else if (isIdentifierStart(char)) {
      tokens.push(readIdentifier());
    } else if (char === "=" && source[index + 1] === "=" && source[index + 2] === "=") {
      tokens.push(makeToken("operator", "==="));
      advance("=");
      advance("=");
      advance("=");
    } else if ("=;(){}".indexOf(char) !== -1) {
      tokens.push(makeToken("punctuation", char));
      advance(char);
    } else {
      throw createCodeError("行" + line + "列" + column + "：使えない文字 `" + char + "` があります。");
    }
  }

  tokens.push({
    type: "eof",
    value: "",
    line: line,
    column: column
  });

  return tokens;

  function makeToken(type, value) {
    return {
      type: type,
      value: value,
      line: line,
      column: column
    };
  }

  function advance(currentChar) {
    index = index + 1;
    if (currentChar === "\n") {
      line = line + 1;
      column = 1;
    } else {
      column = column + 1;
    }
  }

  function skipLineComment() {
    while (index < source.length && source[index] !== "\n") {
      advance(source[index]);
    }
  }

  function readString() {
    const startLine = line;
    const startColumn = column;
    let value = "";

    advance("\"");

    while (index < source.length) {
      const current = source[index];

      if (current === "\"") {
        advance(current);
        return {
          type: "string",
          value: value,
          line: startLine,
          column: startColumn
        };
      }

      if (current === "\n") {
        throw createCodeError("行" + startLine + "列" + startColumn + "：文字列を囲む `\"` が閉じられていません。");
      }

      if (current === "\\") {
        const escaped = source[index + 1];

        if (escaped === "\"" || escaped === "\\") {
          value = value + escaped;
          advance(current);
          advance(escaped);
        } else if (escaped === "n") {
          value = value + "\n";
          advance(current);
          advance(escaped);
        } else {
          throw createCodeError("行" + line + "列" + column + "：この文字列の書き方は使えません。`\"` を入れたいときは `\\\"` と書きます。");
        }
      } else {
        value = value + current;
        advance(current);
      }
    }

    throw createCodeError("行" + startLine + "列" + startColumn + "：文字列を囲む `\"` が閉じられていません。");
  }

  function readNumber() {
    const startLine = line;
    const startColumn = column;
    let value = "";

    while (index < source.length && isDigit(source[index])) {
      value = value + source[index];
      advance(source[index]);
    }

    return {
      type: "number",
      value: value,
      line: startLine,
      column: startColumn
    };
  }

  function readIdentifier() {
    const startLine = line;
    const startColumn = column;
    let value = "";

    while (index < source.length && isIdentifierPart(source[index])) {
      value = value + source[index];
      advance(source[index]);
    }

    if (value === "const" || value === "if" || value === "else") {
      return {
        type: "keyword",
        value: value,
        line: startLine,
        column: startColumn
      };
    }

    return {
      type: "identifier",
      value: value,
      line: startLine,
      column: startColumn
    };
  }
}

// ==================================================
// 限定構文の構文解析と検証
// ==================================================

function parseLearnerCode(source) {
  const tokens = tokenize(source);
  const parser = createParser(tokens);
  return parser.parseProgram();
}

function createParser(tokens) {
  let position = 0;
  const values = {};
  const correctIndexes = {};
  const declarations = [];
  const conditions = [];

  return {
    parseProgram: parseProgram
  };

  function parseProgram() {
    while (!isAtEnd()) {
      if (check("keyword", "const")) {
        parseConstDeclaration();
      } else if (check("keyword", "if")) {
        parseIfStatement();
      } else {
        const token = peek();
        throw tokenError(token, "`const` または `if` から書き始めてください。");
      }
    }

    return buildQuizData();
  }

  function parseConstDeclaration() {
    const constToken = consume("keyword", "const", "`const` から始めてください。");
    const nameToken = consume("identifier", null, "`const` の後に変数名が必要です。");
    consume("punctuation", "=", "変数名の後に `=` が必要です。");
    const valueToken = consume("string", null, "問題文や選択肢は `\"` で囲んだ文字列にしてください。");
    consume("punctuation", ";", "行の終わりに `;` が必要です。");

    if (!isAllowedConstName(nameToken.value)) {
      throw tokenError(nameToken, "この変数名は使えません。`question1` や `choice1_1` の形で書いてください。");
    }

    if (Object.prototype.hasOwnProperty.call(values, nameToken.value)) {
      throw tokenError(nameToken, "`" + nameToken.value + "` が2回書かれています。1回だけ書いてください。");
    }

    values[nameToken.value] = valueToken.value;
    declarations.push(createDeclarationMetadata(nameToken.value, valueToken.value, constToken.line));
  }

  function parseIfStatement() {
    const ifToken = consume("keyword", "if", "`if` から始めてください。");
    consume("punctuation", "(", "`if` の後に `(` が必要です。");
    const selectedToken = consume("identifier", null, "`if` の条件に `selectedIndex1` のような名前が必要です。");
    consume("operator", "===", "比較には `===` を使ってください。");
    const numberToken = consume("number", null, "正解番号は0、1、2のいずれかです。");
    consume("punctuation", ")", "`if` の条件の後に `)` が必要です。");
    consume("punctuation", "{", "`if` の条件の後に `{` が必要です。");
    const successResultToken = consume("identifier", null, "`result1` のような結果用の名前が必要です。");
    consume("punctuation", "=", "`result` の後に `=` が必要です。");
    const successTextToken = consume("string", null, "`正解！` を文字列で書いてください。");
    consume("punctuation", ";", "行の終わりに `;` が必要です。");
    consume("punctuation", "}", "`if` の処理の終わりに `}` が必要です。");
    consume("keyword", "else", "`if` の後に `else` が必要です。");
    consume("punctuation", "{", "`else` の後に `{` が必要です。");
    const failureResultToken = consume("identifier", null, "`result1` のような結果用の名前が必要です。");
    consume("punctuation", "=", "`result` の後に `=` が必要です。");
    const failureTextToken = consume("string", null, "`不正解` を文字列で書いてください。");
    consume("punctuation", ";", "行の終わりに `;` が必要です。");
    consume("punctuation", "}", "`else` の処理の終わりに `}` が必要です。");

    const selectedMatch = selectedToken.value.match(/^selectedIndex([123])$/);
    if (selectedMatch === null) {
      throw tokenError(selectedToken, "`if` の条件は `selectedIndex1`、`selectedIndex2`、`selectedIndex3` のどれかを使ってください。");
    }

    const questionNumber = selectedMatch[1];
    const expectedResultName = "result" + questionNumber;
    if (successResultToken.value !== expectedResultName || failureResultToken.value !== expectedResultName) {
      throw tokenError(successResultToken, "第" + questionNumber + "問のif文では `" + expectedResultName + "` を使ってください。");
    }

    if (successTextToken.value !== "正解！") {
      throw tokenError(successTextToken, "正解のときは `result" + questionNumber + " = \"正解！\";` と書いてください。");
    }

    if (failureTextToken.value !== "不正解") {
      throw tokenError(failureTextToken, "不正解のときは `result" + questionNumber + " = \"不正解\";` と書いてください。");
    }

    const correctIndex = Number(numberToken.value);
    if (correctIndex < 0 || correctIndex > 2 || String(correctIndex) !== numberToken.value) {
      throw tokenError(numberToken, "正解番号は0、1、2のいずれかです。");
    }

    if (Object.prototype.hasOwnProperty.call(correctIndexes, questionNumber)) {
      throw tokenError(selectedToken, "第" + questionNumber + "問のif文が2回書かれています。1回だけ書いてください。");
    }

    correctIndexes[questionNumber] = correctIndex;
    conditions.push({
      line: ifToken.line,
      questionNumber: Number(questionNumber),
      selectedName: selectedToken.value,
      resultName: expectedResultName,
      correctIndex: correctIndex,
      successText: successTextToken.value,
      failureText: failureTextToken.value
    });
  }

  function buildQuizData() {
    const errors = [];
    const questions = [];

    for (let questionIndex = 1; questionIndex <= 3; questionIndex++) {
      const questionKey = "question" + questionIndex;
      const choice1Key = "choice" + questionIndex + "_1";
      const choice2Key = "choice" + questionIndex + "_2";
      const choice3Key = "choice" + questionIndex + "_3";
      const keys = [questionKey, choice1Key, choice2Key, choice3Key];

      for (let i = 0; i < keys.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(values, keys[i])) {
          errors.push("第" + questionIndex + "問の `" + keys[i] + "` がありません。");
        } else if (values[keys[i]].trim() === "") {
          errors.push("第" + questionIndex + "問の `" + keys[i] + "` が空です。文字を入れてください。");
        }
      }

      if (!Object.prototype.hasOwnProperty.call(correctIndexes, String(questionIndex))) {
        errors.push("第" + questionIndex + "問のif文がありません。`if (selectedIndex" + questionIndex + " === 0)` の形で書いてください。");
      }

      questions.push({
        question: values[questionKey] || "",
        choices: [
          values[choice1Key] || "",
          values[choice2Key] || "",
          values[choice3Key] || ""
        ],
        correctIndex: correctIndexes[String(questionIndex)]
      });
    }

    if (errors.length > 0) {
      const error = createCodeError(errors[0]);
      error.messages = errors;
      throw error;
    }

    return {
      questions: questions,
      declarations: declarations.slice(),
      conditions: conditions.slice(),
      readingLines: buildReadingLines(declarations, conditions),
      explanations: buildExplanations(declarations, conditions),
      tokens: tokens.filter(function (token) {
        return token.type !== "eof";
      })
    };
  }

  function consume(type, value, message) {
    if (check(type, value)) {
      return advance();
    }
    throw tokenError(peek(), message);
  }

  function check(type, value) {
    if (isAtEnd()) {
      return false;
    }

    const token = peek();
    if (token.type !== type) {
      return false;
    }

    return value === null || token.value === value;
  }

  function advance() {
    if (!isAtEnd()) {
      position = position + 1;
    }
    return previous();
  }

  function isAtEnd() {
    return peek().type === "eof";
  }

  function peek() {
    return tokens[position];
  }

  function previous() {
    return tokens[position - 1];
  }
}

function createDeclarationMetadata(name, value, line) {
  const questionMatch = name.match(/^question([123])$/);
  if (questionMatch !== null) {
    return {
      type: "question",
      line: line,
      name: name,
      value: value,
      questionNumber: Number(questionMatch[1])
    };
  }

  const choiceMatch = name.match(/^choice([123])_([123])$/);
  return {
    type: "choice",
    line: line,
    name: name,
    value: value,
    questionNumber: Number(choiceMatch[1]),
    choiceNumber: Number(choiceMatch[2])
  };
}

function buildReadingLines(declarations, conditions) {
  const items = [];

  for (let i = 0; i < declarations.length; i++) {
    const declaration = declarations[i];
    if (declaration.type === "question") {
      items.push({
        line: declaration.line,
        text: "第" + declaration.questionNumber + "問の問題文として、文字列『" + declaration.value + "』を定義する。"
      });
    } else {
      items.push({
        line: declaration.line,
        text: "第" + declaration.questionNumber + "問の" + declaration.choiceNumber + "番目の選択肢として、文字列『" + declaration.value + "』を定義する。"
      });
    }
  }

  for (let j = 0; j < conditions.length; j++) {
    const condition = conditions[j];
    items.push({
      line: condition.line,
      text: "もしも第" + condition.questionNumber + "問で選択した番号が" + condition.correctIndex + "と等しいなら、判定結果を『" + condition.successText + "』にする。そうでなければ『" + condition.failureText + "』にする。"
    });
  }

  items.sort(function (a, b) {
    return a.line - b.line;
  });

  return items;
}

function buildExplanations(declarations, conditions) {
  return {
    declarationCount: declarations.length,
    conditionCount: conditions.length
  };
}

function isAllowedConstName(name) {
  return /^question[123]$/.test(name) || /^choice[123]_[123]$/.test(name);
}

function tokenError(token, message) {
  return createCodeError("行" + token.line + "列" + token.column + "：" + message);
}

function createCodeError(message) {
  const error = new Error(message);
  error.messages = [message];
  return error;
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function isDigit(char) {
  return /[0-9]/.test(char);
}

// ==================================================
// 学習支援表示
// ==================================================

function updateLearningSupport() {
  let parsed = null;
  let parseError = null;

  try {
    parsed = parseLearnerCode(codeEditor.value);
    latestParsedSupportData = parsed;
    lastValidQuizData = cloneQuizData(parsed.questions);
    lastValidSourceCode = codeEditor.value;
  } catch (error) {
    parseError = error;
    latestParsedSupportData = null;
  }

  renderStepGuide(parsed, parseError);
}

function renderEditorHighlight(source) {
  clearChildren(highlightLayer);

  const lines = source.split("\n");
  const tokensByLine = groupTokensByLine(tokenizeForFurigana(source));

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineRow = document.createElement("div");
    lineRow.className = "hl-line";
    const lineTokens = tokensByLine[lineIndex + 1] || [];
    let column = 1;

    for (let i = 0; i < lineTokens.length; i++) {
      const token = lineTokens[i];
      if (token.column > column) {
        lineRow.appendChild(document.createTextNode(lines[lineIndex].slice(column - 1, token.column - 1)));
      }

      lineRow.appendChild(createRubyTokenSpan(token));
      column = token.column + token.value.length;
    }

    if (column <= lines[lineIndex].length) {
      lineRow.appendChild(document.createTextNode(lines[lineIndex].slice(column - 1)));
    }

    if (lines[lineIndex].length === 0) {
      lineRow.appendChild(document.createTextNode(" "));
    }

    highlightLayer.appendChild(lineRow);
  }
}

function createRubyTokenSpan(token) {
    const meaning = describeToken(token);
    const tokenSpan = document.createElement("span");
    tokenSpan.className = "ruby-token ruby-token-" + getTokenClassName(token);
    tokenSpan.title = meaning.detail;

    if (token.type !== "punctuation") {
      const meaningText = document.createElement("span");
      meaningText.className = "ruby-meaning";
      meaningText.textContent = meaning.short;
      meaningText.title = meaning.detail;
      tokenSpan.appendChild(meaningText);
    }

    const codeText = document.createElement("span");
    codeText.className = "ruby-code";
    codeText.textContent = getTokenDisplayValue(token);

    tokenSpan.appendChild(codeText);
    return tokenSpan;
}

function groupTokensByLine(tokens) {
  const grouped = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!grouped[token.line]) {
      grouped[token.line] = [];
    }
    grouped[token.line].push(token);
  }
  return grouped;
}

function tokenizeForFurigana(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === " " || char === "\t" || char === "\r") {
      advance(char);
    } else if (char === "\n") {
      advance(char);
    } else if (char === "/" && next === "/") {
      readLineComment();
    } else if (char === "\"") {
      readDisplayString();
    } else if (isDigit(char)) {
      readDisplayNumber();
    } else if (isIdentifierStart(char)) {
      readDisplayIdentifier();
    } else if (char === "=" && source[index + 1] === "=" && source[index + 2] === "=") {
      pushToken("operator", "===", line, column);
      advance("=");
      advance("=");
      advance("=");
    } else if ("=;(){}".indexOf(char) !== -1) {
      pushToken("punctuation", char, line, column);
      advance(char);
    } else {
      advance(char);
    }
  }

  return tokens;

  function pushToken(type, value, tokenLine, tokenColumn) {
    tokens.push({
      type: type,
      value: value,
      line: tokenLine,
      column: tokenColumn
    });
  }

  function advance(currentChar) {
    index = index + 1;
    if (currentChar === "\n") {
      line = line + 1;
      column = 1;
    } else {
      column = column + 1;
    }
  }

  function readLineComment() {
    const startIndex = index;
    const startLine = line;
    const startColumn = column;
    while (index < source.length && source[index] !== "\n") {
      advance(source[index]);
    }
    pushToken("comment", source.slice(startIndex, index), startLine, startColumn);
  }

  function readDisplayString() {
    const startIndex = index;
    const startLine = line;
    const startColumn = column;
    advance("\"");
    while (index < source.length) {
      const current = source[index];
      if (current === "\\" && index + 1 < source.length) {
        advance(current);
        advance(source[index]);
      } else if (current === "\"") {
        advance(current);
        break;
      } else {
        advance(current);
      }
    }
    pushToken("string", source.slice(startIndex, index), startLine, startColumn);
  }

  function readDisplayNumber() {
    const startIndex = index;
    const startLine = line;
    const startColumn = column;
    while (index < source.length && isDigit(source[index])) {
      advance(source[index]);
    }
    pushToken("number", source.slice(startIndex, index), startLine, startColumn);
  }

  function readDisplayIdentifier() {
    const startIndex = index;
    const startLine = line;
    const startColumn = column;
    while (index < source.length && isIdentifierPart(source[index])) {
      advance(source[index]);
    }
    const value = source.slice(startIndex, index);
    pushToken(value === "const" || value === "if" || value === "else" ? "keyword" : "identifier", value, startLine, startColumn);
  }
}

function renderStepGuide(parsed, parseError) {
  renderStepButtons(parsed, parseError);

  const step = STEP_GUIDE[currentStep - 1];
  const result = evaluateStepProgress(parsed, currentStep, parseError);
  stepTitle.textContent = step.title;
  stepDescription.textContent = step.description;
  stepProgress.textContent = result.message;
  stepProgress.className = result.done ? "step-progress complete" : "step-progress";

  renderHints();
}

function renderStepButtons(parsed, parseError) {
  clearChildren(stepButtons);

  for (let i = 0; i < STEP_GUIDE.length; i++) {
    const step = STEP_GUIDE[i];
    const result = evaluateStepProgress(parsed, step.number, parseError);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "step-button";
    if (step.number === currentStep) {
      button.classList.add("active");
    }
    if (result.done) {
      button.classList.add("complete");
    }
    button.textContent = "STEP " + step.number;
    button.addEventListener("click", function () {
      currentStep = step.number;
      renderStepGuide(latestParsedSupportData, latestParsedSupportData === null ? parseError : null);
    });
    stepButtons.appendChild(button);
  }
}

function renderHints() {
  clearChildren(hintList);
  const step = STEP_GUIDE[currentStep - 1];
  const revealedCount = revealedHintCounts[currentStep];

  for (let i = 0; i < revealedCount; i++) {
    const hintItem = document.createElement("li");
    hintItem.textContent = step.hints[i];
    hintList.appendChild(hintItem);
  }

  hintButton.disabled = revealedCount >= step.hints.length;
  hintButton.textContent = revealedCount >= step.hints.length ? "ヒントはすべて表示済み" : "ヒントを見る";
}

function evaluateStepProgress(parsedData, stepNumber, parseError) {
  if (parsedData === null) {
    return {
      done: false,
      message: "構文解析：未完了。エラーを直すと、このSTEPの達成状況を確認できます。"
    };
  }

  if (parseError !== null) {
    return {
      done: false,
      message: "構文解析：未完了。コードの形を直してから確認しましょう。"
    };
  }

  if (stepNumber === 1) {
    return {
      done: true,
      message: "構文解析：成功。ふりがなと学習ガイドで部品の意味を確認できます。"
    };
  }

  if (initialQuizSnapshot === null) {
    return {
      done: false,
      message: "初期データを準備しています。"
    };
  }

  if (stepNumber === 2) {
    const changed = parsedData.questions[0].question !== initialQuizSnapshot[0].question;
    return {
      done: changed,
      message: changed ? "達成：第1問の問題文が変更されています。" : "未達成：`question1` の文字列を初期値から変えてみましょう。"
    };
  }

  if (stepNumber === 3) {
    const changedChoices = countChangedChoices(parsedData.questions[0], initialQuizSnapshot[0]);
    return {
      done: changedChoices > 0,
      message: changedChoices > 0 ? "達成：第1問の選択肢が" + changedChoices + "個変更されています。" : "未達成：`choice1_1` から `choice1_3` の文字列を変えてみましょう。"
    };
  }

  if (stepNumber === 4) {
    const changedAnswer = parsedData.questions[0].correctIndex !== initialQuizSnapshot[0].correctIndex;
    return {
      done: changedAnswer,
      message: changedAnswer ? "達成：第1問の正解番号が変更されています。プレビューで正解・不正解を試しましょう。" : "未達成：`selectedIndex1 === 0` の右側の番号を変えてみましょう。"
    };
  }

  const completed = isThreeQuestionQuizComplete(parsedData);
  return {
    done: completed,
    message: completed ? "達成：3問分の構造化データを取得できます。実行してクイズを通して確認しましょう。" : "未達成：3問すべての問題文・選択肢・正解番号を完成させましょう。"
  };
}

function countChangedChoices(currentQuestion, initialQuestion) {
  let count = 0;
  for (let i = 0; i < currentQuestion.choices.length; i++) {
    if (currentQuestion.choices[i] !== initialQuestion.choices[i]) {
      count = count + 1;
    }
  }
  return count;
}

function isThreeQuestionQuizComplete(parsedData) {
  if (parsedData.questions.length !== 3) {
    return false;
  }

  for (let i = 0; i < parsedData.questions.length; i++) {
    const question = parsedData.questions[i];
    if (question.question.trim() === "" || typeof question.correctIndex !== "number") {
      return false;
    }
    for (let j = 0; j < question.choices.length; j++) {
      if (question.choices[j].trim() === "") {
        return false;
      }
    }
  }

  return true;
}

function describeToken(token) {
  if (token.type === "comment") {
    return {
      short: "メモ",
      detail: "この行はコメントです。プログラムとしては実行されない説明用のメモです。"
    };
  }

  if (token.type === "keyword") {
    if (token.value === "const") {
      return {
        short: "定数",
        detail: "`const` は、名前を付けて値を用意するためのキーワードです。ここでは定数として扱います。"
      };
    }
    if (token.value === "if") {
      return {
        short: "もし",
        detail: "`if` は、条件が合うときだけ中の処理を行うためのキーワードです。"
      };
    }
    return {
      short: "そうでなければ",
      detail: "`else` は、`if` の条件が合わなかったときの処理を書くためのキーワードです。"
    };
  }

  if (token.type === "identifier") {
    return describeIdentifier(token.value);
  }

  if (token.type === "string") {
    return {
      short: "文字列",
      detail: "ダブルクォーテーションで囲まれた文字です。ここでは『" + token.value + "』という内容です。"
    };
  }

  if (token.type === "number") {
    return {
      short: "番号",
      detail: "`" + token.value + "` は選択肢の番号です。1番目は0、2番目は1、3番目は2として扱います。"
    };
  }

  if (token.type === "operator") {
    return {
      short: "等しい",
      detail: "`===` は、左と右が同じ値かどうかを比べる記号です。"
    };
  }

  return describePunctuation(token.value);
}

function describeIdentifier(value) {
  const questionMatch = value.match(/^question([123])$/);
  if (questionMatch !== null) {
    return {
      short: "問題文",
      detail: "`" + value + "` は、第" + questionMatch[1] + "問の問題文を入れる名前です。"
    };
  }

  const choiceMatch = value.match(/^choice([123])_([123])$/);
  if (choiceMatch !== null) {
    return {
      short: "選択肢",
      detail: "`" + value + "` は、第" + choiceMatch[1] + "問の" + choiceMatch[2] + "番目の選択肢を入れる名前です。"
    };
  }

  const selectedMatch = value.match(/^selectedIndex([123])$/);
  if (selectedMatch !== null) {
    return {
      short: "選んだ番号",
      detail: "`" + value + "` は、第" + selectedMatch[1] + "問で学習者が選んだ選択肢番号を表します。"
    };
  }

  const resultMatch = value.match(/^result([123])$/);
  if (resultMatch !== null) {
    return {
      short: "判定結果",
      detail: "`" + value + "` は、第" + resultMatch[1] + "問の正解・不正解の結果を入れる名前です。"
    };
  }

  return {
    short: "名前",
    detail: "`" + value + "` は値を入れたり参照したりするための名前です。"
  };
}

function describePunctuation(value) {
  const punctuationMeanings = {
    "=": {
      short: "入れる",
      detail: "`=` は、右側の値を左側の名前に入れる記号です。"
    },
    ";": {
      short: "文末",
      detail: "`;` は、1つの命令の終わりを表します。"
    },
    "(": {
      short: "条件開始",
      detail: "`(` は、条件のまとまりの始まりを表します。"
    },
    ")": {
      short: "条件終了",
      detail: "`)` は、条件のまとまりの終わりを表します。"
    },
    "{": {
      short: "処理開始",
      detail: "`{` は、条件が合うときなどに実行する処理の始まりを表します。"
    },
    "}": {
      short: "処理終了",
      detail: "`}` は、処理のまとまりの終わりを表します。"
    }
  };

  return punctuationMeanings[value] || {
    short: "記号",
    detail: "`" + value + "` はコードの形を作る記号です。"
  };
}

function getTokenClassName(token) {
  if (token.type === "punctuation") {
    return "operator";
  }
  return token.type;
}

function getTokenDisplayValue(token) {
  return token.value;
}

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function cloneQuizData(questions) {
  return questions.map(function (question) {
    return {
      question: question.question,
      choices: question.choices.slice(),
      correctIndex: question.correctIndex
    };
  });
}

function getLastValidQuizData() {
  if (lastValidQuizData === null) {
    return null;
  }
  return cloneQuizData(lastValidQuizData);
}

// ==================================================
// v0.4 スタンドアロンHTML生成
// UIには出さず、検証済みの構造化データだけから完成版クイズを作ります。
// ==================================================

function generateStandaloneQuizHtmlForCurrentEditor() {
  const verifiedData = getVerifiedStandaloneQuizData();
  return createStandaloneQuizHtml(verifiedData);
}

function getVerifiedStandaloneQuizData() {
  if (lastValidSourceCode === null || codeEditor.value !== lastValidSourceCode) {
    throw createCodeError("現在のコードはまだ検証されていません。エラーを直してから生成してください。");
  }

  return validateQuizDataForStandalone(getLastValidQuizData());
}

function validateQuizDataForStandalone(data) {
  if (!Array.isArray(data) || data.length !== 3) {
    throw createCodeError("生成できるクイズデータは3問だけです。");
  }

  const validated = [];
  for (let i = 0; i < data.length; i++) {
    const question = data[i];
    if (question === null || typeof question !== "object") {
      throw createCodeError("第" + (i + 1) + "問のデータが正しくありません。");
    }
    if (typeof question.question !== "string" || question.question.trim() === "") {
      throw createCodeError("第" + (i + 1) + "問の問題文が空です。");
    }
    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      throw createCodeError("第" + (i + 1) + "問の選択肢は3つ必要です。");
    }
    if (question.correctIndex !== 0 && question.correctIndex !== 1 && question.correctIndex !== 2) {
      throw createCodeError("第" + (i + 1) + "問の正解番号が正しくありません。");
    }

    const choices = [];
    for (let j = 0; j < question.choices.length; j++) {
      if (typeof question.choices[j] !== "string" || question.choices[j].trim() === "") {
        throw createCodeError("第" + (i + 1) + "問の選択肢" + (j + 1) + "が空です。");
      }
      choices.push(question.choices[j]);
    }

    validated.push({
      question: question.question,
      choices: choices,
      correctIndex: question.correctIndex
    });
  }

  return validated;
}

function createStandaloneQuizHtml(quizQuestions) {
  const questions = validateQuizDataForStandalone(quizQuestions);
  const serializedQuestions = safeSerializeForInlineScript(questions);

  return "<!DOCTYPE html>\n" +
    "<html lang=\"ja\">\n" +
    "<head>\n" +
    "  <meta charset=\"UTF-8\">\n" +
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
    "  <title>3択クイズ</title>\n" +
    "  <style>\n" +
    "    * { box-sizing: border-box; }\n" +
    "    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: 'Yu Gothic', 'Meiryo', sans-serif; color: #1f2937; background: linear-gradient(135deg, #eaf3ff, #f8fbff); }\n" +
    "    main { width: min(92vw, 620px); padding: 34px; text-align: center; background: #fff; border-radius: 18px; box-shadow: 0 12px 30px rgba(33, 72, 120, 0.14); }\n" +
    "    .question-number { margin: 0 0 14px; color: #2868b6; font-weight: bold; }\n" +
    "    h1 { margin: 0 0 24px; font-size: 24px; line-height: 1.5; }\n" +
    "    .choices { display: grid; gap: 12px; margin-bottom: 22px; }\n" +
    "    button { font-family: inherit; font-weight: bold; cursor: pointer; }\n" +
    "    .choice-button { width: 100%; padding: 16px 18px; color: #222; background: #eef5ff; border: 2px solid #c9ddf7; border-radius: 12px; font-size: 17px; }\n" +
    "    .choice-button:disabled { cursor: not-allowed; opacity: 0.75; }\n" +
    "    .choice-button.selected { color: #fff; background: #2868b6; border-color: #2868b6; }\n" +
    "    .main-button { padding: 12px 18px; color: #fff; background: #2868b6; border: 0; border-radius: 10px; font-size: 15px; }\n" +
    "    .answer-message { min-height: 32px; margin: 0 0 18px; font-size: 21px; font-weight: bold; }\n" +
    "    .correct { color: #14843c; }\n" +
    "    .incorrect { color: #c0342b; }\n" +
    "    .score-text { margin: 0 0 16px; font-size: 26px; font-weight: bold; }\n" +
    "    .result-message { margin: 0 0 26px; font-size: 18px; line-height: 1.6; }\n" +
    "    .hidden { display: none; }\n" +
    "  </style>\n" +
    "</head>\n" +
    "<body>\n" +
    "  <main>\n" +
    "    <section id=\"quiz-screen\">\n" +
    "      <p id=\"question-number\" class=\"question-number\"></p>\n" +
    "      <h1 id=\"question-text\"></h1>\n" +
    "      <div class=\"choices\">\n" +
    "        <button id=\"choice-0\" class=\"choice-button\" type=\"button\"></button>\n" +
    "        <button id=\"choice-1\" class=\"choice-button\" type=\"button\"></button>\n" +
    "        <button id=\"choice-2\" class=\"choice-button\" type=\"button\"></button>\n" +
    "      </div>\n" +
    "      <p id=\"answer-message\" class=\"answer-message\" aria-live=\"polite\"></p>\n" +
    "      <button id=\"next-button\" class=\"main-button hidden\" type=\"button\">次の問題へ</button>\n" +
    "    </section>\n" +
    "    <section id=\"result-screen\" class=\"hidden\">\n" +
    "      <p class=\"question-number\">結果発表</p>\n" +
    "      <h1>クイズ終了</h1>\n" +
    "      <p id=\"score-text\" class=\"score-text\"></p>\n" +
    "      <p id=\"result-message\" class=\"result-message\"></p>\n" +
    "      <button id=\"restart-button\" class=\"main-button\" type=\"button\">最初からやり直す</button>\n" +
    "    </section>\n" +
    "  </main>\n" +
    "  <script>\n" +
    "    const quizData = " + serializedQuestions + ";\n" +
    "    let currentQuestionIndex = 0;\n" +
    "    let correctCount = 0;\n" +
    "    let answered = false;\n" +
    "    const quizScreen = document.getElementById('quiz-screen');\n" +
    "    const resultScreen = document.getElementById('result-screen');\n" +
    "    const questionNumber = document.getElementById('question-number');\n" +
    "    const questionText = document.getElementById('question-text');\n" +
    "    const answerMessage = document.getElementById('answer-message');\n" +
    "    const nextButton = document.getElementById('next-button');\n" +
    "    const scoreText = document.getElementById('score-text');\n" +
    "    const resultMessage = document.getElementById('result-message');\n" +
    "    const restartButton = document.getElementById('restart-button');\n" +
    "    const choiceButtons = [document.getElementById('choice-0'), document.getElementById('choice-1'), document.getElementById('choice-2')];\n" +
    "    function showQuestion() {\n" +
    "      const quiz = quizData[currentQuestionIndex];\n" +
    "      answered = false;\n" +
    "      questionNumber.textContent = '第' + (currentQuestionIndex + 1) + '問 / 全' + quizData.length + '問';\n" +
    "      questionText.textContent = quiz.question;\n" +
    "      answerMessage.textContent = '';\n" +
    "      answerMessage.className = 'answer-message';\n" +
    "      nextButton.classList.add('hidden');\n" +
    "      for (let i = 0; i < choiceButtons.length; i++) {\n" +
    "        choiceButtons[i].textContent = quiz.choices[i];\n" +
    "        choiceButtons[i].disabled = false;\n" +
    "        choiceButtons[i].classList.remove('selected');\n" +
    "      }\n" +
    "    }\n" +
    "    function checkAnswer(selectedIndex) {\n" +
    "      if (answered) { return; }\n" +
    "      answered = true;\n" +
    "      choiceButtons[selectedIndex].classList.add('selected');\n" +
    "      if (selectedIndex === quizData[currentQuestionIndex].correctIndex) {\n" +
    "        correctCount = correctCount + 1;\n" +
    "        answerMessage.textContent = '正解！';\n" +
    "        answerMessage.classList.add('correct');\n" +
    "      } else {\n" +
    "        answerMessage.textContent = '不正解';\n" +
    "        answerMessage.classList.add('incorrect');\n" +
    "      }\n" +
    "      for (let i = 0; i < choiceButtons.length; i++) { choiceButtons[i].disabled = true; }\n" +
    "      nextButton.classList.remove('hidden');\n" +
    "    }\n" +
    "    function goToNextQuestion() {\n" +
    "      currentQuestionIndex = currentQuestionIndex + 1;\n" +
    "      if (currentQuestionIndex < quizData.length) { showQuestion(); } else { showResult(); }\n" +
    "    }\n" +
    "    function showResult() {\n" +
    "      quizScreen.classList.add('hidden');\n" +
    "      resultScreen.classList.remove('hidden');\n" +
    "      scoreText.textContent = '正解数：' + correctCount + ' / ' + quizData.length;\n" +
    "      resultMessage.textContent = correctCount === quizData.length ? '全問正解です。すばらしい！' : 'もう一度挑戦して満点を目指しましょう。';\n" +
    "    }\n" +
    "    function restartQuiz() {\n" +
    "      currentQuestionIndex = 0;\n" +
    "      correctCount = 0;\n" +
    "      quizScreen.classList.remove('hidden');\n" +
    "      resultScreen.classList.add('hidden');\n" +
    "      showQuestion();\n" +
    "    }\n" +
    "    choiceButtons[0].addEventListener('click', function () { checkAnswer(0); });\n" +
    "    choiceButtons[1].addEventListener('click', function () { checkAnswer(1); });\n" +
    "    choiceButtons[2].addEventListener('click', function () { checkAnswer(2); });\n" +
    "    nextButton.addEventListener('click', goToNextQuestion);\n" +
    "    restartButton.addEventListener('click', restartQuiz);\n" +
    "    restartQuiz();\n" +
    "  </script>\n" +
    "</body>\n" +
    "</html>";
}

function safeSerializeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// ==================================================
// クイズプレビュー
// ==================================================

function applyCodeToPreview() {
  try {
    const parsed = parseLearnerCode(codeEditor.value);
    quizData = parsed.questions;
    lastValidQuizData = cloneQuizData(parsed.questions);
    lastValidSourceCode = codeEditor.value;
    restartQuiz();
    showSuccess("コードを確認しました。右側のクイズプレビューに反映しました。学習者のJavaScriptは実行していません。");
    updateLearningSupport();
  } catch (error) {
    if (error.messages) {
      showErrors(error.messages);
    } else {
      showErrors(["コードを確認してください。"]);
    }
  }
}

function showQuestion() {
  const quiz = quizData[currentQuestionIndex];

  answered = false;
  questionNumber.textContent = "第" + (currentQuestionIndex + 1) + "問 / 全" + quizData.length + "問";
  questionText.textContent = quiz.question;
  answerMessage.textContent = "";
  answerMessage.className = "answer-message";
  nextButton.classList.add("hidden");

  for (let i = 0; i < choiceButtons.length; i++) {
    choiceButtons[i].textContent = quiz.choices[i];
    choiceButtons[i].disabled = false;
    choiceButtons[i].classList.remove("selected");
  }
}

function checkAnswer(selectedIndex) {
  if (answered === true) {
    return;
  }

  answered = true;
  choiceButtons[selectedIndex].classList.add("selected");

  if (selectedIndex === quizData[currentQuestionIndex].correctIndex) {
    correctCount = correctCount + 1;
    answerMessage.textContent = "正解！";
    answerMessage.classList.add("correct");
  } else {
    answerMessage.textContent = "不正解";
    answerMessage.classList.add("incorrect");
  }

  disableChoices();
  nextButton.classList.remove("hidden");
}

function disableChoices() {
  for (let i = 0; i < choiceButtons.length; i++) {
    choiceButtons[i].disabled = true;
  }
}

function goToNextQuestion() {
  currentQuestionIndex = currentQuestionIndex + 1;

  if (currentQuestionIndex < quizData.length) {
    showQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  quizScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  scoreText.textContent = "正解数：" + correctCount + " / " + quizData.length;

  if (correctCount === quizData.length) {
    resultMessage.textContent = "全問正解です。すばらしい！";
  } else if (correctCount >= 2) {
    resultMessage.textContent = "よくできました。もう一度挑戦して満点を目指しましょう。";
  } else {
    resultMessage.textContent = "もう一度チャレンジして、JavaScriptに慣れていきましょう。";
  }
}

function restartQuiz() {
  currentQuestionIndex = 0;
  correctCount = 0;
  quizScreen.classList.remove("hidden");
  resultScreen.classList.add("hidden");
  showQuestion();
}

function resetCode() {
  setEditorCode(INITIAL_CODE);
  applyCodeToPreview();
}

function initializeLearningState() {
  const initialParsed = parseLearnerCode(INITIAL_CODE);
  initialQuizSnapshot = cloneQuizData(initialParsed.questions);
  lastValidQuizData = cloneQuizData(initialParsed.questions);
  lastValidSourceCode = INITIAL_CODE;
}

function setGuideOpen(open) {
  guideIsOpen = open === true;
  guideSidebar.classList.toggle("hidden", guideIsOpen === false);
  activityGuide.classList.toggle("active", guideIsOpen);
  activityEditor.classList.toggle("active", guideIsOpen === false);
  activityGuide.setAttribute("aria-pressed", guideIsOpen ? "true" : "false");
  activityEditor.setAttribute("aria-pressed", guideIsOpen ? "false" : "true");
  activityGuide.setAttribute("aria-label", guideIsOpen ? "学習ガイドを閉じる" : "学習ガイドを開く");
}

function getCursorLineAndColumn(source, cursorIndex) {
  const before = source.slice(0, cursorIndex);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function positionToIndex(source, line, column) {
  const lines = source.split("\n");
  let index = 0;
  for (let i = 0; i < line - 1; i++) {
    index = index + (lines[i] ? lines[i].length : 0) + 1;
  }
  return index + column - 1;
}

function findTokenAtCursor(source, cursorIndex) {
  const tokens = tokenizeForFurigana(source);
  let matched = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const start = positionToIndex(source, token.line, token.column);
    const end = start + token.value.length;
    if (cursorIndex >= start && cursorIndex <= end) {
      matched = token;
      break;
    }
    if (start > cursorIndex) {
      break;
    }
  }

  return matched;
}

function updateCursorStatus() {
  const source = codeEditor.value;
  const cursor = getCursorLineAndColumn(source, codeEditor.selectionStart);
  statusCursor.textContent = "Ln " + cursor.line + ", Col " + cursor.column;

  const token = findTokenAtCursor(source, codeEditor.selectionStart);
  if (token === null) {
    statusToken.textContent = "コードの意味";
    tokenDetail.textContent = "気になる部品にカーソルを置くと、ここに詳しい意味が表示されます。";
    return;
  }

  const meaning = describeToken(token);
  statusToken.textContent = token.value + " = " + meaning.short;
  tokenDetail.textContent = meaning.detail;
}

function startConsoleResize(event) {
  consoleResizeState = {
    startY: event.clientY,
    startHeight: consolePanel.getBoundingClientRect().height
  };
  document.addEventListener("mousemove", resizeConsole);
  document.addEventListener("mouseup", stopConsoleResize);
  event.preventDefault();
}

function resizeConsole(event) {
  if (consoleResizeState === null) {
    return;
  }

  const nextHeight = consoleResizeState.startHeight + (consoleResizeState.startY - event.clientY);
  const maxHeight = Math.floor(window.innerHeight * 0.45);
  consolePanel.style.height = Math.max(72, Math.min(maxHeight, nextHeight)) + "px";
}

function stopConsoleResize() {
  consoleResizeState = null;
  document.removeEventListener("mousemove", resizeConsole);
  document.removeEventListener("mouseup", stopConsoleResize);
}

// ==================================================
// イベント設定
// ==================================================

codeEditor.addEventListener("input", updateEditorView);
codeEditor.addEventListener("scroll", syncEditorScroll);
codeEditor.addEventListener("keyup", updateCursorStatus);
codeEditor.addEventListener("click", updateCursorStatus);
codeEditor.addEventListener("select", updateCursorStatus);
runButton.addEventListener("click", applyCodeToPreview);
resetCodeButton.addEventListener("click", resetCode);
furiganaToggle.addEventListener("change", updateEditorView);
clearConsoleButton.addEventListener("click", clearConsole);
consoleResize.addEventListener("mousedown", startConsoleResize);
activityGuide.addEventListener("click", function (event) {
  event.stopPropagation();
  setGuideOpen(guideIsOpen === false);
});
activityEditor.addEventListener("click", function (event) {
  event.stopPropagation();
  setGuideOpen(false);
});
guideCloseButton.addEventListener("click", function (event) {
  event.stopPropagation();
  setGuideOpen(false);
});
hintButton.addEventListener("click", function () {
  const step = STEP_GUIDE[currentStep - 1];
  if (revealedHintCounts[currentStep] < step.hints.length) {
    revealedHintCounts[currentStep] = revealedHintCounts[currentStep] + 1;
  }
  renderHints();
});

choiceButtons[0].addEventListener("click", function () {
  checkAnswer(0);
});

choiceButtons[1].addEventListener("click", function () {
  checkAnswer(1);
});

choiceButtons[2].addEventListener("click", function () {
  checkAnswer(2);
});

nextButton.addEventListener("click", goToNextQuestion);
restartButton.addEventListener("click", restartQuiz);

initializeLearningState();
setGuideOpen(false);
appendConsole("info", "初期コードを読み込みました。変更できるのは問題文・選択肢と正解番号だけです。");
setEditorCode(INITIAL_CODE);
applyCodeToPreview();
