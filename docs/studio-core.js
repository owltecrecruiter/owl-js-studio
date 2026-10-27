/*
 * OWL JS Studio v0.9.11
 * Limited learner parser, work-data validation, and standalone HTML generator.
 * No eval / new Function. Learners may only edit allowlisted setting values.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OwlJsStudioCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var WORK_LIMITS = Object.freeze({
    questionCount: 3,
    choiceCount: 3,
    maxGameTitleLength: 40,
    maxQuestionLength: 120,
    maxChoiceLength: 80
  });

  var COMPANY_NAME = "アウルテクノロジー";
  var COMPANY_URL = "https://owl-tec.co.jp/";
  var MAKER_CREDIT_POWERED = "Powered by";
  var MAKER_CREDIT_BRAND = "OWL Technology";

  var NAMED_COLORS = Object.freeze({
    white: "#ffffff",
    black: "#000000",
    navy: "#001f3f",
    blue: "#0074d9",
    skyblue: "#87ceeb",
    teal: "#39cccc",
    green: "#2ecc40",
    lime: "#01ff70",
    yellow: "#ffdc00",
    orange: "#ff851b",
    red: "#ff4136",
    maroon: "#85144b",
    purple: "#b10dc9",
    fuchsia: "#f012be",
    pink: "#ffc0cb",
    brown: "#8b4513",
    gray: "#aaaaaa",
    grey: "#aaaaaa",
    silver: "#dddddd"
  });

  var INITIAL_CODE = [
    "// クイズの設定",
    "const gameTitle = \"はじめての3択クイズ\";",
    "const backgroundColor = \"rgb(234, 243, 255)\";",
    "const textColor = \"rgb(31, 41, 55)\";",
    "",
    "// 第1問",
    "const question1 = \"JavaScriptで文字を画面に表示するときに使う命令はどれ？\";",
    "const choice1_1 = \"console.log\";",
    "const choice1_2 = \"style.color\";",
    "const choice1_3 = \"border-radius\";",
    "",
    "if (selectedIndex1 === 0) {",
    "  result1 = \"正解！\";",
    "} else {",
    "  result1 = \"不正解\";",
    "}",
    "",
    "// 第2問",
    "const question2 = \"変数を作るときに使うキーワードはどれ？\";",
    "const choice2_1 = \"let\";",
    "const choice2_2 = \"click\";",
    "const choice2_3 = \"window\";",
    "",
    "if (selectedIndex2 === 0) {",
    "  result2 = \"正解！\";",
    "} else {",
    "  result2 = \"不正解\";",
    "}",
    "",
    "// 第3問",
    "const question3 = \"条件によって処理を分けるときに使う書き方はどれ？\";",
    "const choice3_1 = \"if / else\";",
    "const choice3_2 = \"font-size\";",
    "const choice3_3 = \"padding\";",
    "",
    "if (selectedIndex3 === 0) {",
    "  result3 = \"正解！\";",
    "} else {",
    "  result3 = \"不正解\";",
    "}"
  ].join("\n");

  var STEP_GUIDE = [
    {
      number: 1,
      title: "STEP 1：プログラムを読む",
      description: "やること：ふりがなをONにして、コードを上から読みます。読むときはON、編集するときはOFFにします。変える場所：まだありません。手順：1) ふりがなON 2) 各単語の上の意味を見る（const=定数を作る、if=もし、else=そうでなければ）。確認：ふりがなONでコードが読めたらOK。コードは変えなくて大丈夫です。",
      hints: [
        "ふりがなONは読み取り専用です。コードを直すときはOFFに戻します。",
        "`const` は「定数を作る」、`if` は「もし」、`else` は「そうでなければ」です。意味は単語の真上に出ます。",
        "`gameTitle` や `question1` など、長い名前の上にも日本語の意味が付きます。"
      ]
    },
    {
      number: 2,
      title: "STEP 2：タイトルを変える",
      description: "やること：ゲームのタイトル文字列だけを変えます。変える場所：`const gameTitle = \"...\";` の \" \" の中。手順：1) タイトルを書く 2) 実行する。確認：タイトル画面の見出しが変わればOK。このSTEPではタイトル以外のJavaScriptは変えません。",
      hints: [
        "変えてよいのは `gameTitle` の `\"` と `\"` の間だけです。",
        "最後の `;` は消さずに残します。",
        "実行すると、問題ではなくタイトル画面の文字が変わります。"
      ]
    },
    {
      number: 3,
      title: "STEP 3：背景色と文字色を変える",
      description: "やること：背景色と文字色を、赤・緑・青の3つの数（RGB）で変えます。変える場所：`backgroundColor` と `textColor` の `rgb(赤, 緑, 青)`。手順：1) 0〜255の整数をコードに書く、または RGBの数字をクリックすると色を選べます 2) 色パレットで色とRGB数値を選ぶ 3) 実行する 4) タイトル画面と問題画面の両方を見る。確認：両方に同じ色が付いていればOK。パレットはコード編集の補助です。プレビューの色は実行後に変わります。読みにくい色なら警告が出ます。",
      hints: [
        "`rgb(234, 243, 255)` は、赤234・緑243・青255 の光の混ぜ方です。どれも 0（光なし）〜255（最大）の整数だけ使えます。",
        "RGBの数字をクリックすると色を選べます。同じ `rgb(...)` をコードに書き込む補助です。パレット上のRGB数値も直接編集できます。学習コードでは HTMLやCSS、`#eaf3ff` のような16進数は使いません。",
        "実行後は「はじめる」で問題画面へ進み、色がタイトルと同じかも確認しましょう。"
      ]
    },
    {
      number: 4,
      title: "STEP 4：問題文を変える",
      description: "やること：3問の問題文を自分のクイズにします。変える場所：`question1` `question2` `question3` の \" \" の中。手順：1) 3問とも書き換える 2) 実行する。確認：タイトル画面から始めて、第1問〜第3問の文が自分の内容になっていればOK。問題の数は3問のままです。",
      hints: [
        "4問目は追加できません。`question4` は使えません。",
        "答えが3つの選択肢から選べる文にすると作りやすいです。",
        "問題文だけ先に変えて、選択肢は次のSTEPで整えましょう。"
      ]
    },
    {
      number: 5,
      title: "STEP 5：選択肢と正解を変える",
      description: "やること：同じ問題で、選択肢の文字と正解番号の両方を変えます。変える場所：例）`choice1_1` と `selectedIndex1 === 0` の右側の番号。番号は 0始まりです（0=1番目、1=2番目、2=3番目）。手順：1) どれか1問の選択肢を変える 2) 同じ問題の正解番号を別の 0/1/2 に変える 3) 実行する 4) その問題で新しい正解を選ぶ 5) 「正解！」と出ればこのSTEPはクリアです。",
      hints: [
        "第1問なら `choice1_1` などと `selectedIndex1`、第2問なら `choice2_1` と `selectedIndex2` のように、同じ問題の両方を変えます。別の問題の変更を組み合わせてもクリアになりません。",
        "正解番号は 0が1番目、1が2番目、2が3番目です。1始まり（1,2,3）では書けません。",
        "実行したあと、変更した問題で新しい正解を押して「正解！」が出るまで、このSTEPはクリアになりません。"
      ]
    }
  ];

  var STEP_FOCUS_NAMES = {
    1: [],
    2: ["gameTitle"],
    3: ["backgroundColor", "textColor"],
    4: ["question1", "question2", "question3"],
    5: [
      "choice1_1", "choice1_2", "choice1_3",
      "choice2_1", "choice2_2", "choice2_3",
      "choice3_1", "choice3_2", "choice3_3"
    ]
  };

  function tokenize(source) {
    var tokens = [];
    var index = 0;
    var line = 1;
    var column = 1;

    while (index < source.length) {
      var char = source[index];
      var next = source[index + 1];

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
      var startLine = line;
      var startColumn = column;
      var value = "";
      advance("\"");

      while (index < source.length) {
        var current = source[index];
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
          var escaped = source[index + 1];
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
      var startLine = line;
      var startColumn = column;
      var value = "";
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
      var startLine = line;
      var startColumn = column;
      var value = "";
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

  function tokenizeForDisplay(source) {
    var text = typeof source === "string" ? source : "";
    var tokens = [];
    var index = 0;
    var line = 1;
    var column = 1;

    while (index < text.length) {
      var char = text[index];
      var next = text[index + 1];

      if (char === " " || char === "\t" || char === "\r") {
        advance(char);
      } else if (char === "\n") {
        advance(char);
      } else if (char === "/" && next === "/") {
        readRawUntilNewline("comment");
      } else if (char === "\"") {
        readDisplayString();
      } else if (isDigit(char)) {
        readRawWhile(isDigit, "number");
      } else if (isIdentifierStart(char)) {
        readDisplayIdentifier();
      } else if (char === "=" && text[index + 1] === "=" && text[index + 2] === "=") {
        pushToken("operator", "===", line, column);
        advance("=");
        advance("=");
        advance("=");
      } else if ("=;(){},".indexOf(char) !== -1) {
        pushToken("punctuation", char, line, column);
        advance(char);
      } else {
        pushToken("unknown", char, line, column);
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

    function readRawUntilNewline(type) {
      var startIndex = index;
      var startLine = line;
      var startColumn = column;
      while (index < text.length && text[index] !== "\n") {
        advance(text[index]);
      }
      pushToken(type, text.slice(startIndex, index), startLine, startColumn);
    }

    function readRawWhile(predicate, type) {
      var startIndex = index;
      var startLine = line;
      var startColumn = column;
      while (index < text.length && predicate(text[index])) {
        advance(text[index]);
      }
      pushToken(type, text.slice(startIndex, index), startLine, startColumn);
    }

    function readDisplayString() {
      var startIndex = index;
      var startLine = line;
      var startColumn = column;
      advance("\"");
      while (index < text.length) {
        var current = text[index];
        if (current === "\n") {
          break;
        }
        if (current === "\\" && index + 1 < text.length && text[index + 1] !== "\n") {
          advance(current);
          advance(text[index]);
        } else if (current === "\"") {
          advance(current);
          break;
        } else {
          advance(current);
        }
      }
      pushToken("string", text.slice(startIndex, index), startLine, startColumn);
    }

    function readDisplayIdentifier() {
      var startIndex = index;
      var startLine = line;
      var startColumn = column;
      while (index < text.length && isIdentifierPart(text[index])) {
        advance(text[index]);
      }
      var value = text.slice(startIndex, index);
      pushToken(value === "const" || value === "if" || value === "else" ? "keyword" : "identifier", value, startLine, startColumn);
    }
  }

  function isCorrectIndexNumberToken(tokens, index) {
    var token = tokens[index];
    var operator;
    var identifier;
    if (!token || token.type !== "number") {
      return false;
    }
    if (token.value !== "0" && token.value !== "1" && token.value !== "2") {
      return false;
    }
    operator = tokens[index - 1];
    identifier = tokens[index - 2];
    return !!(
      operator &&
      operator.type === "operator" &&
      operator.value === "===" &&
      identifier &&
      identifier.type === "identifier" &&
      /^selectedIndex[123]$/.test(identifier.value)
    );
  }

  function getFuriganaRuby(tokens, index) {
    var token = tokens[index];
    var ident;
    if (!token) {
      return null;
    }
    if (token.type === "keyword") {
      if (token.value === "const") {
        return "定数を作る";
      }
      if (token.value === "if") {
        return "もし";
      }
      if (token.value === "else") {
        return "そうでなければ";
      }
      return null;
    }
    if (token.type === "operator" && token.value === "===") {
      return "等しい";
    }
    if (token.type === "punctuation" && token.value === "=") {
      return "代入する";
    }
    if (token.type === "number") {
      if (isCorrectIndexNumberToken(tokens, index) !== true) {
        return null;
      }
      if (token.value === "0") {
        return "1番目";
      }
      if (token.value === "1") {
        return "2番目";
      }
      return "3番目";
    }
    if (token.type !== "identifier") {
      return null;
    }
    ident = describeIdentifier(token.value);
    if (token.value === "gameTitle" || token.value === "backgroundColor" || token.value === "textColor") {
      return ident.short;
    }
    if (/^question[123]$/.test(token.value) || /^choice[123]_[123]$/.test(token.value) || /^selectedIndex[123]$/.test(token.value) || /^result[123]$/.test(token.value)) {
      return ident.short;
    }
    return null;
  }

  function buildFuriganaModel(source) {
    var text = typeof source === "string" ? source : "";
    var lines = text.split("\n");
    var tokens = tokenizeForDisplay(text);
    var result = [];
    var tokenIndex = 0;
    var i;

    for (i = 0; i < lines.length; i++) {
      var lineNumber = i + 1;
      var lineText = lines[i];
      var units = [];
      var column = 1;

      while (tokenIndex < tokens.length && tokens[tokenIndex].line === lineNumber) {
        var token = tokens[tokenIndex];
        if (token.column > column) {
          units.push({
            kind: "space",
            text: lineText.slice(column - 1, token.column - 1)
          });
        }
        units.push({
          kind: "token",
          text: token.value,
          type: token.type,
          ruby: getFuriganaRuby(tokens, tokenIndex)
        });
        column = token.column + token.value.length;
        tokenIndex = tokenIndex + 1;
      }

      if (column <= lineText.length) {
        units.push({
          kind: "space",
          text: lineText.slice(column - 1)
        });
      }

      result.push({
        lineNumber: lineNumber,
        units: units
      });
    }

    return result;
  }

  function parseLearnerCode(source) {
    var tokens = tokenize(source);
    var parser = createParser(tokens);
    return parser.parseProgram();
  }

  function createParser(tokens) {
    var position = 0;
    var values = {};
    var correctIndexes = {};
    var declarations = [];
    var conditions = [];

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
          var token = peek();
          throw tokenError(token, "`const` または `if` から書き始めてください。");
        }
      }
      return buildQuizData();
    }

    function parseConstDeclaration() {
      var constToken = consume("keyword", "const", "`const` から始めてください。");
      var nameToken = consume("identifier", null, "`const` の後に変数名が必要です。");
      consume("punctuation", "=", "変数名の後に `=` が必要です。");
      var valueToken = consume("string", null, "設定値・問題文・選択肢は `\"` で囲んだ文字列にしてください。");
      consume("punctuation", ";", "行の終わりに `;` が必要です。");

      if (!isAllowedConstName(nameToken.value)) {
        throw tokenError(nameToken, "この変数名は使えません。`gameTitle` / `backgroundColor` / `textColor` / `question1` / `choice1_1` の形で書いてください。");
      }
      if (Object.prototype.hasOwnProperty.call(values, nameToken.value)) {
        throw tokenError(nameToken, "`" + nameToken.value + "` が2回書かれています。1回だけ書いてください。");
      }
      values[nameToken.value] = valueToken.value;
      declarations.push(createDeclarationMetadata(nameToken.value, valueToken.value, constToken.line));
    }

    function parseIfStatement() {
      var ifToken = consume("keyword", "if", "`if` から始めてください。");
      consume("punctuation", "(", "`if` の後に `(` が必要です。");
      var selectedToken = consume("identifier", null, "`if` の条件に `selectedIndex1` のような名前が必要です。");
      consume("operator", "===", "比較には `===` を使ってください。");
      var numberToken = consume("number", null, "正解番号は0、1、2のいずれかです。");
      consume("punctuation", ")", "`if` の条件の後に `)` が必要です。");
      consume("punctuation", "{", "`if` の条件の後に `{` が必要です。");
      var successResultToken = consume("identifier", null, "`result1` のような結果用の名前が必要です。");
      consume("punctuation", "=", "`result` の後に `=` が必要です。");
      var successTextToken = consume("string", null, "`正解！` を文字列で書いてください。");
      consume("punctuation", ";", "行の終わりに `;` が必要です。");
      consume("punctuation", "}", "`if` の処理の終わりに `}` が必要です。");
      consume("keyword", "else", "`if` の後に `else` が必要です。");
      consume("punctuation", "{", "`else` の後に `{` が必要です。");
      var failureResultToken = consume("identifier", null, "`result1` のような結果用の名前が必要です。");
      consume("punctuation", "=", "`result` の後に `=` が必要です。");
      var failureTextToken = consume("string", null, "`不正解` を文字列で書いてください。");
      consume("punctuation", ";", "行の終わりに `;` が必要です。");
      consume("punctuation", "}", "`else` の処理の終わりに `}` が必要です。");

      var selectedMatch = selectedToken.value.match(/^selectedIndex([123])$/);
      if (selectedMatch === null) {
        throw tokenError(selectedToken, "`if` の条件は `selectedIndex1`、`selectedIndex2`、`selectedIndex3` のどれかを使ってください。");
      }

      var questionNumber = selectedMatch[1];
      var expectedResultName = "result" + questionNumber;
      if (successResultToken.value !== expectedResultName || failureResultToken.value !== expectedResultName) {
        throw tokenError(successResultToken, "第" + questionNumber + "問のif文では `" + expectedResultName + "` を使ってください。");
      }
      if (successTextToken.value !== "正解！") {
        throw tokenError(successTextToken, "正解のときは `result" + questionNumber + " = \"正解！\";` と書いてください。");
      }
      if (failureTextToken.value !== "不正解") {
        throw tokenError(failureTextToken, "不正解のときは `result" + questionNumber + " = \"不正解\";` と書いてください。");
      }

      var correctIndex = Number(numberToken.value);
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
      var errors = [];
      var questions = [];
      var requiredSettings = ["gameTitle", "backgroundColor", "textColor"];
      var i;

      for (i = 0; i < requiredSettings.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(values, requiredSettings[i])) {
          errors.push("`" + requiredSettings[i] + "` がありません。");
        } else if (String(values[requiredSettings[i]]).trim() === "") {
          errors.push("`" + requiredSettings[i] + "` が空です。文字を入れてください。");
        }
      }

      if (Object.prototype.hasOwnProperty.call(values, "gameTitle") && values.gameTitle.trim().length > WORK_LIMITS.maxGameTitleLength) {
        errors.push("`gameTitle` は" + WORK_LIMITS.maxGameTitleLength + "文字以内にしてください。");
      }

      var backgroundColor = null;
      var textColor = null;
      try {
        if (values.backgroundColor) {
          backgroundColor = normalizeLearnerColor(values.backgroundColor, "backgroundColor");
        }
      } catch (backgroundError) {
        errors.push(backgroundError.message);
      }
      try {
        if (values.textColor) {
          textColor = normalizeLearnerColor(values.textColor, "textColor");
        }
      } catch (textColorError) {
        errors.push(textColorError.message);
      }

      for (var questionIndex = 1; questionIndex <= WORK_LIMITS.questionCount; questionIndex++) {
        var questionKey = "question" + questionIndex;
        var choice1Key = "choice" + questionIndex + "_1";
        var choice2Key = "choice" + questionIndex + "_2";
        var choice3Key = "choice" + questionIndex + "_3";
        var keys = [questionKey, choice1Key, choice2Key, choice3Key];

        for (i = 0; i < keys.length; i++) {
          if (!Object.prototype.hasOwnProperty.call(values, keys[i])) {
            errors.push("第" + questionIndex + "問の `" + keys[i] + "` がありません。");
          } else if (values[keys[i]].trim() === "") {
            errors.push("第" + questionIndex + "問の `" + keys[i] + "` が空です。文字を入れてください。");
          }
        }

        if (values[questionKey] && values[questionKey].length > WORK_LIMITS.maxQuestionLength) {
          errors.push("第" + questionIndex + "問の問題文は" + WORK_LIMITS.maxQuestionLength + "文字以内にしてください。");
        }
        if (values[choice1Key] && values[choice1Key].length > WORK_LIMITS.maxChoiceLength) {
          errors.push("第" + questionIndex + "問の選択肢1は" + WORK_LIMITS.maxChoiceLength + "文字以内にしてください。");
        }
        if (values[choice2Key] && values[choice2Key].length > WORK_LIMITS.maxChoiceLength) {
          errors.push("第" + questionIndex + "問の選択肢2は" + WORK_LIMITS.maxChoiceLength + "文字以内にしてください。");
        }
        if (values[choice3Key] && values[choice3Key].length > WORK_LIMITS.maxChoiceLength) {
          errors.push("第" + questionIndex + "問の選択肢3は" + WORK_LIMITS.maxChoiceLength + "文字以内にしてください。");
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
        var error = createCodeError(errors[0]);
        error.messages = errors;
        throw error;
      }

      var work = {
        gameTitle: values.gameTitle.trim(),
        backgroundColor: backgroundColor,
        textColor: textColor,
        questions: questions
      };
      var contrast = getContrastWarning(work.backgroundColor, work.textColor);

      return {
        work: work,
        questions: questions,
        declarations: declarations.slice(),
        conditions: conditions.slice(),
        contrastWarning: contrast,
        readingLines: buildReadingLines(declarations, conditions),
        explanations: buildExplanations(declarations, conditions),
        tokens: tokens.filter(function (token) {
          return token.type !== "eof";
        })
      };
    }

    function consume(type, value, message) {
      if (check(type, value)) {
        return advanceParser();
      }
      throw tokenError(peek(), message);
    }

    function check(type, value) {
      if (isAtEnd()) {
        return false;
      }
      var token = peek();
      if (token.type !== type) {
        return false;
      }
      return value === null || token.value === value;
    }

    function advanceParser() {
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
    if (name === "gameTitle" || name === "backgroundColor" || name === "textColor") {
      return {
        type: "setting",
        line: line,
        name: name,
        value: value
      };
    }

    var questionMatch = name.match(/^question([123])$/);
    if (questionMatch !== null) {
      return {
        type: "question",
        line: line,
        name: name,
        value: value,
        questionNumber: Number(questionMatch[1])
      };
    }

    var choiceMatch = name.match(/^choice([123])_([123])$/);
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
    var items = [];
    var i;
    for (i = 0; i < declarations.length; i++) {
      var declaration = declarations[i];
      if (declaration.type === "setting") {
        items.push({
          line: declaration.line,
          text: settingReadingText(declaration)
        });
      } else if (declaration.type === "question") {
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
    for (i = 0; i < conditions.length; i++) {
      var condition = conditions[i];
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

  function settingReadingText(declaration) {
    if (declaration.name === "gameTitle") {
      return "ゲームのタイトルとして、文字列『" + declaration.value + "』を定義する。";
    }
    if (declaration.name === "backgroundColor") {
      return "背景色として、文字列『" + declaration.value + "』を定義する。";
    }
    return "文字色として、文字列『" + declaration.value + "』を定義する。";
  }

  function buildExplanations(declarations, conditions) {
    return {
      declarationCount: declarations.length,
      conditionCount: conditions.length
    };
  }

  function isAllowedConstName(name) {
    return name === "gameTitle" ||
      name === "backgroundColor" ||
      name === "textColor" ||
      /^question[123]$/.test(name) ||
      /^choice[123]_[123]$/.test(name);
  }

  function tokenError(token, message) {
    return createCodeError("行" + token.line + "列" + token.column + "：" + message);
  }

  function createCodeError(message) {
    var error = new Error(message);
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

  function namedColorNames() {
    return Object.keys(NAMED_COLORS).filter(function (name) {
      return name !== "grey";
    }).join(" / ");
  }

  function parseRgbLiteral(value) {
    if (typeof value !== "string") {
      return null;
    }
    var match = value.trim().match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
    if (match === null) {
      return null;
    }
    var r = Number(match[1]);
    var g = Number(match[2]);
    var b = Number(match[3]);
    if (String(r) !== match[1] || String(g) !== match[2] || String(b) !== match[3]) {
      return null;
    }
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      return null;
    }
    return {
      r: r,
      g: g,
      b: b
    };
  }

  function formatRgbLiteral(r, g, b) {
    return "rgb(" + r + ", " + g + ", " + b + ")";
  }

  function toHex2(channel) {
    var hex = channel.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return "#" + toHex2(r) + toHex2(g) + toHex2(b);
  }

  function normalizeLearnerColor(value, label) {
    var rgb = parseRgbLiteral(value);
    if (rgb === null) {
      throw createCodeError("`" + label + "` は `rgb(234, 243, 255)` のように、0〜255の整数3つで書いてください。");
    }
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function findConstStringSpan(source, name) {
    if (typeof source !== "string" || typeof name !== "string") {
      return null;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return null;
    }
    var pattern = new RegExp("const\\s+" + name + "\\s*=\\s*\"");
    var match = pattern.exec(source);
    if (match === null) {
      return null;
    }
    var valueStart = match.index + match[0].length;
    var index = valueStart;
    while (index < source.length) {
      var current = source[index];
      if (current === "\\") {
        index = index + 2;
        continue;
      }
      if (current === "\"") {
        return {
          matchStart: match.index,
          valueStart: valueStart,
          valueEnd: index,
          quoteEnd: index + 1
        };
      }
      if (current === "\n") {
        return null;
      }
      index = index + 1;
    }
    return null;
  }

  function readConstStringLiteral(source, name) {
    var span = findConstStringSpan(source, name);
    if (span === null) {
      return null;
    }
    return source.slice(span.valueStart, span.valueEnd);
  }

  function findLearnerRgbLiteralByName(source, name) {
    if (name !== "backgroundColor" && name !== "textColor") {
      return null;
    }
    var span = findConstStringSpan(source, name);
    if (span === null) {
      return null;
    }
    var literal = source.slice(span.valueStart, span.valueEnd);
    var rgb = parseRgbLiteral(literal);
    if (rgb === null) {
      return null;
    }
    return {
      name: name,
      literal: literal,
      rgb: rgb,
      valueStart: span.valueStart,
      valueEnd: span.valueEnd
    };
  }

  function findLearnerRgbLiteralAtOffset(source, offset) {
    if (typeof source !== "string" || typeof offset !== "number" || !isFinite(offset)) {
      return null;
    }
    var names = ["backgroundColor", "textColor"];
    var i;
    for (i = 0; i < names.length; i++) {
      var hit = findLearnerRgbLiteralByName(source, names[i]);
      if (hit && offset >= hit.valueStart && offset <= hit.valueEnd) {
        return hit;
      }
    }
    return null;
  }

  function replaceConstStringLiteral(source, name, nextValue) {
    if (typeof nextValue !== "string") {
      return null;
    }
    if (nextValue.indexOf("\"") !== -1 || nextValue.indexOf("\\") !== -1 || nextValue.indexOf("\n") !== -1) {
      return null;
    }
    var span = findConstStringSpan(source, name);
    if (span === null) {
      return null;
    }
    return {
      source: source.slice(0, span.valueStart) + nextValue + source.slice(span.valueEnd),
      valueStart: span.valueStart,
      oldEnd: span.valueEnd,
      newEnd: span.valueStart + nextValue.length
    };
  }

  function createMakerCreditHtml() {
    return "<p class=\"maker-credit\">" +
      "<span class=\"maker-credit-powered\">" + escapeHtmlText(MAKER_CREDIT_POWERED) + "</span>" +
      "<a href=\"" + COMPANY_URL + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
      escapeHtmlText(MAKER_CREDIT_BRAND) + "</a></p>";
  }

  function getQuizSurfaceCss() {
    return [
      ".quiz-surface { width: 100%; max-width: 480px; font-family: 'Yu Gothic', 'Meiryo', sans-serif; }",
      ".quiz-surface .screen { padding: 20px 18px 16px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14), inset 0 0 0 1px rgba(15, 23, 42, 0.18); }",
      ".quiz-surface .title-screen { text-align: center; }",
      ".quiz-surface .kicker { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; opacity: 0.72; }",
      ".quiz-surface .game-title { margin: 0 0 10px; font-size: 26px; line-height: 1.35; font-weight: 700; }",
      ".quiz-surface .quiz-total { margin: 0 0 18px; font-size: 13px; font-weight: 700; }",
      ".quiz-surface .question-number { display: inline-block; margin: 0 0 8px; padding: 3px 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; border: 1px solid currentColor; }",
      ".quiz-surface .question-meter { position: relative; height: 4px; margin: 0 0 14px; overflow: hidden; }",
      ".quiz-surface .question-meter::before { content: \"\"; position: absolute; inset: 0; background: currentColor; opacity: 0.18; }",
      ".quiz-surface .question-meter-fill { position: relative; display: block; height: 100%; width: 0; background: currentColor; opacity: 0.55; }",
      ".quiz-surface .question-text, .quiz-surface .result-heading { margin: 0 0 14px; font-size: 18px; line-height: 1.5; font-weight: 700; }",
      ".quiz-surface .choices { display: grid; gap: 8px; margin-bottom: 12px; }",
      ".quiz-surface button { font-family: inherit; font-weight: 700; cursor: pointer; }",
      ".quiz-surface .choice-button, .quiz-surface .main-button { width: 100%; color: inherit; background: transparent; border: 1px solid currentColor; }",
      ".quiz-surface .choice-button { padding: 11px 12px; font-size: 14px; text-align: left; }",
      ".quiz-surface .choice-button:hover:not(:disabled) { opacity: 0.88; }",
      ".quiz-surface .choice-button:disabled { cursor: not-allowed; opacity: 0.55; }",
      ".quiz-surface .choice-button.selected { outline: 2px solid currentColor; }",
      ".quiz-surface .choice-button.selected:disabled { opacity: 1; }",
      ".quiz-surface .main-button { padding: 12px 14px; font-size: 15px; }",
      ".quiz-surface .start-button { padding: 14px 16px; font-size: 16px; letter-spacing: 0.08em; border-width: 2px; }",
      ".quiz-surface .answer-message { min-height: 24px; margin: 0 0 12px; font-size: 15px; font-weight: 700; }",
      ".quiz-surface .correct { color: #14843c; }",
      ".quiz-surface .incorrect { color: #c0342b; }",
      ".quiz-surface .score-label { margin: 0 0 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; opacity: 0.72; }",
      ".quiz-surface .score-text { margin: 0 0 10px; font-size: 32px; font-weight: 700; line-height: 1.15; }",
      ".quiz-surface .result-message { margin: 0 0 16px; font-size: 14px; line-height: 1.6; }",
      ".quiz-surface .result-actions { display: grid; gap: 8px; }",
      ".quiz-surface .work-reference { margin: 16px 0 0; font-size: 12px; word-break: break-all; opacity: 0.8; }",
      ".quiz-surface .maker-credit { margin: 16px 0 0; font-size: 12px; font-weight: 400; line-height: 1.45; opacity: 0.78; }",
      ".quiz-surface .maker-credit-powered { display: block; font-size: 10px; letter-spacing: 0.08em; opacity: 0.82; }",
      ".quiz-surface .maker-credit a { color: inherit; text-decoration: none; font-weight: 600; }",
      ".quiz-surface .maker-credit a:hover { text-decoration: underline; }",
      ".quiz-surface .maker-credit a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }",
      ".quiz-surface .hidden { display: none; }"
    ].join("\n");
  }

  function getQuizPageCss() {
    return [
      "* { box-sizing: border-box; }",
      "body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: 'Yu Gothic', 'Meiryo', sans-serif; background: #d9e2ec; color: #1f2937; }",
      "main.quiz-surface { width: min(92vw, 520px); }"
    ].join("\n");
  }

  function getQuizSurfaceMarkup(options) {
    var config = options || {};
    var titleHeading = config.titleHeading || "h1";
    var questionHeading = config.questionHeading || "h2";
    var resultHeading = config.resultHeading || "h2";
    var includeReference = config.includeReference === true;
    return "    <section id=\"title-screen\" class=\"screen title-screen\">\n" +
      "      <p class=\"kicker\">3択クイズ</p>\n" +
      "      <" + titleHeading + " id=\"game-title\" class=\"game-title\"></" + titleHeading + ">\n" +
      "      <p id=\"quiz-total\" class=\"quiz-total\">全3問</p>\n" +
      "      <button id=\"start-button\" class=\"main-button start-button\" type=\"button\">はじめる</button>\n" +
      "      " + createMakerCreditHtml() + "\n" +
      "    </section>\n" +
      "    <section id=\"quiz-screen\" class=\"screen quiz-screen hidden\">\n" +
      "      <p id=\"question-number\" class=\"question-number\"></p>\n" +
      "      <div class=\"question-meter\" aria-hidden=\"true\"><span id=\"question-meter-fill\" class=\"question-meter-fill\"></span></div>\n" +
      "      <" + questionHeading + " id=\"question-text\" class=\"question-text\"></" + questionHeading + ">\n" +
      "      <div class=\"choices\">\n" +
      "        <button id=\"choice-0\" class=\"choice-button\" type=\"button\"></button>\n" +
      "        <button id=\"choice-1\" class=\"choice-button\" type=\"button\"></button>\n" +
      "        <button id=\"choice-2\" class=\"choice-button\" type=\"button\"></button>\n" +
      "      </div>\n" +
      "      <p id=\"answer-message\" class=\"answer-message\" aria-live=\"polite\"></p>\n" +
      "      <button id=\"next-button\" class=\"main-button hidden\" type=\"button\">次の問題へ</button>\n" +
      "    </section>\n" +
      "    <section id=\"result-screen\" class=\"screen result-screen hidden\">\n" +
      "      <p class=\"kicker\">結果発表</p>\n" +
      "      <" + resultHeading + " class=\"result-heading\">クイズ終了</" + resultHeading + ">\n" +
      "      <p class=\"score-label\">正解数</p>\n" +
      "      <p id=\"score-text\" class=\"score-text\"></p>\n" +
      "      <p id=\"result-message\" class=\"result-message\"></p>\n" +
      "      <div class=\"result-actions\">\n" +
      "        <button id=\"retry-button\" class=\"main-button\" type=\"button\">もう一度挑戦する</button>\n" +
      "        <button id=\"back-to-title-button\" class=\"main-button\" type=\"button\">タイトルへ戻る</button>\n" +
      "      </div>\n" +
      "    </section>\n" +
      (includeReference ? "    <p id=\"work-reference\" class=\"work-reference\"></p>\n" : "");
  }

  function normalizeColor(value, label) {
    if (typeof value !== "string") {
      throw createCodeError("`" + label + "` は文字列にしてください。");
    }
    var trimmed = value.trim();
    var rgb = parseRgbLiteral(trimmed);
    if (rgb !== null) {
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }
    if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, trimmed.toLowerCase()) && /^[A-Za-z]+$/.test(trimmed)) {
      return NAMED_COLORS[trimmed.toLowerCase()];
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return "#" + trimmed.slice(1).toLowerCase();
    }
    throw createCodeError("`" + label + "` は `#RRGGBB` か、" + namedColorNames() + " のいずれかにしてください。");
  }

  function isSafeCssColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/.test(value);
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function channelLuminance(channel) {
    var value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex);
    return (0.2126 * channelLuminance(rgb.r)) + (0.7152 * channelLuminance(rgb.g)) + (0.0722 * channelLuminance(rgb.b));
  }

  function contrastRatio(backgroundHex, textHex) {
    var backgroundLum = relativeLuminance(backgroundHex);
    var textLum = relativeLuminance(textHex);
    var light = Math.max(backgroundLum, textLum);
    var dark = Math.min(backgroundLum, textLum);
    return (light + 0.05) / (dark + 0.05);
  }

  function getContrastWarning(backgroundHex, textHex) {
    if (!isSafeCssColor(backgroundHex) || !isSafeCssColor(textHex)) {
      return null;
    }
    var ratio = contrastRatio(backgroundHex, textHex);
    if (ratio < 4.5) {
      return "注意：背景色と文字色が似ています。";
    }
    return null;
  }

  function getStepClearMessage(stepNumber) {
    return "STEP " + stepNumber + " クリア！";
  }

  function findIdentifierLineInSource(source, name) {
    if (typeof source !== "string" || typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return null;
    }
    var lines = source.split("\n");
    var pattern = new RegExp("(^|[^A-Za-z0-9_])" + name + "([^A-Za-z0-9_]|$)");
    var i;
    for (i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
    return null;
  }

  function formatLearnerConsoleError(message, source) {
    var text = String(message || "コードを確認してください。");
    if (/行\d+/.test(text)) {
      return text;
    }
    var sourceText = typeof source === "string" ? source : "";
    var namePattern = /`([A-Za-z_][A-Za-z0-9_]*)`/g;
    var match = namePattern.exec(text);
    while (match !== null) {
      var line = findIdentifierLineInSource(sourceText, match[1]);
      if (line !== null) {
        return "行" + line + "：" + text;
      }
      match = namePattern.exec(text);
    }
    return text;
  }

  function cloneQuestions(questions) {
    return questions.map(function (question) {
      return {
        question: question.question,
        choices: question.choices.slice(),
        correctIndex: question.correctIndex
      };
    });
  }

  function cloneWorkData(work) {
    return {
      gameTitle: work.gameTitle,
      backgroundColor: work.backgroundColor,
      textColor: work.textColor,
      questions: cloneQuestions(work.questions)
    };
  }

  function validateWorkData(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw createCodeError("作品データはタイトル・色・3問を含むオブジェクトである必要があります。");
    }
    assertExactKeys(data, ["gameTitle", "backgroundColor", "textColor", "questions"], "作品データ");

    var gameTitle = validateWorkString(data.gameTitle, "gameTitle", WORK_LIMITS.maxGameTitleLength);
    var backgroundColor = normalizeColor(data.backgroundColor, "backgroundColor");
    var textColor = normalizeColor(data.textColor, "textColor");
    if (!Array.isArray(data.questions) || data.questions.length !== WORK_LIMITS.questionCount) {
      throw createCodeError("クイズは3問だけです。");
    }

    var questions = [];
    for (var i = 0; i < data.questions.length; i++) {
      questions.push(validateQuestion(data.questions[i], i + 1));
    }

    return {
      gameTitle: gameTitle,
      backgroundColor: backgroundColor,
      textColor: textColor,
      questions: questions
    };
  }

  function validateQuestion(question, questionNumber) {
    if (question === null || typeof question !== "object" || Array.isArray(question)) {
      throw createCodeError("第" + questionNumber + "問のデータが正しくありません。");
    }
    assertExactKeys(question, ["question", "choices", "correctIndex"], "第" + questionNumber + "問");
    var questionText = validateWorkString(question.question, "第" + questionNumber + "問の問題文", WORK_LIMITS.maxQuestionLength);
    if (!Array.isArray(question.choices) || question.choices.length !== WORK_LIMITS.choiceCount) {
      throw createCodeError("第" + questionNumber + "問の選択肢は3つ必要です。");
    }
    var choices = [];
    for (var j = 0; j < question.choices.length; j++) {
      choices.push(validateWorkString(question.choices[j], "第" + questionNumber + "問の選択肢" + (j + 1), WORK_LIMITS.maxChoiceLength));
    }
    if (question.correctIndex !== 0 && question.correctIndex !== 1 && question.correctIndex !== 2) {
      throw createCodeError("第" + questionNumber + "問の正解番号が正しくありません。");
    }
    return {
      question: questionText,
      choices: choices,
      correctIndex: question.correctIndex
    };
  }

  function validateWorkString(value, label, maxLength) {
    if (typeof value !== "string") {
      throw createCodeError(label + "は文字列である必要があります。");
    }
    var normalized = value.trim();
    if (normalized.length === 0) {
      throw createCodeError(label + "は空にできません。");
    }
    if (normalized.length > maxLength) {
      throw createCodeError(label + "は" + maxLength + "文字以内にしてください。");
    }
    return normalized;
  }

  function assertExactKeys(object, expectedKeys, label) {
    var actual = Object.keys(object).sort();
    var expected = expectedKeys.slice().sort();
    if (actual.length !== expected.length) {
      throw createCodeError(label + "に余分または不足している項目があります。");
    }
    for (var i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        throw createCodeError(label + "に余分または不足している項目があります。");
      }
    }
  }

  function getStep5QuestionStates(work, initialWork) {
    var states = [];
    var i;
    var j;
    var choicesChanged;
    var answerChanged;
    for (i = 0; i < WORK_LIMITS.questionCount; i++) {
      choicesChanged = false;
      answerChanged = false;
      if (work && initialWork && work.questions && initialWork.questions && work.questions[i] && initialWork.questions[i]) {
        answerChanged = work.questions[i].correctIndex !== initialWork.questions[i].correctIndex;
        for (j = 0; j < WORK_LIMITS.choiceCount; j++) {
          if (work.questions[i].choices[j] !== initialWork.questions[i].choices[j]) {
            choicesChanged = true;
          }
        }
      }
      states.push({
        choicesChanged: choicesChanged,
        answerChanged: answerChanged,
        paired: choicesChanged === true && answerChanged === true
      });
    }
    return states;
  }

  function hasPairedStep5Question(work, initialWork) {
    var states = getStep5QuestionStates(work, initialWork);
    var i;
    for (i = 0; i < states.length; i++) {
      if (states[i].paired === true) {
        return true;
      }
    }
    return false;
  }

  function questionHasPairedStep5Edits(work, initialWork, questionIndex) {
    var states = getStep5QuestionStates(work, initialWork);
    return !!(states[questionIndex] && states[questionIndex].paired === true);
  }

  function getStep5ChangeSummary(work, initialWork) {
    var states = getStep5QuestionStates(work, initialWork);
    var changedChoices = 0;
    var changedAnswers = 0;
    var pairedQuestions = 0;
    var i;
    for (i = 0; i < states.length; i++) {
      if (states[i].choicesChanged) {
        changedChoices = changedChoices + 1;
      }
      if (states[i].answerChanged) {
        changedAnswers = changedAnswers + 1;
      }
      if (states[i].paired) {
        pairedQuestions = pairedQuestions + 1;
      }
    }
    return {
      changedChoices: changedChoices,
      changedAnswers: changedAnswers,
      pairedQuestions: pairedQuestions
    };
  }

  function evaluateStepProgress(parsedData, stepNumber, parseError, initialWork, evidence) {
    if (parsedData === null || parseError !== null) {
      return {
        done: false,
        message: "構文解析：未完了。エラーを直すと、このSTEPの達成状況を確認できます。"
      };
    }

    if (stepNumber === 1) {
      var step1Evidence = evidence || {};
      var furiganaSeen = step1Evidence.furiganaOn === true || step1Evidence.furiganaHasBeenOn === true;
      return {
        done: furiganaSeen,
        message: furiganaSeen
          ? "達成：ふりがなONでコードの意味を確認しました。編集するときはOFFにします。"
          : "未達成：ふりがなをONにして、各単語の上の意味を読みましょう。編集するときはOFFにします。"
      };
    }

    if (initialWork === null || initialWork === undefined) {
      return {
        done: false,
        message: "初期データを準備しています。"
      };
    }

    var work = parsedData.work;
    var i;

    if (stepNumber === 2) {
      var titleChanged = work.gameTitle !== initialWork.gameTitle;
      return {
        done: titleChanged,
        message: titleChanged
          ? "達成：ゲームのタイトルが変更されています。実行してタイトル画面を確認しましょう。"
          : "未達成：`gameTitle` の \" \" の中だけを初期値から変えて実行しましょう。"
      };
    }

    if (stepNumber === 3) {
      var colorChanged = work.backgroundColor !== initialWork.backgroundColor || work.textColor !== initialWork.textColor;
      return {
        done: colorChanged,
        message: colorChanged
          ? "達成：色の設定が変更されています。タイトル画面と問題画面の両方を確認しましょう。"
          : "未達成：`backgroundColor` と `textColor` を `rgb(赤, 緑, 青)` の整数3つに変えてみましょう。"
      };
    }

    if (stepNumber === 4) {
      var changedQuestions = 0;
      for (i = 0; i < WORK_LIMITS.questionCount; i++) {
        if (work.questions[i].question !== initialWork.questions[i].question) {
          changedQuestions = changedQuestions + 1;
        }
      }
      return {
        done: changedQuestions === WORK_LIMITS.questionCount,
        message: changedQuestions === WORK_LIMITS.questionCount
          ? "達成：3問の問題文が変更されています。実行してプレビューで確認しましょう。"
          : "未達成：`question1`〜`question3` の問題文を自分のクイズに変えましょう（変更済み " + changedQuestions + "/3）。"
      };
    }

    if (stepNumber !== 5) {
      return {
        done: false,
        message: "このSTEPの達成条件はありません。"
      };
    }

    var extra = evidence || {};
    var editorMatchesLastRun = extra.editorMatchesLastRun === true;
    var lastRunWork = extra.lastRunWork || null;
    var confirmedNewCorrect = extra.confirmedNewCorrect === true;
    var parsedChanges = getStep5ChangeSummary(work, initialWork);
    var parsedReady = hasPairedStep5Question(work, initialWork);
    var runReady = hasPairedStep5Question(lastRunWork, initialWork);

    if (parsedReady !== true) {
      return {
        done: false,
        message: "未達成：同じ問題で選択肢と正解番号の両方を変えましょう（選択肢を変えた問 " + parsedChanges.changedChoices + "、正解番号を変えた問 " + parsedChanges.changedAnswers + "、両方そろった問 " + parsedChanges.pairedQuestions + "）。番号は0が1番目・1が2番目・2が3番目です。"
      };
    }

    if (runReady !== true || editorMatchesLastRun !== true) {
      return {
        done: false,
        message: "未達成：同じ問題の選択肢と正解番号の変更を実行し、その問題で新しい正解（0=1番目、1=2番目、2=3番目）を選んで判定を確認しましょう。"
      };
    }

    if (confirmedNewCorrect !== true) {
      return {
        done: false,
        message: "未達成：実行済みです。変更した問題で新しい正解を選び、「正解！」と出るか確認しましょう。"
      };
    }

    return {
      done: true,
      message: "達成：選択肢と正解番号を変え、新しい正解で判定を確認しました。"
    };
  }

  function areAllStepsComplete(parsedData, parseError, initialWork, evidence) {
    var stepNumber;
    for (stepNumber = 1; stepNumber <= 5; stepNumber++) {
      if (evaluateStepProgress(parsedData, stepNumber, parseError, initialWork, evidence).done !== true) {
        return false;
      }
    }
    return true;
  }

  function formatIssuanceResultCopy(result) {
    var status = result && result.deliveryStatus ? String(result.deliveryStatus) : "";
    var copy = {
      title: "発行申請が完了しました",
      body: "完成したクイズの受け取り方法をご確認ください。",
      mailSent: status === "sent"
    };
    if (copy.mailSent === true) {
      copy.body = "完成したクイズの受け取り方法をご確認ください。メールを送信しました。";
    } else if (status === "failed") {
      copy.body = "完成したクイズの受け取り方法をご確認ください。配送に失敗したため、管理者に連絡してください。";
    }
    return copy;
  }

  function formatIssuanceErrorCopy(error) {
    var message = error && error.message ? String(error.message) : "発行できませんでした。時間をおいてもう一度お試しください。";
    if (message.indexOf("GAS bridge URL is not configured") !== -1) {
      return "発行サーバーに接続できません。管理者に連絡してください。";
    }
    if (message.indexOf("already in progress") !== -1) {
      return "発行申請を処理中です。完了するまでお待ちください。";
    }
    if (message.indexOf("timed out") !== -1) {
      return "発行サーバーからの応答がありません。時間をおいてもう一度お試しください。";
    }
    if (message.indexOf("No validated quiz data") !== -1 || message.indexOf("getLastValidQuizData() is unavailable") !== -1) {
      return "完成したクイズデータがありません。エラーを直してから発行してください。";
    }
    return message;
  }

  function getStepFocusLines(parsedData, stepNumber) {
    if (!parsedData) {
      return [];
    }
    var lines = [];
    var focusNames = STEP_FOCUS_NAMES[stepNumber] || [];
    var i;
    for (i = 0; i < parsedData.declarations.length; i++) {
      if (focusNames.indexOf(parsedData.declarations[i].name) !== -1) {
        lines.push(parsedData.declarations[i].line);
      }
    }
    if (stepNumber === 5) {
      for (i = 0; i < parsedData.conditions.length; i++) {
        lines.push(parsedData.conditions[i].line);
      }
    }
    return lines;
  }

  function describeIdentifier(value) {
    if (value === "gameTitle") {
      return {
        short: "ゲームタイトル",
        detail: "`gameTitle` は、タイトル画面に出すゲームの名前です。"
      };
    }
    if (value === "backgroundColor") {
      return {
        short: "背景色",
        detail: "`backgroundColor` は、タイトル画面と問題画面の背景色です。`rgb(赤, 緑, 青)` の 0〜255 の整数だけ使えます。"
      };
    }
    if (value === "textColor") {
      return {
        short: "文字色",
        detail: "`textColor` は、タイトル画面と問題画面の文字色です。`rgb(赤, 緑, 青)` の 0〜255 の整数だけ使えます。"
      };
    }

    var questionMatch = value.match(/^question([123])$/);
    if (questionMatch !== null) {
      return {
        short: "第" + questionMatch[1] + "問の問題文",
        detail: "`" + value + "` は、第" + questionMatch[1] + "問の問題文を入れる名前です。"
      };
    }
    var choiceMatch = value.match(/^choice([123])_([123])$/);
    if (choiceMatch !== null) {
      return {
        short: "第" + choiceMatch[1] + "問の選択肢" + choiceMatch[2],
        detail: "`" + value + "` は、第" + choiceMatch[1] + "問の" + choiceMatch[2] + "番目の選択肢を入れる名前です。"
      };
    }
    var selectedMatch = value.match(/^selectedIndex([123])$/);
    if (selectedMatch !== null) {
      return {
        short: "選んだ番号",
        detail: "`" + value + "` は、第" + selectedMatch[1] + "問で学習者が選んだ選択肢番号を表します。0が1番目です。"
      };
    }
    var resultMatch = value.match(/^result([123])$/);
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

  function createCodeHistory(options) {
    var settings = options || {};
    var cap = typeof settings.cap === "number" && settings.cap > 0 ? settings.cap : 100;
    var undoStack = [];
    var redoStack = [];
    var lastKnown = null;
    var lastKind = null;

    function cloneSnap(snap) {
      if (!snap) {
        return null;
      }
      return {
        value: String(snap.value),
        start: snap.start,
        end: snap.end,
        scrollTop: snap.scrollTop
      };
    }

    function setBaseline(snap) {
      undoStack.length = 0;
      redoStack.length = 0;
      lastKnown = cloneSnap(snap);
      lastKind = null;
    }

    function record(snap, kind) {
      var next = cloneSnap(snap);
      var recordKind = kind || "type";
      if (!lastKnown) {
        lastKnown = next;
        return;
      }
      if (lastKnown.value === next.value) {
        lastKnown = next;
        return;
      }
      var coalescing = lastKind !== null && lastKind === recordKind && recordKind !== "immediate";
      if (!coalescing) {
        undoStack.push(cloneSnap(lastKnown));
        if (undoStack.length > cap) {
          undoStack.shift();
        }
      }
      redoStack.length = 0;
      lastKnown = next;
      lastKind = recordKind === "immediate" ? null : recordKind;
    }

    function flush() {
      lastKind = null;
    }

    function undo(current) {
      flush();
      if (undoStack.length === 0) {
        return null;
      }
      redoStack.push(cloneSnap(current || lastKnown));
      lastKnown = undoStack.pop();
      return cloneSnap(lastKnown);
    }

    function redo(current) {
      flush();
      if (redoStack.length === 0) {
        return null;
      }
      undoStack.push(cloneSnap(current || lastKnown));
      lastKnown = redoStack.pop();
      return cloneSnap(lastKnown);
    }

    function canUndo() {
      return undoStack.length > 0;
    }

    function canRedo() {
      return redoStack.length > 0;
    }

    function getState() {
      return {
        undoCount: undoStack.length,
        redoCount: redoStack.length,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        lastKind: lastKind
      };
    }

    return {
      setBaseline: setBaseline,
      record: record,
      flush: flush,
      undo: undo,
      redo: redo,
      canUndo: canUndo,
      canRedo: canRedo,
      getState: getState
    };
  }

  function createPreviewHistory(options) {
    var settings = options || {};
    var questionCount = typeof settings.questionCount === "number" && settings.questionCount > 0
      ? settings.questionCount
      : 3;

    function emptyAnswers() {
      var list = [];
      var i;
      for (i = 0; i < questionCount; i++) {
        list.push(null);
      }
      return list;
    }

    var screens = ["title"];
    var index = 0;
    var answers = emptyAnswers();

    function cloneAnswers() {
      return answers.slice();
    }

    function cloneScreens() {
      return screens.slice();
    }

    function current() {
      return screens[index];
    }

    function hasAnyAnswer() {
      var i;
      for (i = 0; i < answers.length; i++) {
        if (answers[i] !== null) {
          return true;
        }
      }
      return false;
    }

    function snapshot() {
      return {
        screen: current(),
        index: index,
        screens: cloneScreens(),
        answers: cloneAnswers(),
        canBack: index > 0,
        canForward: index < screens.length - 1,
        canRestart: index !== 0 || screens.length > 1 || hasAnyAnswer()
      };
    }

    function reset() {
      screens = ["title"];
      index = 0;
      answers = emptyAnswers();
      return snapshot();
    }

    function back() {
      if (index > 0) {
        index = index - 1;
      }
      return snapshot();
    }

    function forward() {
      if (index < screens.length - 1) {
        index = index + 1;
      }
      return snapshot();
    }

    function navigateTo(screen) {
      if (index < screens.length - 1 && screens[index + 1] === screen) {
        index = index + 1;
        return snapshot();
      }
      screens = screens.slice(0, index + 1);
      screens.push(screen);
      index = screens.length - 1;
      return snapshot();
    }

    function recordAnswer(questionIndex, choice) {
      var previous = answers[questionIndex];
      var changed = previous !== null && previous !== choice;
      var i;
      answers[questionIndex] = choice;
      if (changed) {
        for (i = questionIndex + 1; i < questionCount; i++) {
          answers[i] = null;
        }
        screens = screens.slice(0, index + 1);
      }
      return {
        previous: previous,
        changed: changed,
        first: previous === null,
        snapshot: snapshot()
      };
    }

    function getAnswer(questionIndex) {
      return answers[questionIndex];
    }

    function score(correctIndexes) {
      var n = 0;
      var i;
      for (i = 0; i < questionCount; i++) {
        if (answers[i] !== null && correctIndexes && answers[i] === correctIndexes[i]) {
          n = n + 1;
        }
      }
      return n;
    }

    return {
      reset: reset,
      back: back,
      forward: forward,
      navigateTo: navigateTo,
      recordAnswer: recordAnswer,
      getAnswer: getAnswer,
      current: current,
      snapshot: snapshot,
      getState: snapshot,
      score: score
    };
  }

  function safeSerializeForInlineScript(value) {
    return JSON.stringify(value)
      .replace(/</g, "\\u003C")
      .replace(/>/g, "\\u003E")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function createStandaloneQuizHtml(workInput, options) {
    var work = validateWorkData(workInput);
    var config = options || {};
    var issuanceReference = config.issuanceReference || null;
    var pageTitle = config.pageTitle || work.gameTitle;
    var serializedWork = safeSerializeForInlineScript(work);
    var serializedReference = issuanceReference ? safeSerializeForInlineScript(issuanceReference) : "null";
    var backgroundColor = work.backgroundColor;
    var textColor = work.textColor;
    if (!isSafeCssColor(backgroundColor) || !isSafeCssColor(textColor)) {
      throw createCodeError("色の値が安全ではありません。");
    }

    return "<!DOCTYPE html>\n" +
      "<html lang=\"ja\">\n" +
      "<head>\n" +
      "  <meta charset=\"UTF-8\">\n" +
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
      "  <title>" + escapeHtmlText(pageTitle) + "</title>\n" +
      "  <style>\n" +
      getQuizPageCss() + "\n" +
      getQuizSurfaceCss() + "\n" +
      "  </style>\n" +
      "</head>\n" +
      "<body>\n" +
      "  <main class=\"quiz-surface\">\n" +
      getQuizSurfaceMarkup({ includeReference: !!issuanceReference }) +
      "  </main>\n" +
      "  <script>\n" +
      "    const work = " + serializedWork + ";\n" +
      "    const issuanceReference = " + serializedReference + ";\n" +
      "    const quizData = work.questions;\n" +
      "    let currentQuestionIndex = 0;\n" +
      "    let correctCount = 0;\n" +
      "    let answered = false;\n" +
      "    const titleScreen = document.getElementById('title-screen');\n" +
      "    const quizScreen = document.getElementById('quiz-screen');\n" +
      "    const resultScreen = document.getElementById('result-screen');\n" +
      "    const gameTitle = document.getElementById('game-title');\n" +
      "    const questionNumber = document.getElementById('question-number');\n" +
      "    const questionText = document.getElementById('question-text');\n" +
      "    const answerMessage = document.getElementById('answer-message');\n" +
      "    const nextButton = document.getElementById('next-button');\n" +
      "    const scoreText = document.getElementById('score-text');\n" +
      "    const resultMessage = document.getElementById('result-message');\n" +
      "    const startButton = document.getElementById('start-button');\n" +
      "    const retryButton = document.getElementById('retry-button');\n" +
      "    const backToTitleButton = document.getElementById('back-to-title-button');\n" +
      "    const questionMeterFill = document.getElementById('question-meter-fill');\n" +
      "    const choiceButtons = [document.getElementById('choice-0'), document.getElementById('choice-1'), document.getElementById('choice-2')];\n" +
      "    function applyTheme(node) {\n" +
      "      node.style.backgroundColor = work.backgroundColor;\n" +
      "      node.style.color = work.textColor;\n" +
      "    }\n" +
      "    function showOnly(target) {\n" +
      "      titleScreen.classList.toggle('hidden', target !== titleScreen);\n" +
      "      quizScreen.classList.toggle('hidden', target !== quizScreen);\n" +
      "      resultScreen.classList.toggle('hidden', target !== resultScreen);\n" +
      "    }\n" +
      "    function showTitle() {\n" +
      "      currentQuestionIndex = 0;\n" +
      "      correctCount = 0;\n" +
      "      answered = false;\n" +
      "      gameTitle.textContent = work.gameTitle;\n" +
      "      showOnly(titleScreen);\n" +
      "    }\n" +
      "    function startQuiz() {\n" +
      "      currentQuestionIndex = 0;\n" +
      "      correctCount = 0;\n" +
      "      showQuestion();\n" +
      "    }\n" +
      "    function showQuestion() {\n" +
      "      const quiz = quizData[currentQuestionIndex];\n" +
      "      answered = false;\n" +
      "      showOnly(quizScreen);\n" +
      "      questionNumber.textContent = '第' + (currentQuestionIndex + 1) + '問 / 全3問';\n" +
      "      if (questionMeterFill) { questionMeterFill.style.width = (((currentQuestionIndex + 1) / quizData.length) * 100) + '%'; }\n" +
      "      questionText.textContent = quiz.question;\n" +
      "      answerMessage.textContent = '';\n" +
      "      answerMessage.className = 'answer-message';\n" +
      "      nextButton.classList.add('hidden');\n" +
      "      nextButton.textContent = currentQuestionIndex === quizData.length - 1 ? '結果を見る' : '次の問題へ';\n" +
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
      "      showOnly(resultScreen);\n" +
      "      scoreText.textContent = correctCount + ' / ' + quizData.length;\n" +
      "      resultMessage.textContent = correctCount === quizData.length ? '全問正解です。すばらしい！' : (correctCount >= 2 ? 'よくできました。もう一度挑戦して満点を目指しましょう。' : 'もう一度チャレンジして、JavaScriptに慣れていきましょう。');\n" +
      "    }\n" +
      "    applyTheme(titleScreen);\n" +
      "    applyTheme(quizScreen);\n" +
      "    applyTheme(resultScreen);\n" +
      "    startButton.addEventListener('click', startQuiz);\n" +
      "    choiceButtons[0].addEventListener('click', function () { checkAnswer(0); });\n" +
      "    choiceButtons[1].addEventListener('click', function () { checkAnswer(1); });\n" +
      "    choiceButtons[2].addEventListener('click', function () { checkAnswer(2); });\n" +
      "    nextButton.addEventListener('click', goToNextQuestion);\n" +
      "    retryButton.addEventListener('click', startQuiz);\n" +
      "    backToTitleButton.addEventListener('click', showTitle);\n" +
      (issuanceReference ? "    const workReference = document.getElementById('work-reference');\n    if (workReference) { workReference.textContent = issuanceReference.workId ? '発行ID: ' + issuanceReference.workId : ''; }\n" : "") +
      "    showTitle();\n" +
      "  </script>\n" +
      "</body>\n" +
      "</html>";
  }

  function escapeHtmlText(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function workLooksComplete(work) {
    if (!work || !Array.isArray(work.questions) || work.questions.length !== WORK_LIMITS.questionCount) {
      return false;
    }
    if (!work.gameTitle || !work.backgroundColor || !work.textColor) {
      return false;
    }
    for (var i = 0; i < work.questions.length; i++) {
      var question = work.questions[i];
      if (!question.question || question.question.trim() === "" || typeof question.correctIndex !== "number") {
        return false;
      }
      for (var j = 0; j < question.choices.length; j++) {
        if (!question.choices[j] || question.choices[j].trim() === "") {
          return false;
        }
      }
    }
    return true;
  }

  return {
    WORK_LIMITS: WORK_LIMITS,
    NAMED_COLORS: NAMED_COLORS,
    COMPANY_NAME: COMPANY_NAME,
    COMPANY_URL: COMPANY_URL,
    MAKER_CREDIT_POWERED: MAKER_CREDIT_POWERED,
    MAKER_CREDIT_BRAND: MAKER_CREDIT_BRAND,
    INITIAL_CODE: INITIAL_CODE,
    STEP_GUIDE: STEP_GUIDE,
    STEP_FOCUS_NAMES: STEP_FOCUS_NAMES,
    tokenize: tokenize,
    tokenizeForDisplay: tokenizeForDisplay,
    getFuriganaRuby: getFuriganaRuby,
    isCorrectIndexNumberToken: isCorrectIndexNumberToken,
    buildFuriganaModel: buildFuriganaModel,
    parseLearnerCode: parseLearnerCode,
    isAllowedConstName: isAllowedConstName,
    isIdentifierStart: isIdentifierStart,
    isIdentifierPart: isIdentifierPart,
    isDigit: isDigit,
    parseRgbLiteral: parseRgbLiteral,
    formatRgbLiteral: formatRgbLiteral,
    rgbToHex: rgbToHex,
    hexToRgb: hexToRgb,
    normalizeLearnerColor: normalizeLearnerColor,
    normalizeColor: normalizeColor,
    readConstStringLiteral: readConstStringLiteral,
    replaceConstStringLiteral: replaceConstStringLiteral,
    findConstStringSpan: findConstStringSpan,
    findLearnerRgbLiteralByName: findLearnerRgbLiteralByName,
    findLearnerRgbLiteralAtOffset: findLearnerRgbLiteralAtOffset,
    createMakerCreditHtml: createMakerCreditHtml,
    getQuizSurfaceCss: getQuizSurfaceCss,
    getQuizPageCss: getQuizPageCss,
    getQuizSurfaceMarkup: getQuizSurfaceMarkup,
    isSafeCssColor: isSafeCssColor,
    getContrastWarning: getContrastWarning,
    getStepClearMessage: getStepClearMessage,
    formatLearnerConsoleError: formatLearnerConsoleError,
    contrastRatio: contrastRatio,
    cloneWorkData: cloneWorkData,
    cloneQuestions: cloneQuestions,
    validateWorkData: validateWorkData,
    getStep5ChangeSummary: getStep5ChangeSummary,
    getStep5QuestionStates: getStep5QuestionStates,
    hasPairedStep5Question: hasPairedStep5Question,
    questionHasPairedStep5Edits: questionHasPairedStep5Edits,
    evaluateStepProgress: evaluateStepProgress,
    areAllStepsComplete: areAllStepsComplete,
    formatIssuanceResultCopy: formatIssuanceResultCopy,
    formatIssuanceErrorCopy: formatIssuanceErrorCopy,
    getStepFocusLines: getStepFocusLines,
    describeIdentifier: describeIdentifier,
    createStandaloneQuizHtml: createStandaloneQuizHtml,
    safeSerializeForInlineScript: safeSerializeForInlineScript,
    createCodeError: createCodeError,
    workLooksComplete: workLooksComplete,
    createCodeHistory: createCodeHistory,
    createPreviewHistory: createPreviewHistory
  };
});
