// ==================================================
// 初期表示する教材用コードと限定パーサ
// 学習者はこの形式に沿って、許可された設定値だけを編集します。
// ==================================================

const studioCore = window.OwlJsStudioCore;
const INITIAL_CODE = studioCore.INITIAL_CODE;
const STEP_GUIDE = studioCore.STEP_GUIDE;
const parseLearnerCode = studioCore.parseLearnerCode;
const tokenize = studioCore.tokenize;
const tokenizeForDisplay = studioCore.tokenizeForDisplay;
const buildFuriganaModel = studioCore.buildFuriganaModel;
const getFuriganaRuby = studioCore.getFuriganaRuby;
const isCorrectIndexNumberToken = studioCore.isCorrectIndexNumberToken;
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
const getStepClearMessage = studioCore.getStepClearMessage;
const formatLearnerConsoleError = studioCore.formatLearnerConsoleError;
const createCodeError = studioCore.createCodeError;
const parseRgbLiteral = studioCore.parseRgbLiteral;
const formatRgbLiteral = studioCore.formatRgbLiteral;
const rgbToHex = studioCore.rgbToHex;
const hexToRgb = studioCore.hexToRgb;
const readConstStringLiteral = studioCore.readConstStringLiteral;
const replaceConstStringLiteral = studioCore.replaceConstStringLiteral;
const findLearnerRgbLiteralByName = studioCore.findLearnerRgbLiteralByName;
const findLearnerRgbLiteralAtOffset = studioCore.findLearnerRgbLiteralAtOffset;
const createCodeHistory = studioCore.createCodeHistory;
const createPreviewHistory = studioCore.createPreviewHistory;
const questionHasPairedStep5Edits = studioCore.questionHasPairedStep5Edits;

// ==================================================
// 画面要素
// ==================================================

const codeEditor = document.getElementById("code-editor");
const lineNumbers = document.getElementById("line-numbers");
const furiganaView = document.getElementById("furigana-view");
const highlightLayer = document.getElementById("highlight-layer");
const editorWrap = document.getElementById("editor-wrap");
const runButton = document.getElementById("run-button");
const undoButton = document.getElementById("undo-button");
const redoButton = document.getElementById("redo-button");
const resetCodeButton = document.getElementById("reset-code-button");
const resetDialog = document.getElementById("reset-dialog");
const resetCancelButton = document.getElementById("reset-cancel-button");
const resetConfirmButton = document.getElementById("reset-confirm-button");
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
const questionMeterFill = document.getElementById("question-meter-fill");
const questionText = document.getElementById("question-text");
const answerMessage = document.getElementById("answer-message");
const nextButton = document.getElementById("next-button");
const scoreText = document.getElementById("score-text");
const resultMessage = document.getElementById("result-message");
const retryButton = document.getElementById("retry-button");
const backToTitleButton = document.getElementById("back-to-title-button");
const previewRunState = document.getElementById("preview-run-state");
const previewProgress = document.getElementById("preview-progress");
const previewBackButton = document.getElementById("preview-back-button");
const previewForwardButton = document.getElementById("preview-forward-button");
const previewRestartButton = document.getElementById("preview-restart-button");
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
let answered = false;
const previewHistory = createPreviewHistory({ questionCount: 3 });
let lastValidQuizData = null;
let lastValidSourceCode = null;
let latestParsedSupportData = null;
let initialQuizSnapshot = null;
let currentStep = 1;
let consoleResizeState = null;
let guideIsOpen = false;
let applyingColorPicker = false;
let applyingHistory = false;
const editorHistory = createCodeHistory({ cap: 100 });
let historyCoalesceTimer = null;
const HISTORY_COALESCE_MS = 400;
let lastRunSourceCode = null;
let lastRunWork = null;
let confirmedNewCorrect = false;
let furiganaHasBeenOn = false;
let resetDialogLastFocus = null;
const announcedStepClears = {
  1: false,
  2: false,
  3: false,
  4: false,
  5: false
};
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

function captureEditorSnapshot() {
  return {
    value: codeEditor.value,
    start: codeEditor.selectionStart,
    end: codeEditor.selectionEnd,
    scrollTop: codeEditor.scrollTop
  };
}

function isEditorComposing() {
  return editorWrap.classList.contains("is-composing");
}

function clearHistoryCoalesceTimer() {
  if (historyCoalesceTimer !== null) {
    clearTimeout(historyCoalesceTimer);
    historyCoalesceTimer = null;
  }
}

function scheduleHistoryFlush() {
  clearHistoryCoalesceTimer();
  historyCoalesceTimer = setTimeout(function () {
    historyCoalesceTimer = null;
    editorHistory.flush();
  }, HISTORY_COALESCE_MS);
}

function syncHistoryButtons() {
  const canUndo = editorHistory.canUndo();
  const canRedo = editorHistory.canRedo();
  undoButton.disabled = canUndo === false;
  redoButton.disabled = canRedo === false;
}

function recordEditorHistory(kind) {
  if (applyingHistory || isEditorComposing()) {
    return;
  }
  editorHistory.record(captureEditorSnapshot(), kind);
  if (kind === "immediate") {
    clearHistoryCoalesceTimer();
    editorHistory.flush();
  } else {
    scheduleHistoryFlush();
  }
  syncHistoryButtons();
}

function applyEditorSnapshot(snap) {
  if (!snap) {
    return;
  }
  applyingHistory = true;
  codeEditor.value = snap.value;
  const max = codeEditor.value.length;
  const start = Math.max(0, Math.min(typeof snap.start === "number" ? snap.start : max, max));
  const end = Math.max(0, Math.min(typeof snap.end === "number" ? snap.end : start, max));
  codeEditor.setSelectionRange(start, end);
  if (typeof snap.scrollTop === "number") {
    codeEditor.scrollTop = Math.max(0, snap.scrollTop);
  }
  updateEditorView();
  syncEditorScroll();
  handleEditorCaretForColorPicker();
  applyingHistory = false;
  syncHistoryButtons();
  updatePreviewChrome();
}

function undoEditorHistory() {
  if (isEditorComposing() || editorHistory.canUndo() === false) {
    return;
  }
  clearHistoryCoalesceTimer();
  applyEditorSnapshot(editorHistory.undo(captureEditorSnapshot()));
}

function redoEditorHistory() {
  if (isEditorComposing() || editorHistory.canRedo() === false) {
    return;
  }
  clearHistoryCoalesceTimer();
  applyEditorSnapshot(editorHistory.redo(captureEditorSnapshot()));
}

function resetEditorHistoryBaseline() {
  clearHistoryCoalesceTimer();
  editorHistory.setBaseline(captureEditorSnapshot());
  syncHistoryButtons();
}

function undoRedoActionFromEvent(event) {
  if (!event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }
  const key = event.key;
  if (key === "z" || key === "Z") {
    return event.shiftKey ? "redo" : "undo";
  }
  if ((key === "y" || key === "Y") && event.shiftKey === false) {
    return "redo";
  }
  return null;
}

function setEditorCode(code) {
  codeEditor.value = code;
  updateEditorView();
  updatePreviewChrome();
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

function isFuriganaOn() {
  return furiganaToggle.checked === true;
}

function applyFuriganaMode() {
  const enabled = isFuriganaOn();
  const wasOn = editorWrap.classList.contains("furigana-on");
  editorWrap.classList.toggle("furigana-on", enabled);
  editorWrap.classList.toggle("furigana-off", enabled === false);
  furiganaToggleLabel.textContent = enabled ? "ふりがな ON" : "ふりがな OFF";
  codeEditor.readOnly = enabled;
  if (enabled) {
    furiganaHasBeenOn = true;
    closeColorPicker();
    furiganaView.hidden = false;
    furiganaView.removeAttribute("hidden");
    furiganaView.setAttribute("aria-hidden", "false");
    renderFuriganaView(codeEditor.value);
    if (wasOn === false) {
      announceNewlyCompletedSteps();
    }
  } else {
    furiganaView.hidden = true;
    furiganaView.setAttribute("hidden", "");
    furiganaView.setAttribute("aria-hidden", "true");
    clearChildren(furiganaView);
  }
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
  highlightLayer.scrollTop = codeEditor.scrollTop;
  highlightLayer.scrollLeft = codeEditor.scrollLeft;
  lineNumbers.scrollTop = codeEditor.scrollTop;
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
  upsertConsoleLine("run-success", "success", message);
  statusParse.textContent = "準備完了";
}

function showErrors(errors) {
  for (let i = 0; i < errors.length; i++) {
    appendConsole("error", formatLearnerConsoleError(errors[i], codeEditor.value));
  }
  statusParse.textContent = "エラーあり";
}

function consolePrefix(kind) {
  if (kind === "error") {
    return "[エラー]";
  }
  if (kind === "success") {
    return "[実行]";
  }
  if (kind === "notice") {
    return "[注意]";
  }
  return "[学習]";
}

function appendConsole(kind, message, role) {
  const line = document.createElement("div");
  line.className = "console-line console-" + kind;
  if (role) {
    line.setAttribute("data-console-role", role);
  }
  line.textContent = consolePrefix(kind) + " " + message;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
  return line;
}

function upsertConsoleLine(role, kind, message) {
  const existing = consoleOutput.querySelector('[data-console-role="' + role + '"]');
  if (existing) {
    existing.className = "console-line console-" + kind;
    existing.setAttribute("data-console-role", role);
    existing.textContent = consolePrefix(kind) + " " + message;
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
    return existing;
  }
  if (role === "run-notice") {
    const successLine = consoleOutput.querySelector('[data-console-role="run-success"]');
    if (successLine) {
      const line = document.createElement("div");
      line.className = "console-line console-" + kind;
      line.setAttribute("data-console-role", role);
      line.textContent = consolePrefix(kind) + " " + message;
      if (successLine.nextSibling) {
        consoleOutput.insertBefore(line, successLine.nextSibling);
      } else {
        consoleOutput.appendChild(line);
      }
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
      return line;
    }
  }
  return appendConsole(kind, message, role);
}

function removeConsoleRole(role) {
  const existing = consoleOutput.querySelector('[data-console-role="' + role + '"]');
  if (existing) {
    existing.parentNode.removeChild(existing);
  }
}

function removeConsoleByKind(kind) {
  const lines = consoleOutput.querySelectorAll(".console-" + kind);
  for (let i = 0; i < lines.length; i++) {
    lines[i].parentNode.removeChild(lines[i]);
  }
}

function clearConsole() {
  clearChildren(consoleOutput);
}

function announceNewlyCompletedSteps() {
  let parsed = null;
  let parseError = null;
  try {
    parsed = parseLearnerCode(codeEditor.value);
  } catch (error) {
    parseError = error;
  }
  for (let stepNumber = 1; stepNumber <= 5; stepNumber++) {
    const result = evaluateStepProgress(parsed, stepNumber, parseError, initialQuizSnapshot, getStepEvidence());
    if (result.done === true) {
      if (announcedStepClears[stepNumber] !== true) {
        announcedStepClears[stepNumber] = true;
        appendConsole("success", getStepClearMessage(stepNumber));
      }
    } else {
      announcedStepClears[stepNumber] = false;
    }
  }
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

  const lines = source.split("\n");
  const tokens = tokenizeForFurigana(source);
  const tokensByLine = groupTokensByLine(tokens);
  const focusLines = getStepFocusLines(latestParsedSupportData, currentStep);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineRow = document.createElement("div");
    lineRow.className = focusLines.indexOf(lineIndex + 1) !== -1 ? "hl-line hl-line-focus" : "hl-line";
    const lineTokens = tokensByLine[lineIndex + 1] || [];
    let column = 1;

    for (let i = 0; i < lineTokens.length; i++) {
      const token = lineTokens[i];
      if (token.column > column) {
        lineRow.appendChild(document.createTextNode(lines[lineIndex].slice(column - 1, token.column - 1)));
      }

      lineRow.appendChild(createHighlightTokenSpan(token, describeToken(token, tokens, token.index)));
      column = token.column + token.value.length;
    }

    if (column <= lines[lineIndex].length) {
      lineRow.appendChild(document.createTextNode(lines[lineIndex].slice(column - 1)));
    }

    highlightLayer.appendChild(lineRow);
  }

  if (isFuriganaOn()) {
    renderFuriganaView(source);
  }
}

function renderFuriganaView(source) {
  const model = buildFuriganaModel(source);
  const focusLines = getStepFocusLines(latestParsedSupportData, currentStep);
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < model.length; i++) {
    const line = model[i];
    const row = document.createElement("div");
    row.className = focusLines.indexOf(line.lineNumber) !== -1 ? "fg-row fg-row-focus" : "fg-row";

    const lineno = document.createElement("div");
    lineno.className = "fg-lineno";
    lineno.textContent = String(line.lineNumber);
    row.appendChild(lineno);

    const unitsWrap = document.createElement("div");
    unitsWrap.className = "fg-units";

    for (let u = 0; u < line.units.length; u++) {
      const unit = line.units[u];
      if (unit.kind === "space") {
        const space = document.createElement("span");
        space.className = "fg-space";
        space.textContent = unit.text;
        unitsWrap.appendChild(space);
      } else {
        const col = document.createElement("span");
        col.className = unit.ruby ? "fg-unit" : "fg-unit fg-unit-bare";
        col.setAttribute("data-token", unit.text);
        if (unit.ruby) {
          col.setAttribute("data-ruby", unit.ruby);
          const ruby = document.createElement("span");
          ruby.className = "fg-ruby";
          ruby.textContent = unit.ruby;
          col.appendChild(ruby);
        }
        const tok = document.createElement("span");
        tok.className = "fg-token token-" + getTokenClassName({ type: unit.type, value: unit.text });
        tok.textContent = unit.text;
        col.appendChild(tok);
        unitsWrap.appendChild(col);
      }
    }

    row.appendChild(unitsWrap);
    fragment.appendChild(row);
  }

  clearChildren(furiganaView);
  furiganaView.appendChild(fragment);
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
  const tokens = tokenizeForDisplay(source);
  for (let i = 0; i < tokens.length; i++) {
    tokens[i].index = i;
  }
  return tokens;
}

function getStepEvidence() {
  return {
    lastRunWork: lastRunWork,
    editorMatchesLastRun: lastRunSourceCode !== null && lastRunSourceCode === codeEditor.value,
    confirmedNewCorrect: confirmedNewCorrect === true,
    furiganaOn: isFuriganaOn(),
    furiganaHasBeenOn: furiganaHasBeenOn === true
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

function describeToken(token, tokens, tokenIndex) {
  const ruby = Array.isArray(tokens) ? getFuriganaRuby(tokens, tokenIndex) : null;

  if (token.type === "comment") {
    return {
      short: "メモ",
      detail: "この行はコメントです。プログラムとしては実行されない説明用のメモです。"
    };
  }

  if (token.type === "keyword") {
    if (token.value === "const") {
      return {
        short: ruby || "定数を作る",
        detail: "`const` は、名前を付けて値を用意するためのキーワードです。ここでは定数として扱います。"
      };
    }
    if (token.value === "if") {
      return {
        short: ruby || "もし",
        detail: "`if` は、条件が合うときだけ中の処理を行うためのキーワードです。"
      };
    }
    return {
      short: ruby || "そうでなければ",
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
    if (Array.isArray(tokens) && isCorrectIndexNumberToken(tokens, tokenIndex)) {
      return {
        short: ruby,
        detail: "`" + token.value + "` は正解の選択肢番号です。0が1番目、1が2番目、2が3番目です。"
      };
    }
    return {
      short: "数",
      detail: "`" + token.value + "` は数値です。RGBの光の量などにも使います。"
    };
  }

  if (token.type === "operator") {
    return {
      short: ruby || "等しい",
      detail: "`===` は、左と右が同じ値かどうかを比べる記号です。"
    };
  }

  return describePunctuation(token.value);
}

function describePunctuation(value) {
  const punctuationMeanings = {
    "=": {
      short: "代入する",
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
    resetPreviewSession();
    removeConsoleByKind("error");
    showSuccess("実行成功：クイズを更新しました。");
    if (parsed.contrastWarning) {
      upsertConsoleLine("run-notice", "notice", parsed.contrastWarning);
    } else {
      removeConsoleRole("run-notice");
    }
    updateLearningSupport();
    announceNewlyCompletedSteps();
  } catch (error) {
    removeConsoleByKind("error");
    if (error.messages) {
      showErrors(error.messages);
    } else {
      showErrors(["コードを確認してください。"]);
    }
    updatePreviewChrome();
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
  recordEditorHistory("picker");
  updatePreviewChrome();
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

function isPreviewRunFresh() {
  return lastRunSourceCode !== null && lastRunSourceCode === codeEditor.value;
}

function updatePreviewChrome() {
  const state = previewHistory.getState();
  let screenLabel = "タイトル";
  let progressLabel = "タイトル画面";
  if (state.screen === "result") {
    screenLabel = "結果";
    progressLabel = "結果";
  } else if (typeof state.screen === "number") {
    const questionNo = state.screen + 1;
    screenLabel = "問" + questionNo + "/3";
    progressLabel = answered ? questionNo + "/3 答え済み" : "第" + questionNo + "問";
  }
  if (previewRunState) {
    previewRunState.textContent = isPreviewRunFresh() ? "実行済 · " + screenLabel : "未実行";
  }
  if (previewProgress) {
    previewProgress.textContent = progressLabel;
  }
  updatePreviewNavButtons(state);
}

function updatePreviewNavButtons(state) {
  const nav = state || previewHistory.getState();
  if (previewBackButton) {
    previewBackButton.disabled = nav.canBack === false;
  }
  if (previewForwardButton) {
    previewForwardButton.disabled = nav.canForward === false;
  }
  if (previewRestartButton) {
    previewRestartButton.disabled = nav.canRestart === false;
  }
}

function getPreviewCorrectIndexes() {
  const indexes = [];
  for (let i = 0; i < quizData.length; i++) {
    indexes.push(quizData[i].correctIndex);
  }
  return indexes;
}

function restoreCurrentPreviewScreen() {
  const screen = previewHistory.current();
  if (screen === "title") {
    renderTitleScreen();
    return;
  }
  if (screen === "result") {
    renderResultScreen();
    return;
  }
  currentQuestionIndex = screen;
  renderQuestionScreen();
}

function resetPreviewSession() {
  previewHistory.reset();
  restoreCurrentPreviewScreen();
}

function renderTitleScreen() {
  currentQuestionIndex = 0;
  answered = false;
  if (currentWork) {
    gameTitleLabel.textContent = currentWork.gameTitle;
  }
  quizTotalLabel.textContent = "全3問";
  showOnlyPreviewScreen(titleScreen);
  updatePreviewChrome();
}

function startQuiz() {
  previewHistory.navigateTo(0);
  restoreCurrentPreviewScreen();
}

function retryQuiz() {
  previewHistory.reset();
  previewHistory.navigateTo(0);
  restoreCurrentPreviewScreen();
}

function renderQuestionScreen() {
  const quiz = quizData[currentQuestionIndex];
  const saved = previewHistory.getAnswer(currentQuestionIndex);

  showOnlyPreviewScreen(quizScreen);
  questionNumber.textContent = "第" + (currentQuestionIndex + 1) + "問 / 全3問";
  if (questionMeterFill) {
    questionMeterFill.style.width = (((currentQuestionIndex + 1) / quizData.length) * 100) + "%";
  }
  questionText.textContent = quiz.question;
  nextButton.textContent = currentQuestionIndex === quizData.length - 1 ? "結果を見る" : "次の問題へ";

  for (let i = 0; i < choiceButtons.length; i++) {
    choiceButtons[i].textContent = quiz.choices[i];
    choiceButtons[i].disabled = false;
    choiceButtons[i].classList.remove("selected");
  }

  if (saved === null) {
    answered = false;
    answerMessage.textContent = "";
    answerMessage.className = "answer-message";
    nextButton.classList.add("hidden");
  } else {
    paintAnswer(saved);
  }
  updatePreviewChrome();
}

function paintAnswer(selectedIndex) {
  answered = true;
  for (let i = 0; i < choiceButtons.length; i++) {
    choiceButtons[i].classList.toggle("selected", i === selectedIndex);
    choiceButtons[i].disabled = false;
  }
  answerMessage.className = "answer-message";
  if (selectedIndex === quizData[currentQuestionIndex].correctIndex) {
    answerMessage.textContent = "正解！";
    answerMessage.classList.add("correct");
  } else {
    answerMessage.textContent = "不正解";
    answerMessage.classList.add("incorrect");
  }
  nextButton.classList.remove("hidden");
}

function maybeConfirmNewCorrect() {
  if (!initialQuizSnapshot || !lastRunWork || lastRunSourceCode !== codeEditor.value) {
    return;
  }
  if (typeof currentQuestionIndex !== "number") {
    return;
  }
  if (questionHasPairedStep5Edits(lastRunWork, initialQuizSnapshot, currentQuestionIndex) !== true) {
    return;
  }
  const selected = previewHistory.getAnswer(currentQuestionIndex);
  if (selected !== lastRunWork.questions[currentQuestionIndex].correctIndex) {
    return;
  }
  if (confirmedNewCorrect === true) {
    return;
  }
  confirmedNewCorrect = true;
  updateLearningSupport();
  announceNewlyCompletedSteps();
}

function checkAnswer(selectedIndex) {
  const previous = previewHistory.getAnswer(currentQuestionIndex);
  if (previous !== selectedIndex) {
    previewHistory.recordAnswer(currentQuestionIndex, selectedIndex);
    paintAnswer(selectedIndex);
  }
  maybeConfirmNewCorrect();
  updatePreviewChrome();
}

function goToNextQuestion() {
  if (previewHistory.getAnswer(currentQuestionIndex) === null) {
    return;
  }
  if (currentQuestionIndex < quizData.length - 1) {
    previewHistory.navigateTo(currentQuestionIndex + 1);
  } else {
    previewHistory.navigateTo("result");
  }
  restoreCurrentPreviewScreen();
}

function renderResultScreen() {
  const correctCount = previewHistory.score(getPreviewCorrectIndexes());
  showOnlyPreviewScreen(resultScreen);
  scoreText.textContent = correctCount + " / " + quizData.length;

  if (correctCount === quizData.length) {
    resultMessage.textContent = "全問正解です。すばらしい！";
  } else if (correctCount >= 2) {
    resultMessage.textContent = "よくできました。もう一度挑戦して満点を目指しましょう。";
  } else {
    resultMessage.textContent = "もう一度チャレンジして、JavaScriptに慣れていきましょう。";
  }
  updatePreviewChrome();
}

function previewGoBack() {
  if (previewHistory.getState().canBack === false) {
    return;
  }
  previewHistory.back();
  restoreCurrentPreviewScreen();
}

function previewGoForward() {
  if (previewHistory.getState().canForward === false) {
    return;
  }
  previewHistory.forward();
  restoreCurrentPreviewScreen();
}

function previewRestartFromTitle() {
  resetPreviewSession();
}

function isResetDialogOpen() {
  return resetDialog.hidden !== true && resetDialog.classList.contains("hidden") === false;
}

function openResetDialog() {
  if (isResetDialogOpen()) {
    resetCancelButton.focus();
    return;
  }
  resetDialogLastFocus = document.activeElement;
  resetDialog.hidden = false;
  resetDialog.removeAttribute("hidden");
  resetDialog.classList.remove("hidden");
  resetCancelButton.focus();
}

function closeResetDialog() {
  if (isResetDialogOpen() === false) {
    return;
  }
  resetDialog.hidden = true;
  resetDialog.setAttribute("hidden", "");
  resetDialog.classList.add("hidden");
  if (resetDialogLastFocus && typeof resetDialogLastFocus.focus === "function") {
    resetDialogLastFocus.focus();
  }
  resetDialogLastFocus = null;
}

function confirmResetCode() {
  closeResetDialog();
  resetCode();
}

function cancelResetCode() {
  closeResetDialog();
}

function handleResetDialogKeydown(event) {
  if (isResetDialogOpen() === false) {
    return false;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelResetCode();
    return true;
  }
  if (event.key !== "Tab") {
    return false;
  }
  const first = resetCancelButton;
  const last = resetConfirmButton;
  if (event.shiftKey) {
    if (document.activeElement === first || resetDialog.contains(document.activeElement) === false) {
      event.preventDefault();
      last.focus();
      return true;
    }
  } else if (document.activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function resetCode() {
  setEditorCode(INITIAL_CODE);
  resetEditorHistoryBaseline();
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
  let matchedIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const start = positionToIndex(source, token.line, token.column);
    const end = start + token.value.length;
    if (cursorIndex >= start && cursorIndex <= end) {
      matched = token;
      matchedIndex = i;
      break;
    }
    if (start > cursorIndex) {
      break;
    }
  }

  return {
    token: matched,
    tokens: tokens,
    index: matchedIndex
  };
}

function updateCursorStatus() {
  const source = codeEditor.value;
  const cursor = getCursorLineAndColumn(source, codeEditor.selectionStart);
  statusCursor.textContent = "Ln " + cursor.line + ", Col " + cursor.column;

  const found = findTokenAtCursor(source, codeEditor.selectionStart);
  if (found.token === null) {
    statusToken.textContent = "コードの意味";
    tokenDetail.textContent = "カーソル位置の部品の意味がここに表示されます。";
    return;
  }

  const meaning = describeToken(found.token, found.tokens, found.index);
  statusToken.textContent = found.token.value + " = " + meaning.short;
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

codeEditor.addEventListener("beforeinput", function (event) {
  if (event.isComposing || isEditorComposing()) {
    return;
  }
  if (event.inputType === "historyUndo") {
    event.preventDefault();
    undoEditorHistory();
  } else if (event.inputType === "historyRedo") {
    event.preventDefault();
    redoEditorHistory();
  }
});
codeEditor.addEventListener("input", function () {
  if (!isEditorComposing()) {
    recordEditorHistory("type");
  }
  updateEditorView();
  handleEditorCaretForColorPicker();
  updatePreviewChrome();
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
  recordEditorHistory("ime");
  clearHistoryCoalesceTimer();
  editorHistory.flush();
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
undoButton.addEventListener("click", undoEditorHistory);
redoButton.addEventListener("click", redoEditorHistory);
resetCodeButton.addEventListener("click", openResetDialog);
resetCancelButton.addEventListener("click", cancelResetCode);
resetConfirmButton.addEventListener("click", confirmResetCode);
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
  if (colorPickerDrag) {
    colorPickerDrag = null;
    clearHistoryCoalesceTimer();
    editorHistory.flush();
    syncHistoryButtons();
    return;
  }
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
  if (handleResetDialogKeydown(event)) {
    return;
  }
  if (event.key === "Escape" && isColorPickerOpen()) {
    closeColorPicker();
  }
  if (event.isComposing || event.keyCode === 229 || isEditorComposing()) {
    return;
  }
  if (isResetDialogOpen()) {
    return;
  }
  const historyAction = undoRedoActionFromEvent(event);
  if (historyAction === null) {
    return;
  }
  event.preventDefault();
  if (historyAction === "undo") {
    undoEditorHistory();
  } else {
    redoEditorHistory();
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
  clearHistoryCoalesceTimer();
  editorHistory.flush();
});
cpNumG.addEventListener("blur", function () {
  handleRgbNumberBlur("g", cpNumG);
  clearHistoryCoalesceTimer();
  editorHistory.flush();
});
cpNumB.addEventListener("blur", function () {
  handleRgbNumberBlur("b", cpNumB);
  clearHistoryCoalesceTimer();
  editorHistory.flush();
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
retryButton.addEventListener("click", retryQuiz);
backToTitleButton.addEventListener("click", previewRestartFromTitle);
previewBackButton.addEventListener("click", previewGoBack);
previewForwardButton.addEventListener("click", previewGoForward);
previewRestartButton.addEventListener("click", previewRestartFromTitle);

initializeLearningState();
setGuideOpen(false);
appendConsole("info", "初期コードを読み込みました。変更できるのはタイトル・色・問題文・選択肢と正解番号だけです。");
setEditorCode(INITIAL_CODE);
resetEditorHistoryBaseline();
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
window.undoEditorHistory = undoEditorHistory;
window.redoEditorHistory = redoEditorHistory;
window.recordEditorHistory = recordEditorHistory;
window.resetEditorHistoryBaseline = resetEditorHistoryBaseline;
window.flushEditorHistory = function () {
  clearHistoryCoalesceTimer();
  editorHistory.flush();
  syncHistoryButtons();
};
window.getEditorHistoryState = function () {
  return editorHistory.getState();
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
window.resetCode = resetCode;
window.openResetDialog = openResetDialog;
window.closeResetDialog = closeResetDialog;
window.confirmResetCode = confirmResetCode;
window.cancelResetCode = cancelResetCode;
window.isResetDialogOpen = isResetDialogOpen;
window.isFuriganaOn = isFuriganaOn;
window.buildFuriganaModel = buildFuriganaModel;
window.renderFuriganaView = renderFuriganaView;
window.updatePreviewChrome = updatePreviewChrome;
window.getPreviewHistoryState = function () {
  return previewHistory.getState();
};
window.previewGoBack = previewGoBack;
window.previewGoForward = previewGoForward;
window.previewRestartFromTitle = previewRestartFromTitle;
window.resetPreviewSession = resetPreviewSession;
