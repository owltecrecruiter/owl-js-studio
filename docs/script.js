// ==================================================
// 初期表示する教材用コードと限定パーサ
// 学習者はこの形式に沿って、許可された設定値だけを編集します。
// ==================================================

const studioCore = window.OwlJsStudioCore;
const INITIAL_CODE = studioCore.INITIAL_CODE;
const STEP_GUIDE = studioCore.STEP_GUIDE;
const parseLearnerCode = studioCore.parseLearnerCode;
const tokenize = studioCore.tokenize;
const isIdentifierStart = studioCore.isIdentifierStart;
const isIdentifierPart = studioCore.isIdentifierPart;
const isDigit = studioCore.isDigit;
const cloneWorkData = studioCore.cloneWorkData;
const validateWorkData = studioCore.validateWorkData;
const createStandaloneQuizHtml = studioCore.createStandaloneQuizHtml;
const evaluateStepProgress = studioCore.evaluateStepProgress;
const getStepFocusLines = studioCore.getStepFocusLines;
const describeIdentifier = studioCore.describeIdentifier;
const getContrastWarning = studioCore.getContrastWarning;
const createCodeError = studioCore.createCodeError;
const parseRgbLiteral = studioCore.parseRgbLiteral;
const formatRgbLiteral = studioCore.formatRgbLiteral;
const rgbToHex = studioCore.rgbToHex;
const hexToRgb = studioCore.hexToRgb;
const readConstStringLiteral = studioCore.readConstStringLiteral;
const replaceConstStringLiteral = studioCore.replaceConstStringLiteral;
const findLearnerRgbLiteralByName = studioCore.findLearnerRgbLiteralByName;
const findLearnerRgbLiteralAtOffset = studioCore.findLearnerRgbLiteralAtOffset;

// ==================================================
// 画面要素
// ==================================================

const codeEditor = document.getElementById("code-editor");
const lineNumbers = document.getElementById("line-numbers");
const furiganaGutter = document.getElementById("furigana-gutter");
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

const titleScreen = document.getElementById("title-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const gameTitleLabel = document.getElementById("game-title");
const quizTotalLabel = document.getElementById("quiz-total");
const startButton = document.getElementById("start-button");
const questionNumber = document.getElementById("question-number");
const questionText = document.getElementById("question-text");
const answerMessage = document.getElementById("answer-message");
const nextButton = document.getElementById("next-button");
const scoreText = document.getElementById("score-text");
const resultMessage = document.getElementById("result-message");
const retryButton = document.getElementById("retry-button");
const backToTitleButton = document.getElementById("back-to-title-button");
const colorPickerPopover = document.getElementById("color-picker-popover");
const cpSv = document.getElementById("cp-sv");
const cpSvThumb = document.getElementById("cp-sv-thumb");
const cpCurrentSwatch = document.getElementById("cp-current-swatch");
const cpHue = document.getElementById("cp-hue");
const cpHueThumb = document.getElementById("cp-hue-thumb");
const cpBarR = document.getElementById("cp-bar-r");
const cpBarG = document.getElementById("cp-bar-g");
const cpBarB = document.getElementById("cp-bar-b");
const cpThumbR = document.getElementById("cp-thumb-r");
const cpThumbG = document.getElementById("cp-thumb-g");
const cpThumbB = document.getElementById("cp-thumb-b");
const cpNumR = document.getElementById("cp-num-r");
const cpNumG = document.getElementById("cp-num-g");
const cpNumB = document.getElementById("cp-num-b");

const choiceButtons = [
  document.getElementById("choice-0"),
  document.getElementById("choice-1"),
  document.getElementById("choice-2")
];

let quizData = [];
let currentWork = null;
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
let applyingColorPicker = false;
let lastRunSourceCode = null;
let lastRunWork = null;
let confirmedNewCorrect = false;
let colorPickerTarget = null;
let colorPickerHsv = { h: 0, s: 0, v: 1 };
let colorPickerRgb = { r: 255, g: 255, b: 255 };
let colorPickerDrag = null;
const editorMeasureCanvas = document.createElement("canvas");
const revealedHintCounts = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0
};


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
  updateLearningSupport();
  renderEditorHighlight(codeEditor.value);
  syncEditorOverlay();
  updateCursorStatus();
  syncColorPickersFromCode();
}

function applyFuriganaMode() {
  const enabled = furiganaToggle.checked === true;
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

function syncEditorOverlay() {
  const barX = codeEditor.offsetWidth - codeEditor.clientWidth;
  const barY = codeEditor.offsetHeight - codeEditor.clientHeight;
  highlightLayer.style.right = barX + "px";
  highlightLayer.style.bottom = barY + "px";
  lineNumbers.style.marginBottom = barY + "px";
  furiganaGutter.style.marginBottom = barY + "px";
  highlightLayer.scrollTop = codeEditor.scrollTop;
  highlightLayer.scrollLeft = codeEditor.scrollLeft;
  lineNumbers.scrollTop = codeEditor.scrollTop;
  furiganaGutter.scrollTop = codeEditor.scrollTop;
}

function syncEditorScroll() {
  syncEditorOverlay();
  if (isColorPickerOpen()) {
    positionColorPickerForTarget();
  }
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
// 学習支援表示
// ==================================================

function updateLearningSupport() {
  let parsed = null;
  let parseError = null;

  try {
    parsed = parseLearnerCode(codeEditor.value);
    latestParsedSupportData = parsed;
    lastValidQuizData = cloneWorkData(parsed.work);
    lastValidSourceCode = codeEditor.value;
  } catch (error) {
    parseError = error;
    latestParsedSupportData = null;
  }

  renderStepGuide(parsed, parseError);
}

function renderEditorHighlight(source) {
  clearChildren(highlightLayer);
  clearChildren(furiganaGutter);

  const lines = source.split("\n");
  const tokensByLine = groupTokensByLine(tokenizeForFurigana(source));
  const focusLines = getStepFocusLines(latestParsedSupportData, currentStep);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineRow = document.createElement("div");
    lineRow.className = focusLines.indexOf(lineIndex + 1) !== -1 ? "hl-line hl-line-focus" : "hl-line";
    const lineTokens = tokensByLine[lineIndex + 1] || [];
    let column = 1;
    const meanings = [];

    for (let i = 0; i < lineTokens.length; i++) {
      const token = lineTokens[i];
      if (token.column > column) {
        lineRow.appendChild(document.createTextNode(lines[lineIndex].slice(column - 1, token.column - 1)));
      }

      const meaning = describeToken(token);
      if (shouldShowFurigana(token)) {
        pushUniqueMeaning(meanings, meaning.short);
      }
      lineRow.appendChild(createHighlightTokenSpan(token, meaning));
      column = token.column + token.value.length;
    }

    if (column <= lines[lineIndex].length) {
      lineRow.appendChild(document.createTextNode(lines[lineIndex].slice(column - 1)));
    }

    highlightLayer.appendChild(lineRow);

    const gutterRow = document.createElement("div");
    gutterRow.className = "fg-line";
    gutterRow.textContent = meanings.join(" ") || " ";
    gutterRow.title = meanings.join(" ");
    furiganaGutter.appendChild(gutterRow);
  }
}

function shouldShowFurigana(token) {
  return token.type === "keyword" || token.type === "operator" || token.type === "identifier" || token.type === "number" || token.type === "comment";
}

function pushUniqueMeaning(meanings, shortMeaning) {
  if (meanings.indexOf(shortMeaning) === -1) {
    meanings.push(shortMeaning);
  }
}

function createHighlightTokenSpan(token, meaning) {
  const tokenSpan = document.createElement("span");
  tokenSpan.className = "token-" + getTokenClassName(token);
  tokenSpan.title = meaning.detail;
  tokenSpan.textContent = getTokenDisplayValue(token);
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

function getStepEvidence() {
  return {
    lastRunWork: lastRunWork,
    editorMatchesLastRun: lastRunSourceCode !== null && lastRunSourceCode === codeEditor.value,
    confirmedNewCorrect: confirmedNewCorrect === true
  };
}

function renderStepGuide(parsed, parseError) {
  renderStepButtons(parsed, parseError);

  const step = STEP_GUIDE[currentStep - 1];
  const result = evaluateStepProgress(parsed, currentStep, parseError, initialQuizSnapshot, getStepEvidence());
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
    const result = evaluateStepProgress(parsed, step.number, parseError, initialQuizSnapshot, getStepEvidence());
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
      renderEditorHighlight(codeEditor.value);
      jumpEditorToStepFocus(latestParsedSupportData);
      syncEditorOverlay();
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

function generateStandaloneQuizHtmlForCurrentEditor() {
  const verifiedData = getVerifiedStandaloneQuizData();
  return createStandaloneQuizHtml(verifiedData);
}

function getLastValidQuizData() {
  if (lastValidQuizData === null) {
    return null;
  }
  return cloneWorkData(lastValidQuizData);
}

function getVerifiedStandaloneQuizData() {
  if (lastValidSourceCode === null || codeEditor.value !== lastValidSourceCode) {
    throw createCodeError("現在のコードはまだ検証されていません。エラーを直してから生成してください。");
  }

  return validateWorkData(getLastValidQuizData());
}

// ==================================================
// クイズプレビュー
// ==================================================

function applyCodeToPreview() {
  try {
    const parsed = parseLearnerCode(codeEditor.value);
    const sourceChanged = lastRunSourceCode !== codeEditor.value;
    currentWork = cloneWorkData(parsed.work);
    quizData = currentWork.questions;
    lastValidQuizData = cloneWorkData(parsed.work);
    lastValidSourceCode = codeEditor.value;
    lastRunWork = cloneWorkData(parsed.work);
    lastRunSourceCode = codeEditor.value;
    if (sourceChanged) {
      confirmedNewCorrect = false;
    }
    applyWorkTheme(currentWork);
    showTitleScreen();
    showSuccess("コードを確認しました。右側のタイトル画面に反映しました。学習者のJavaScriptは実行していません。");
    if (parsed.contrastWarning) {
      appendConsole("info", parsed.contrastWarning);
    }
    updateLearningSupport();
  } catch (error) {
    if (error.messages) {
      showErrors(error.messages);
    } else {
      showErrors(["コードを確認してください。"]);
    }
  }
}

function mapIndexThroughReplacement(index, replacement) {
  if (index <= replacement.valueStart) {
    return index;
  }
  if (index <= replacement.oldEnd) {
    return replacement.newEnd;
  }
  return index + (replacement.newEnd - replacement.oldEnd);
}

function isRgbByte(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

function clamp01(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function rgbToHsv(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  if (delta !== 0) {
    if (max === red) {
      h = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
    } else if (max === green) {
      h = ((blue - red) / delta + 2) * 60;
    } else {
      h = ((red - green) / delta + 4) * 60;
    }
  }
  return { h: h, s: s, v: v };
}

function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = v - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (hue < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (hue < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (hue < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (hue < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function parseRgbChannelInput(text) {
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  if (!/^(0|[1-9]\d{0,2})$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!isRgbByte(value)) {
    return null;
  }
  return value;
}

function applyPickerRgbToCode(constName, r, g, b) {
  if (!isRgbByte(r) || !isRgbByte(g) || !isRgbByte(b)) {
    return;
  }

  const literal = formatRgbLiteral(r, g, b);
  const replacement = replaceConstStringLiteral(codeEditor.value, constName, literal);
  if (replacement === null) {
    return;
  }

  applyingColorPicker = true;
  codeEditor.value = replacement.source;
  codeEditor.setSelectionRange(replacement.newEnd, replacement.newEnd);
  updateEditorView();
  applyingColorPicker = false;
}

function applyPickerToCode(constName, hexValue) {
  const rgb = hexToRgb(hexValue);
  if (!rgb || Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) {
    return;
  }
  applyPickerRgbToCode(constName, rgb.r, rgb.g, rgb.b);
}

function syncColorPickersFromCode() {
  if (applyingColorPicker) {
    return;
  }
  if (colorPickerTarget) {
    const literal = readConstStringLiteral(codeEditor.value, colorPickerTarget);
    const rgb = literal ? parseRgbLiteral(literal) : null;
    if (rgb) {
      setColorPickerRgb(rgb.r, rgb.g, rgb.b, false);
    }
  }
}

function setColorPickerRgb(r, g, b, writeToCode) {
  colorPickerRgb = { r: r, g: g, b: b };
  colorPickerHsv = rgbToHsv(r, g, b);
  renderColorPickerChrome();
  if (writeToCode && colorPickerTarget) {
    applyPickerRgbToCode(colorPickerTarget, r, g, b);
  }
}

function setColorPickerHsv(h, s, v, writeToCode) {
  colorPickerHsv = { h: h, s: s, v: v };
  colorPickerRgb = hsvToRgb(h, s, v);
  renderColorPickerChrome();
  if (writeToCode && colorPickerTarget) {
    applyPickerRgbToCode(colorPickerTarget, colorPickerRgb.r, colorPickerRgb.g, colorPickerRgb.b);
  }
}

function renderColorPickerChrome() {
  const rgb = colorPickerRgb;
  const hsv = colorPickerHsv;
  const hueColor = hsvToRgb(hsv.h, 1, 1);
  cpSv.style.background =
    "linear-gradient(to bottom, rgba(0, 0, 0, 0), #000000), linear-gradient(to right, #ffffff, " +
    formatRgbLiteral(hueColor.r, hueColor.g, hueColor.b) + ")";
  cpSvThumb.style.left = (hsv.s * 100) + "%";
  cpSvThumb.style.top = ((1 - hsv.v) * 100) + "%";
  cpHueThumb.style.left = ((hsv.h / 360) * 100) + "%";
  cpCurrentSwatch.style.backgroundColor = formatRgbLiteral(rgb.r, rgb.g, rgb.b);
  cpBarR.style.background = "linear-gradient(to right, " + formatRgbLiteral(0, rgb.g, rgb.b) + ", " + formatRgbLiteral(255, rgb.g, rgb.b) + ")";
  cpBarG.style.background = "linear-gradient(to right, " + formatRgbLiteral(rgb.r, 0, rgb.b) + ", " + formatRgbLiteral(rgb.r, 255, rgb.b) + ")";
  cpBarB.style.background = "linear-gradient(to right, " + formatRgbLiteral(rgb.r, rgb.g, 0) + ", " + formatRgbLiteral(rgb.r, rgb.g, 255) + ")";
  cpThumbR.style.left = ((rgb.r / 255) * 100) + "%";
  cpThumbG.style.left = ((rgb.g / 255) * 100) + "%";
  cpThumbB.style.left = ((rgb.b / 255) * 100) + "%";
  if (document.activeElement !== cpNumR) {
    cpNumR.value = String(rgb.r);
  }
  if (document.activeElement !== cpNumG) {
    cpNumG.value = String(rgb.g);
  }
  if (document.activeElement !== cpNumB) {
    cpNumB.value = String(rgb.b);
  }
}

function isColorPickerOpen() {
  return colorPickerPopover.classList.contains("hidden") === false;
}

function closeColorPicker() {
  colorPickerPopover.classList.add("hidden");
  colorPickerPopover.hidden = true;
  colorPickerTarget = null;
  colorPickerDrag = null;
}

function getEditorTextMetrics() {
  const style = window.getComputedStyle(codeEditor);
  return {
    lineHeight: parseFloat(style.lineHeight) || 21,
    paddingTop: parseFloat(style.paddingTop) || 8,
    paddingLeft: parseFloat(style.paddingLeft) || 12,
    font: style.font
  };
}

function measureEditorTextWidth(text) {
  const context = editorMeasureCanvas.getContext("2d");
  const metrics = getEditorTextMetrics();
  context.font = metrics.font;
  return context.measureText(text).width;
}

function getSourceRangeClientRect(source, start, end) {
  const metrics = getEditorTextMetrics();
  const startPos = getCursorLineAndColumn(source, start);
  const lineStart = positionToIndex(source, startPos.line, 1);
  const textToStart = source.slice(lineStart, start);
  const textToEnd = source.slice(lineStart, end);
  const editorRect = codeEditor.getBoundingClientRect();
  const left = editorRect.left + metrics.paddingLeft + measureEditorTextWidth(textToStart) - codeEditor.scrollLeft;
  const right = editorRect.left + metrics.paddingLeft + measureEditorTextWidth(textToEnd) - codeEditor.scrollLeft;
  const top = editorRect.top + metrics.paddingTop + (startPos.line - 1) * metrics.lineHeight - codeEditor.scrollTop;
  return {
    left: left,
    top: top,
    right: right,
    bottom: top + metrics.lineHeight,
    width: Math.max(1, right - left),
    height: metrics.lineHeight
  };
}

function clampRectToEditor(rect) {
  const editorRect = codeEditor.getBoundingClientRect();
  const left = Math.min(Math.max(rect.left, editorRect.left + 4), Math.max(editorRect.left + 4, editorRect.right - 4));
  const right = Math.min(Math.max(rect.right, left + 1), editorRect.right - 4);
  const top = Math.min(Math.max(rect.top, editorRect.top + 4), Math.max(editorRect.top + 4, editorRect.bottom - 4));
  return {
    left: left,
    top: top,
    right: Math.max(right, left + 1),
    bottom: top + rect.height,
    width: Math.max(1, right - left),
    height: rect.height
  };
}

function positionColorPickerNearRect(rect) {
  colorPickerPopover.classList.remove("hidden");
  colorPickerPopover.hidden = false;
  const popWidth = colorPickerPopover.offsetWidth || 232;
  const popHeight = colorPickerPopover.offsetHeight || 280;
  let left = rect.right + 8;
  let top = rect.bottom + 6;
  if (left + popWidth > window.innerWidth - 8) {
    left = Math.max(8, rect.left - popWidth - 8);
  }
  if (left < 8) {
    left = 8;
  }
  if (left + popWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - popWidth - 8);
  }
  if (top + popHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - popHeight - 6);
  }
  if (top < 8) {
    top = 8;
  }
  colorPickerPopover.style.left = Math.round(left) + "px";
  colorPickerPopover.style.top = Math.round(top) + "px";
}

function positionColorPickerForTarget() {
  if (!colorPickerTarget) {
    return;
  }
  const hit = findLearnerRgbLiteralByName(codeEditor.value, colorPickerTarget);
  if (!hit) {
    return;
  }
  const rawRect = getSourceRangeClientRect(codeEditor.value, hit.valueStart, hit.valueEnd);
  positionColorPickerNearRect(clampRectToEditor(rawRect));
}

function openColorPicker(targetName) {
  const hit = findLearnerRgbLiteralByName(codeEditor.value, targetName);
  if (!hit) {
    return;
  }
  colorPickerTarget = hit.name;
  setColorPickerRgb(hit.rgb.r, hit.rgb.g, hit.rgb.b, false);
  positionColorPickerForTarget();
}

function handleEditorCaretForColorPicker() {
  if (editorWrap.classList.contains("is-composing") || applyingColorPicker) {
    return;
  }
  if (document.activeElement !== codeEditor) {
    return;
  }
  const hit = findLearnerRgbLiteralAtOffset(codeEditor.value, codeEditor.selectionStart);
  if (!hit) {
    if (isColorPickerOpen()) {
      closeColorPicker();
    }
    return;
  }
  openColorPicker(hit.name);
}

function ratioFromPointer(event, element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  return clamp01((event.clientX - rect.left) / rect.width);
}

function applyColorPickerDrag(event) {
  if (!colorPickerDrag) {
    return;
  }
  if (colorPickerDrag === "sv") {
    const rect = cpSv.getBoundingClientRect();
    const s = rect.width <= 0 ? 0 : clamp01((event.clientX - rect.left) / rect.width);
    const v = rect.height <= 0 ? 1 : 1 - clamp01((event.clientY - rect.top) / rect.height);
    setColorPickerHsv(colorPickerHsv.h, s, v, true);
    return;
  }
  if (colorPickerDrag === "hue") {
    setColorPickerHsv(ratioFromPointer(event, cpHue) * 360, colorPickerHsv.s, colorPickerHsv.v, true);
    return;
  }
  const next = {
    r: colorPickerRgb.r,
    g: colorPickerRgb.g,
    b: colorPickerRgb.b
  };
  next[colorPickerDrag] = Math.round(ratioFromPointer(event, colorPickerDrag === "r" ? cpBarR : colorPickerDrag === "g" ? cpBarG : cpBarB) * 255);
  setColorPickerRgb(next.r, next.g, next.b, true);
}

function startColorPickerDrag(kind, event) {
  colorPickerDrag = kind;
  applyColorPickerDrag(event);
  event.preventDefault();
}

function handleRgbNumberInput(channel, field) {
  const parsed = parseRgbChannelInput(field.value);
  if (parsed === null) {
    return;
  }
  const next = {
    r: colorPickerRgb.r,
    g: colorPickerRgb.g,
    b: colorPickerRgb.b
  };
  next[channel] = parsed;
  setColorPickerRgb(next.r, next.g, next.b, true);
}

function handleRgbNumberBlur(channel, field) {
  const parsed = parseRgbChannelInput(field.value);
  if (parsed !== null) {
    handleRgbNumberInput(channel, field);
    return;
  }
  const numeric = Number(String(field.value).trim());
  if (Number.isFinite(numeric)) {
    const clamped = Math.max(0, Math.min(255, Math.round(numeric)));
    field.value = String(clamped);
    handleRgbNumberInput(channel, field);
    return;
  }
  field.value = String(colorPickerRgb[channel]);
}

function applyWorkTheme(work) {
  const surfaces = [titleScreen, quizScreen, resultScreen];
  for (let i = 0; i < surfaces.length; i++) {
    surfaces[i].style.backgroundColor = work.backgroundColor;
    surfaces[i].style.color = work.textColor;
  }
}

function showOnlyPreviewScreen(target) {
  titleScreen.classList.toggle("hidden", target !== titleScreen);
  quizScreen.classList.toggle("hidden", target !== quizScreen);
  resultScreen.classList.toggle("hidden", target !== resultScreen);
}

function showTitleScreen() {
  currentQuestionIndex = 0;
  correctCount = 0;
  answered = false;
  if (currentWork) {
    gameTitleLabel.textContent = currentWork.gameTitle;
  }
  quizTotalLabel.textContent = "全3問";
  showOnlyPreviewScreen(titleScreen);
}

function startQuiz() {
  currentQuestionIndex = 0;
  correctCount = 0;
  showQuestion();
}

function showQuestion() {
  const quiz = quizData[currentQuestionIndex];

  answered = false;
  showOnlyPreviewScreen(quizScreen);
  questionNumber.textContent = "第" + (currentQuestionIndex + 1) + "問 / 全3問";
  questionText.textContent = quiz.question;
  answerMessage.textContent = "";
  answerMessage.className = "answer-message";
  nextButton.classList.add("hidden");
  nextButton.textContent = currentQuestionIndex === quizData.length - 1 ? "結果を見る" : "次の問題へ";

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
    if (
      initialQuizSnapshot &&
      lastRunWork &&
      lastRunSourceCode === codeEditor.value &&
      lastRunWork.questions[currentQuestionIndex].correctIndex !== initialQuizSnapshot.questions[currentQuestionIndex].correctIndex
    ) {
      confirmedNewCorrect = true;
      updateLearningSupport();
    }
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
  showOnlyPreviewScreen(resultScreen);

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
  startQuiz();
}

function resetCode() {
  setEditorCode(INITIAL_CODE);
  applyCodeToPreview();
}

function initializeLearningState() {
  const initialParsed = parseLearnerCode(INITIAL_CODE);
  initialQuizSnapshot = cloneWorkData(initialParsed.work);
  lastValidQuizData = cloneWorkData(initialParsed.work);
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

function jumpEditorToStepFocus(parsed) {
  if (!parsed || editorWrap.classList.contains("is-composing")) {
    return;
  }
  const focusLines = getStepFocusLines(parsed, currentStep);
  if (focusLines.length === 0) {
    return;
  }
  const source = codeEditor.value;
  const targetLine = focusLines[0];
  const index = Math.max(0, Math.min(source.length, positionToIndex(source, targetLine, 1)));
  const lineHeight = parseFloat(window.getComputedStyle(codeEditor).lineHeight) || 21;
  codeEditor.scrollTop = Math.max(0, (targetLine - 1) * lineHeight);
  codeEditor.setSelectionRange(index, index);
  updateCursorStatus();
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
    tokenDetail.textContent = "カーソル位置の部品の意味がここに表示されます。";
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

codeEditor.addEventListener("input", function () {
  updateEditorView();
  handleEditorCaretForColorPicker();
});
codeEditor.addEventListener("scroll", syncEditorScroll);
codeEditor.addEventListener("keyup", function () {
  updateCursorStatus();
  handleEditorCaretForColorPicker();
});
codeEditor.addEventListener("click", function () {
  updateCursorStatus();
  handleEditorCaretForColorPicker();
});
codeEditor.addEventListener("select", function () {
  updateCursorStatus();
  handleEditorCaretForColorPicker();
});
codeEditor.addEventListener("compositionstart", function () {
  editorWrap.classList.add("is-composing");
});
codeEditor.addEventListener("compositionupdate", updateEditorView);
codeEditor.addEventListener("compositionend", function () {
  editorWrap.classList.remove("is-composing");
  updateEditorView();
});
document.addEventListener("selectionchange", function () {
  if (document.activeElement === codeEditor) {
    updateCursorStatus();
    handleEditorCaretForColorPicker();
  }
});
window.addEventListener("resize", function () {
  syncEditorOverlay();
  if (isColorPickerOpen()) {
    positionColorPickerForTarget();
  }
});
if (typeof ResizeObserver === "function") {
  new ResizeObserver(syncEditorOverlay).observe(codeEditor);
}
runButton.addEventListener("click", applyCodeToPreview);
resetCodeButton.addEventListener("click", resetCode);
colorPickerPopover.addEventListener("mousedown", function (event) {
  event.stopPropagation();
});
cpSv.addEventListener("mousedown", function (event) {
  startColorPickerDrag("sv", event);
});
cpHue.addEventListener("mousedown", function (event) {
  startColorPickerDrag("hue", event);
});
cpBarR.addEventListener("mousedown", function (event) {
  startColorPickerDrag("r", event);
});
cpBarG.addEventListener("mousedown", function (event) {
  startColorPickerDrag("g", event);
});
cpBarB.addEventListener("mousedown", function (event) {
  startColorPickerDrag("b", event);
});
document.addEventListener("mousemove", function (event) {
  if (colorPickerDrag) {
    applyColorPickerDrag(event);
  }
});
document.addEventListener("mouseup", function () {
  colorPickerDrag = null;
});
document.addEventListener("mousedown", function (event) {
  if (!isColorPickerOpen()) {
    return;
  }
  if (colorPickerPopover.contains(event.target) || event.target === codeEditor) {
    return;
  }
  closeColorPicker();
});
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && isColorPickerOpen()) {
    closeColorPicker();
  }
});
cpNumR.addEventListener("input", function () {
  handleRgbNumberInput("r", cpNumR);
});
cpNumG.addEventListener("input", function () {
  handleRgbNumberInput("g", cpNumG);
});
cpNumB.addEventListener("input", function () {
  handleRgbNumberInput("b", cpNumB);
});
cpNumR.addEventListener("blur", function () {
  handleRgbNumberBlur("r", cpNumR);
});
cpNumG.addEventListener("blur", function () {
  handleRgbNumberBlur("g", cpNumG);
});
cpNumB.addEventListener("blur", function () {
  handleRgbNumberBlur("b", cpNumB);
});
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

startButton.addEventListener("click", startQuiz);
nextButton.addEventListener("click", goToNextQuestion);
retryButton.addEventListener("click", startQuiz);
backToTitleButton.addEventListener("click", showTitleScreen);

initializeLearningState();
setGuideOpen(false);
appendConsole("info", "初期コードを読み込みました。変更できるのはタイトル・色・問題文・選択肢と正解番号だけです。");
setEditorCode(INITIAL_CODE);
applyCodeToPreview();
window.getLastValidQuizData = getLastValidQuizData;
window.generateStandaloneQuizHtmlForCurrentEditor = generateStandaloneQuizHtmlForCurrentEditor;
window.updateEditorView = updateEditorView;
window.updateCursorStatus = updateCursorStatus;
window.applyPickerToCode = applyPickerToCode;
window.applyPickerRgbToCode = applyPickerRgbToCode;
window.syncColorPickersFromCode = syncColorPickersFromCode;
window.openColorPicker = openColorPicker;
window.closeColorPicker = closeColorPicker;
window.positionColorPickerForTarget = positionColorPickerForTarget;
window.handleEditorCaretForColorPicker = handleEditorCaretForColorPicker;
window.findLearnerRgbLiteralAtOffset = findLearnerRgbLiteralAtOffset;
window.getSourceRangeClientRect = getSourceRangeClientRect;
window.getStepEvidence = getStepEvidence;
window.getColorPickerState = function () {
  return {
    open: isColorPickerOpen(),
    target: colorPickerTarget,
    r: colorPickerRgb.r,
    g: colorPickerRgb.g,
    b: colorPickerRgb.b,
    left: colorPickerPopover.style.left,
    top: colorPickerPopover.style.top
  };
};
window.getCurrentStepProgress = function (stepNumber) {
  let parsed = null;
  let parseError = null;
  try {
    parsed = parseLearnerCode(codeEditor.value);
  } catch (error) {
    parseError = error;
  }
  return evaluateStepProgress(parsed, stepNumber || currentStep, parseError, initialQuizSnapshot, getStepEvidence());
};
