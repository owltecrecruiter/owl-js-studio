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
const backgroundColorPicker = document.getElementById("background-color-picker");
const textColorPicker = document.getElementById("text-color-picker");

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

function renderStepGuide(parsed, parseError) {
  renderStepButtons(parsed, parseError);

  const step = STEP_GUIDE[currentStep - 1];
  const result = evaluateStepProgress(parsed, currentStep, parseError, initialQuizSnapshot);
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
    const result = evaluateStepProgress(parsed, step.number, parseError, initialQuizSnapshot);
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
    currentWork = cloneWorkData(parsed.work);
    quizData = currentWork.questions;
    lastValidQuizData = cloneWorkData(parsed.work);
    lastValidSourceCode = codeEditor.value;
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

function applyPickerToCode(constName, hexValue) {
  const rgb = hexToRgb(hexValue);
  if (!rgb || Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) {
    return;
  }

  const literal = formatRgbLiteral(rgb.r, rgb.g, rgb.b);
  const replacement = replaceConstStringLiteral(codeEditor.value, constName, literal);
  if (replacement === null) {
    return;
  }

  const start = codeEditor.selectionStart;
  const end = codeEditor.selectionEnd;
  applyingColorPicker = true;
  codeEditor.value = replacement.source;
  codeEditor.setSelectionRange(
    mapIndexThroughReplacement(start, replacement),
    mapIndexThroughReplacement(end, replacement)
  );
  updateEditorView();
  applyingColorPicker = false;
}

function syncColorPickersFromCode() {
  if (applyingColorPicker) {
    return;
  }
  syncOneColorPicker("backgroundColor", backgroundColorPicker);
  syncOneColorPicker("textColor", textColorPicker);
}

function syncOneColorPicker(constName, picker) {
  if (!picker) {
    return;
  }
  const literal = readConstStringLiteral(codeEditor.value, constName);
  const rgb = literal ? parseRgbLiteral(literal) : null;
  if (rgb === null) {
    return;
  }
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  if (picker.value.toLowerCase() !== hex) {
    picker.value = hex;
  }
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

codeEditor.addEventListener("input", updateEditorView);
codeEditor.addEventListener("scroll", syncEditorScroll);
codeEditor.addEventListener("keyup", updateCursorStatus);
codeEditor.addEventListener("click", updateCursorStatus);
codeEditor.addEventListener("select", updateCursorStatus);
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
  }
});
window.addEventListener("resize", syncEditorOverlay);
if (typeof ResizeObserver === "function") {
  new ResizeObserver(syncEditorOverlay).observe(codeEditor);
}
runButton.addEventListener("click", applyCodeToPreview);
resetCodeButton.addEventListener("click", resetCode);
backgroundColorPicker.addEventListener("input", function () {
  applyPickerToCode("backgroundColor", backgroundColorPicker.value);
});
textColorPicker.addEventListener("input", function () {
  applyPickerToCode("textColor", textColorPicker.value);
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
window.syncColorPickersFromCode = syncColorPickersFromCode;
