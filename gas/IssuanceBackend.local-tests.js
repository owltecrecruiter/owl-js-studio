/* eslint-disable no-console */
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const path = require("path");
const backendApi = require("./IssuanceBackend");

const {
  CODE_HEADERS,
  HISTORY_HEADERS,
  REQUEST_HEADERS,
  CODE_STATUS,
  DELIVERY_STATUS,
  ERROR_CODE,
  createBackend,
  createSpreadsheetStorage,
  createLearnerBridgeHtml,
  createTrustedStandaloneQuizHtml,
  extractBridgeSession,
  sanitizeBridgeSession,
  readBridgeSessionFromQueryString,
  doGet,
  doPost
} = backendApi;

const ADMIN_TOKEN = "local-admin-token";

const validQuestions = [
  {
    question: "JavaScriptで文字を画面に表示するときに使う命令はどれ？",
    choices: ["console.log", "style.color", "border-radius"],
    correctIndex: 0
  },
  {
    question: "変数を作るときに使うキーワードはどれ？",
    choices: ["let", "click", "window"],
    correctIndex: 0
  },
  {
    question: "条件によって処理を分けるときに使う書き方はどれ？",
    choices: ["if / else", "font-size", "padding"],
    correctIndex: 0
  }
];

const validQuizData = {
  gameTitle: "はじめての3択クイズ",
  backgroundColor: "#eaf3ff",
  textColor: "#1f2937",
  questions: validQuestions
};

const tests = [];

test("spreadsheet schema setup creates required sheets", function () {
  const spreadsheet = createMockSpreadsheet();
  const storage = createSpreadsheetStorage(spreadsheet);
  const result = storage.initSchema();

  assert.deepStrictEqual(result.sheets, ["issuance_codes", "issuance_history", "issuance_requests"]);
  assert.deepStrictEqual(spreadsheet.getSheetByName("issuance_codes").rows[0], CODE_HEADERS);
  assert.deepStrictEqual(spreadsheet.getSheetByName("issuance_history").rows[0], HISTORY_HEADERS);
  assert.deepStrictEqual(spreadsheet.getSheetByName("issuance_requests").rows[0], REQUEST_HEADERS);
});

test("code generation stores only hash and returns plaintext once", function () {
  const fixture = createFixture();
  const generated = fixture.backend.generateCode({
    adminToken: ADMIN_TOKEN,
    applicantId: "applicant-001",
    email: "learner@example.com",
    attendanceConfirmed: true,
    code: "V06-CODE-001"
  });

  assert.strictEqual(generated.ok, true);
  assert.strictEqual(generated.code, "V06-CODE-001");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(generated.record, "codeHash"), false);

  const stored = fixture.storage.findCodeById(generated.record.codeId);
  assert.strictEqual(stored.codeHash.length, 64);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, "code"), false);
});

test("code verification accepts valid attendance-confirmed code", function () {
  const fixture = createFixture();
  const generated = generateCode(fixture, "VERIFY-CODE", true);
  const verified = fixture.backend.verifyCode({ code: "VERIFY-CODE", clientKey: "local" });

  assert.strictEqual(verified.ok, true);
  assert.strictEqual(verified.codeId, generated.record.codeId);
  assert.strictEqual(verified.status, CODE_STATUS.VALID);
});

test("attendance-unconfirmed code is rejected", function () {
  const fixture = createFixture();
  generateCode(fixture, "ABSENT-CODE", false);

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "ABSENT-CODE",
      requestId: "req-absent",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.ATTENDANCE_NOT_CONFIRMED);
});

test("used code is rejected after first issue", function () {
  const fixture = createFixture();
  generateCode(fixture, "USED-CODE", true);

  fixture.backend.issueWork({
    code: "USED-CODE",
    requestId: "req-used-1",
    email: "learner@example.com",
    quizData: validQuizData
  });

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "USED-CODE",
      requestId: "req-used-2",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.CODE_USED);

  const rejected = fixture.storage.history.find(function (event) {
    return event.eventType === "code_rejected" && event.requestId === "req-used-2";
  });
  assert.ok(rejected, "code reuse should be written to audit history");
  assert.strictEqual(JSON.parse(rejected.details).reason, ERROR_CODE.CODE_USED);
});

test("disabled code is rejected", function () {
  const fixture = createFixture();
  const generated = generateCode(fixture, "DISABLED-CODE", true);
  fixture.backend.disableCode({
    adminToken: ADMIN_TOKEN,
    codeId: generated.record.codeId,
    disabledBy: "local-test",
    reason: "attendance changed"
  });

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "DISABLED-CODE",
      requestId: "req-disabled",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.CODE_DISABLED);
});

test("double issue prevention allows only one request", function () {
  const fixture = createFixture();
  generateCode(fixture, "DOUBLE-ISSUE-CODE", true);

  const first = fixture.backend.issueWork({
    code: "DOUBLE-ISSUE-CODE",
    requestId: "req-double-a",
    email: "learner@example.com",
    quizData: validQuizData
  });
  assert.strictEqual(first.ok, true);

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "DOUBLE-ISSUE-CODE",
      requestId: "req-double-b",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.CODE_USED);

  const generatedEvents = fixture.storage.history.filter(function (event) {
    return event.eventType === "work_generated";
  });
  assert.strictEqual(generatedEvents.length, 1);
  assert.ok(fixture.lockManager.acquiredKeys.indexOf("issuance:code:" + fixture.storage.codes[0].codeHash) !== -1);
});

test("same requestId retry returns idempotent result", function () {
  const fixture = createFixture();
  generateCode(fixture, "IDEMPOTENT-CODE", true);

  const first = fixture.backend.issueWork({
    code: "IDEMPOTENT-CODE",
    requestId: "req-idempotent",
    email: "learner@example.com",
    quizData: validQuizData
  });
  const second = fixture.backend.issueWork({
    code: "IDEMPOTENT-CODE",
    requestId: "req-idempotent",
    email: "learner@example.com",
    quizData: validQuizData
  });

  assert.strictEqual(second.idempotent, true);
  assert.strictEqual(second.workId, first.workId);
  assert.strictEqual(second.deliveryReference, first.deliveryReference);
});

test("same requestId with different work data is rejected", function () {
  const fixture = createFixture();
  generateCode(fixture, "REQUEST-CONFLICT-CODE", true);

  fixture.backend.issueWork({
    code: "REQUEST-CONFLICT-CODE",
    requestId: "req-conflict-same-id",
    email: "learner@example.com",
    quizData: validQuizData
  });

  const changedQuizData = clone(validQuizData);
  changedQuizData.questions[0].question = "別の問題文に変更した場合は拒否される？";
  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "REQUEST-CONFLICT-CODE",
      requestId: "req-conflict-same-id",
      email: "learner@example.com",
      quizData: changedQuizData
    });
  }, ERROR_CODE.REQUEST_CONFLICT);
});

test("same requestId used for another code is rejected", function () {
  const fixture = createFixture();
  generateCode(fixture, "REQUEST-CODE-A", true);
  generateCode(fixture, "REQUEST-CODE-B", true);

  fixture.backend.issueWork({
    code: "REQUEST-CODE-A",
    requestId: "req-one-id-two-codes",
    email: "learner@example.com",
    quizData: validQuizData
  });

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "REQUEST-CODE-B",
      requestId: "req-one-id-two-codes",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.REQUEST_CONFLICT);
});

test("exception during code verification is surfaced without state change", function () {
  const fixture = createFixture({
    rateLimiter: {
      check: function () {
        throw new backendApi.IssuanceError(ERROR_CODE.RATE_LIMITED, "mock rate limit");
      }
    }
  });
  generateCode(fixture, "VERIFY-EXCEPTION-CODE", true);

  assertRejectsCode(function () {
    fixture.backend.verifyCode({ code: "VERIFY-EXCEPTION-CODE", clientKey: "local" });
  }, ERROR_CODE.RATE_LIMITED);

  const stored = fixture.storage.findCodeByHash(fixture.backendHash("VERIFY-EXCEPTION-CODE"));
  assert.strictEqual(stored.status, CODE_STATUS.VALID);
  assert.strictEqual(stored.deliveryStatus, DELIVERY_STATUS.NOT_REQUESTED);
});

test("code verification failure preserves stored state", function () {
  const fixture = createFixture();
  generateCode(fixture, "VERIFY-ABSENT-CODE", false);

  assertRejectsCode(function () {
    fixture.backend.verifyCode({ code: "VERIFY-ABSENT-CODE" });
  }, ERROR_CODE.ATTENDANCE_NOT_CONFIRMED);

  const stored = fixture.storage.findCodeByHash(fixture.backendHash("VERIFY-ABSENT-CODE"));
  assert.strictEqual(stored.status, CODE_STATUS.VALID);
  assert.strictEqual(stored.redeemedAt, "");
  assert.strictEqual(stored.deliveryStatus, DELIVERY_STATUS.NOT_REQUESTED);
});

test("invalid quiz data is rejected server-side", function () {
  const fixture = createFixture();
  generateCode(fixture, "INVALID-QUIZ-CODE", true);

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "INVALID-QUIZ-CODE",
      requestId: "req-invalid-quiz",
      email: "learner@example.com",
      quizData: validQuizData.questions.slice(0, 2)
    });
  }, ERROR_CODE.INVALID_QUIZ_DATA);

  assert.strictEqual(fixture.storage.codes[0].status, CODE_STATUS.VALID);
});

test("valid quiz data generates standalone HTML", function () {
  const html = createTrustedStandaloneQuizHtml({
    quizData: Object.assign({}, validQuizData, {
      questions: [
        {
          question: "閉じタグ </script> は文字として扱う？",
          choices: ["はい", "いいえ", "& の確認"],
          correctIndex: 0
        },
        validQuizData.questions[1],
        validQuizData.questions[2]
      ]
    }),
    issuanceReference: {
      codeId: "code-local",
      applicantId: "applicant-local",
      workId: "work-local",
      requestId: "req-local"
    }
  });

  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("\\u003C/script\\u003E"));
  assert.strictEqual(/<script\s+src=/.test(html), false);
  assert.strictEqual(/\beval\s*\(/.test(html), false);
  assert.strictEqual(/\bnew Function\b/.test(html), false);
  assert.ok(html.includes("Powered by"));
  assert.ok(html.includes("OWL Technology"));
  assert.strictEqual(html.indexOf("制作ツール提供："), -1);
  assert.ok(html.includes("https://owl-tec.co.jp/"));
  assert.ok(html.includes("rel=\"noopener noreferrer\""));
});

test("special characters are escaped in generated HTML and bridge origin is fixed", function () {
  const html = createTrustedStandaloneQuizHtml({
    quizData: Object.assign({}, validQuizData, {
      questions: [
        {
          question: "特殊文字 </script> <img src=x onerror=alert(1)> \u2028 終端",
          choices: ["&", "\"quoted\"", "'single'"],
          correctIndex: 0
        },
        validQuizData.questions[1],
        validQuizData.questions[2]
      ]
    }),
    issuanceReference: {
      codeId: "code-special",
      applicantId: "applicant-special",
      workId: "work-special",
      requestId: "req-special"
    }
  });
  const bridgeHtml = createLearnerBridgeHtml({
    allowedOrigin: "https://example.github.io",
    bridgeSession: "bridge-local-session"
  });

  assert.ok(html.includes("\\u003C/script\\u003E"));
  assert.ok(html.includes("\\u003Cimg src=x onerror=alert(1)\\u003E"));
  assert.ok(html.includes("\\u2028"));
  assert.ok(bridgeHtml.includes("const allowedOrigin=\"https://example.github.io\";"));
  assert.ok(bridgeHtml.includes("const injectedBridgeSession=\"bridge-local-session\";"));
  assert.ok(bridgeHtml.includes("let bridgeSession = injectedBridgeSession;"));
  assert.ok(bridgeHtml.includes("window.location.search"));
  assert.ok(bridgeHtml.includes("window.location.hash"));
  assert.ok(bridgeHtml.includes("google.script.url.getLocation"));
  assert.ok(bridgeHtml.includes("jsquiz:v0.7:ready"));
  assert.ok(bridgeHtml.includes("bridgeSession: bridgeSession"));
  assert.ok(bridgeHtml.includes("jsquiz:v0.7:ping"));
  assert.ok(bridgeHtml.includes("jsquiz:v0.7:pong"));
  assert.ok(bridgeHtml.includes("bridgeSession: bridgeSession"));
  assert.ok(bridgeHtml.includes("data.bridgeSession !== bridgeSession"));
  assert.ok(bridgeHtml.includes("observedOrigin: event.origin"));
  assert.ok(bridgeHtml.includes("bridgeVersion: bridgeVersion"));
  assert.ok(bridgeHtml.includes("event.origin !== allowedOrigin"));
  assert.ok(bridgeHtml.includes(".issueWorkFromBridge(data.payload || {})"));
  assert.ok(bridgeHtml.indexOf("jsquiz:v0.7:ping") < bridgeHtml.indexOf(".issueWorkFromBridge(data.payload || {})"));
  assert.strictEqual(bridgeHtml.indexOf("adminGenerateCode"), -1);
  assert.strictEqual(bridgeHtml.indexOf("adminDisableCode"), -1);
  assert.strictEqual(bridgeHtml.indexOf("adminStatusLookup"), -1);
  assert.strictEqual(bridgeHtml.indexOf("adminResend"), -1);
  assert.strictEqual(bridgeHtml.indexOf(", '*')"), -1);

  const unsafeBridgeHtml = createLearnerBridgeHtml({
    allowedOrigin: "https://example.github.io",
    bridgeSession: "<script>alert(1)</script>"
  });
  assert.ok(unsafeBridgeHtml.includes("const injectedBridgeSession=\"\";"));
  assert.strictEqual(unsafeBridgeHtml.indexOf("<script>alert(1)</script>"), -1);
});

test("extractBridgeSession reads query, parameters array, and queryString", function () {
  assert.strictEqual(extractBridgeSession({
    parameter: { bridgeSession: "bridge-from-parameter" }
  }), "bridge-from-parameter");
  assert.strictEqual(extractBridgeSession({
    parameters: { bridgeSession: ["bridge-from-parameters"] }
  }), "bridge-from-parameters");
  assert.strictEqual(extractBridgeSession({
    queryString: "foo=1&bridgeSession=bridge-from-query-string"
  }), "bridge-from-query-string");
  assert.strictEqual(readBridgeSessionFromQueryString("bridgeSession=bridge-plain"), "bridge-plain");
  assert.strictEqual(extractBridgeSession({}), "");
  assert.strictEqual(extractBridgeSession({ parameter: { bridgeSession: "<script>alert(1)</script>" } }), "");
  assert.strictEqual(sanitizeBridgeSession("bridge-ok_1.~"), "bridge-ok_1.~");
});

test("doGet injects seen query session and still emits hash/location readers", function () {
  withMockHtmlService(function (getLastHtml) {
    withMockProperties({
      LEARNER_PAGE_ORIGIN: "https://example.github.io"
    }, function () {
      const output = doGet({
        parameter: { bridgeSession: "bridge-doGet-session" }
      });
      const html = output.content;
      assert.strictEqual(output.xframe, "ALLOWALL");
      assert.ok(html.includes("const injectedBridgeSession=\"bridge-doGet-session\";"));
      assert.ok(html.includes("window.location.hash"));
      assert.ok(html.includes("google.script.url.getLocation"));
      assert.strictEqual(html.indexOf(", '*')"), -1);
      assert.strictEqual(html.indexOf("adminGenerateCode"), -1);

      doGet({});
      const stripped = getLastHtml();
      assert.ok(stripped.includes("const injectedBridgeSession=\"\";"));
      assert.ok(stripped.includes("readBridgeSessionFromBrowserLocation"));
      assert.ok(stripped.includes("readBridgeSessionFromGasUrlLocation"));
    });
  });
});

test("connectivity test page attaches hash session and allows googleusercontent hosts", function () {
  const connectivityHtml = require("fs").readFileSync(path.join(__dirname, "../platform/gas-bridge-connectivity-test.html"), "utf8");
  assert.ok(connectivityHtml.includes('url.hash = "bridgeSession="'));
  assert.ok(connectivityHtml.includes("url.searchParams.set(\"bridgeSession\", bridgeSession)"));
  assert.ok(connectivityHtml.includes("isScriptGoogleUserContentHost"));
  assert.ok(connectivityHtml.includes("-script.googleusercontent.com"));
  assert.strictEqual(connectivityHtml.indexOf(", '*')"), -1);
  assert.ok(connectivityHtml.includes("ping/requestId/bridgeSession のみ"));
});

test("parent-side hash/query session attachment and googleusercontent origin allowlist", function () {
  const bridgeClient = require("../platform/issuance-v06-client");
  const session = "bridge-hash-query-1";
  const attached = bridgeClient.appendBridgeSession("https://script.google.com/macros/s/xxx/exec", session);
  const attachedUrl = new URL(attached);
  assert.strictEqual(attachedUrl.searchParams.get("bridgeSession"), session);
  assert.strictEqual(new URLSearchParams(attachedUrl.hash.replace(/^#/, "")).get("bridgeSession"), session);

  const webAppOrigin = "https://script.google.com";
  const hyphenOrigin = "https://n-abc123-0lu-script.googleusercontent.com";
  const dottedOrigin = "https://n-abc123.script.googleusercontent.com";
  assert.strictEqual(bridgeClient.isAllowedGasBridgeReplyOrigin(hyphenOrigin, webAppOrigin, [webAppOrigin]), true);
  assert.strictEqual(bridgeClient.isAllowedGasBridgeReplyOrigin(dottedOrigin, webAppOrigin, [webAppOrigin]), true);
  assert.strictEqual(bridgeClient.isAllowedGasBridgeReplyOrigin("https://evil.example", webAppOrigin, [webAppOrigin]), false);
  assert.strictEqual(bridgeClient.isAllowedGasBridgeReplyOrigin("http://n-abc123-0lu-script.googleusercontent.com", webAppOrigin, [webAppOrigin]), false);
  assert.strictEqual(bridgeClient.isAllowedGasBridgeReplyOrigin("https://notscript.googleusercontent.com", webAppOrigin, [webAppOrigin]), false);
  assert.strictEqual(bridgeClient.isScriptGoogleUserContentOrigin(hyphenOrigin), true);
});

test("public doPost JSON endpoint is disabled for learner and admin-like actions", function () {
  withMockContentService(function () {
    const issueResponse = doPost({
      postData: {
        contents: JSON.stringify({
          action: "issueWork",
          code: "ANY-CODE",
          requestId: "req-public-post",
          quizData: validQuizData
        })
      }
    });
    const adminResponse = doPost({
      postData: {
        contents: JSON.stringify({
          action: "adminGenerateCode",
          adminToken: ADMIN_TOKEN,
          applicantId: "applicant-public-post",
          attendanceConfirmed: true
        })
      }
    });

    [issueResponse, adminResponse].forEach(function (response) {
      const body = JSON.parse(response.text);
      assert.strictEqual(response.mimeType, "application/json");
      assert.strictEqual(body.ok, false);
      assert.strictEqual(body.error.code, ERROR_CODE.INVALID_REQUEST);
      assert.ok(body.error.message.indexOf("HTML Service bridge") !== -1);
    });
  });
});

test("bridge handler preserves learner issuance path server-side", function () {
  const fixture = createFixture();
  generateCode(fixture, "BRIDGE-PRESERVED-CODE", true);

  const issued = fixture.backend.issueWork({
    code: "BRIDGE-PRESERVED-CODE",
    requestId: "req-bridge-preserved",
    email: "learner@example.com",
    quizData: validQuizData
  });

  assert.strictEqual(issued.ok, true);
  assert.strictEqual(issued.deliveryStatus, DELIVERY_STATUS.SENT);
});

test("mail send success marks delivery sent", function () {
  const fixture = createFixture();
  generateCode(fixture, "MAIL-SUCCESS-CODE", true);

  const issued = fixture.backend.issueWork({
    code: "MAIL-SUCCESS-CODE",
    requestId: "req-mail-success",
    email: "learner@example.com",
    quizData: validQuizData
  });

  assert.strictEqual(issued.deliveryStatus, DELIVERY_STATUS.SENT);
  assert.strictEqual(fixture.delivery.sent.length, 1);
});

test("mail send failure marks delivery failed", function () {
  const fixture = createFixture({ deliveryShouldFail: true });
  generateCode(fixture, "MAIL-FAIL-CODE", true);

  const issued = fixture.backend.issueWork({
    code: "MAIL-FAIL-CODE",
    requestId: "req-mail-fail",
    email: "learner@example.com",
    quizData: validQuizData
  });

  assert.strictEqual(issued.ok, true);
  assert.strictEqual(issued.deliveryStatus, DELIVERY_STATUS.FAILED);
  assert.strictEqual(fixture.storage.codes[0].deliveryStatus, DELIVERY_STATUS.FAILED);
});

test("delivery exception marks delivery failed without losing resend data", function () {
  const fixture = createFixture({ deliveryThrows: true });
  generateCode(fixture, "DELIVERY-EXCEPTION-CODE", true);

  const issued = fixture.backend.issueWork({
    code: "DELIVERY-EXCEPTION-CODE",
    requestId: "req-delivery-exception",
    email: "learner@example.com",
    quizData: validQuizData
  });
  const stored = fixture.storage.codes[0];
  const request = fixture.storage.findRequest("req-delivery-exception");

  assert.strictEqual(issued.ok, true);
  assert.strictEqual(issued.deliveryStatus, DELIVERY_STATUS.FAILED);
  assert.strictEqual(stored.status, CODE_STATUS.USED);
  assert.strictEqual(stored.workId, issued.workId);
  assert.strictEqual(request.status, "completed");
});

test("issuance history save failure does not corrupt issued state", function () {
  const fixture = createFixture({ failAppendHistoryCount: 10 });
  generateCode(fixture, "HISTORY-FAIL-CODE", true);

  const issued = fixture.backend.issueWork({
    code: "HISTORY-FAIL-CODE",
    requestId: "req-history-failure",
    email: "learner@example.com",
    quizData: validQuizData
  });
  const stored = fixture.storage.codes[0];
  const request = fixture.storage.findRequest("req-history-failure");

  assert.strictEqual(issued.ok, true);
  assert.strictEqual(stored.status, CODE_STATUS.USED);
  assert.strictEqual(stored.deliveryStatus, DELIVERY_STATUS.SENT);
  assert.strictEqual(request.status, "completed");
  assert.ok(fixture.storage.historyFailures.length >= 1);
});

test("spreadsheet write failure leaves request failed and code reusable if first state write fails", function () {
  const fixture = createFixture({ failUpdateCodeCount: 1 });
  generateCode(fixture, "SHEET-WRITE-FAIL-CODE", true);

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "SHEET-WRITE-FAIL-CODE",
      requestId: "req-sheet-write-fail",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.STORAGE_CONFLICT);

  assert.strictEqual(fixture.storage.codes[0].status, CODE_STATUS.VALID);
  assert.strictEqual(fixture.storage.findRequest("req-sheet-write-fail").status, "failed");
});

test("duplicate during generated code creation retries with a new value", function () {
  const fixture = createFixture({
    random: createQueuedRandom(["DUPLICATE-GENERATED-CODE", "UNIQUE-GENERATED-CODE"])
  });
  generateCode(fixture, "DUPLICATE-GENERATED-CODE", true);

  const generated = fixture.backend.generateCode({
    adminToken: ADMIN_TOKEN,
    applicantId: "applicant-duplicate-retry",
    email: "learner@example.com",
    attendanceConfirmed: true
  });

  assert.strictEqual(generated.code, "UNIQUE-GENERATED-CODE");
  assert.strictEqual(fixture.storage.codes.length, 2);
});

test("explicit duplicate issuance code generation is rejected", function () {
  const fixture = createFixture();
  generateCode(fixture, "DUPLICATE-EXPLICIT-CODE", true);

  assertRejectsCode(function () {
    fixture.backend.generateCode({
      adminToken: ADMIN_TOKEN,
      applicantId: "applicant-duplicate-explicit",
      email: "learner@example.com",
      attendanceConfirmed: true,
      code: "DUPLICATE-EXPLICIT-CODE"
    });
  }, ERROR_CODE.STORAGE_CONFLICT);
});

test("lock acquisition failure is reported explicitly", function () {
  const fixture = createFixture({
    lockManager: {
      acquire: function () {
        throw new backendApi.IssuanceError(ERROR_CODE.LOCK_UNAVAILABLE, "mock lock failure");
      }
    }
  });

  assertRejectsCode(function () {
    fixture.backend.generateCode({
      adminToken: ADMIN_TOKEN,
      applicantId: "applicant-lock-failure",
      attendanceConfirmed: true
    });
  }, ERROR_CODE.LOCK_UNAVAILABLE);
});

test("invalid email address is rejected", function () {
  const fixture = createFixture();
  assertRejectsCode(function () {
    fixture.backend.generateCode({
      adminToken: ADMIN_TOKEN,
      applicantId: "applicant-invalid-email",
      email: "not-an-email",
      attendanceConfirmed: true
    });
  }, ERROR_CODE.INVALID_EMAIL);
});

test("too-long strings are rejected", function () {
  const fixture = createFixture();
  generateCode(fixture, "TOO-LONG-CODE", true);

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "TOO-LONG-CODE",
      requestId: "x".repeat(121),
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.INVALID_REQUEST);

  const tooLongQuiz = clone(validQuizData);
  tooLongQuiz.questions[0].choices[0] = "a".repeat(81);
  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "TOO-LONG-CODE",
      requestId: "req-too-long-choice",
      email: "learner@example.com",
      quizData: tooLongQuiz
    });
  }, ERROR_CODE.INVALID_QUIZ_DATA);
  assert.strictEqual(fixture.storage.codes[0].status, CODE_STATUS.VALID);
});

test("long valid special-character quiz is accepted and escaped", function () {
  const fixture = createFixture();
  generateCode(fixture, "LONG-SPECIAL-CODE", true);
  const quiz = clone(validQuizData);
  quiz.questions[0] = {
    question: "特殊文字 <>&\"' と境界長 " + "あ".repeat(101),
    choices: ["<script>ではない", "& entity", "\"double\" and 'single'"],
    correctIndex: 1
  };

  const issued = fixture.backend.issueWork({
    code: "LONG-SPECIAL-CODE",
    requestId: "req-long-special",
    email: "learner@example.com",
    quizData: quiz
  });

  assert.strictEqual(issued.ok, true);
  assert.strictEqual(fixture.storage.codes[0].status, CODE_STATUS.USED);
});

test("non-admin admin operation is rejected", function () {
  const fixture = createFixture();
  assertRejectsCode(function () {
    fixture.backend.generateCode({
      adminToken: "wrong",
      applicantId: "applicant-rejected",
      attendanceConfirmed: true
    });
  }, ERROR_CODE.AUTH_REQUIRED);
});

test("top-level admin wrappers reject missing explicit admin token", function () {
  withMockProperties({
    ADMIN_API_TOKEN: ADMIN_TOKEN,
    PUBLIC_LEARNER_DEPLOYMENT: "false"
  }, function () {
    assertRejectsCode(function () {
      backendApi.adminGenerateCode({
        applicantId: "applicant-top-level-no-token",
        attendanceConfirmed: true
      });
    }, ERROR_CODE.AUTH_REQUIRED);
  });
});

test("public learner deployment hard-rejects top-level admin wrappers", function () {
  withMockProperties({
    ADMIN_API_TOKEN: ADMIN_TOKEN,
    PUBLIC_LEARNER_DEPLOYMENT: "true"
  }, function () {
    [
      function () {
        backendApi.setupSpreadsheetSchema({ adminToken: ADMIN_TOKEN });
      },
      function () {
        backendApi.adminGenerateCode({ adminToken: ADMIN_TOKEN, applicantId: "applicant-public", attendanceConfirmed: true });
      },
      function () {
        backendApi.adminDisableCode({ adminToken: ADMIN_TOKEN, codeId: "code-public" });
      },
      function () {
        backendApi.adminStatusLookup({ adminToken: ADMIN_TOKEN, codeId: "code-public" });
      },
      function () {
        backendApi.adminResend({ adminToken: ADMIN_TOKEN, codeId: "code-public", requestId: "req-public" });
      }
    ].forEach(function (call) {
      assertRejectsCode(call, ERROR_CODE.AUTH_REQUIRED);
    });
  });
});

test("testGenerateCode is disabled unless helper flag is enabled and public mode is off", function () {
  withMockProperties({
    ADMIN_API_TOKEN: ADMIN_TOKEN,
    PUBLIC_LEARNER_DEPLOYMENT: "false",
    ENABLE_GAS_EDITOR_TEST_HELPERS: "false"
  }, function () {
    assertRejectsCode(function () {
      backendApi.testGenerateCode();
    }, ERROR_CODE.INVALID_REQUEST);
  });

  withMockProperties({
    ADMIN_API_TOKEN: ADMIN_TOKEN,
    PUBLIC_LEARNER_DEPLOYMENT: "true",
    ENABLE_GAS_EDITOR_TEST_HELPERS: "true"
  }, function () {
    assertRejectsCode(function () {
      backendApi.testGenerateCode();
    }, ERROR_CODE.AUTH_REQUIRED);
  });
});

test("unset ADMIN_API_TOKEN rejects admin operation", function () {
  const fixture = createFixture({ adminToken: "" });
  assertRejectsCode(function () {
    fixture.backend.generateCode({
      adminToken: ADMIN_TOKEN,
      applicantId: "applicant-unset-admin-token",
      attendanceConfirmed: true
    });
  }, ERROR_CODE.AUTH_REQUIRED);
});

test("invalid issuance attempts are audited and rate-limited without plaintext code", function () {
  const fixture = createFixture({
    attemptLimiter: createMemoryAttemptLimiter(1)
  });

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "UNKNOWN-ATTEMPT-CODE",
      requestId: "req-invalid-attempt-1",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.CODE_NOT_FOUND);

  assertRejectsCode(function () {
    fixture.backend.issueWork({
      code: "UNKNOWN-ATTEMPT-CODE",
      requestId: "req-invalid-attempt-2",
      email: "learner@example.com",
      quizData: validQuizData
    });
  }, ERROR_CODE.RATE_LIMITED);

  const rejected = fixture.storage.history.filter(function (event) {
    return event.eventType === "code_rejected";
  });
  assert.strictEqual(rejected.length, 2);
  assert.strictEqual(JSON.parse(rejected[0].details).reason, ERROR_CODE.CODE_NOT_FOUND);
  assert.strictEqual(JSON.parse(rejected[1].details).reason, ERROR_CODE.RATE_LIMITED);
  assert.ok(rejected[0].details.indexOf("UNKNOWN-ATTEMPT-CODE") === -1);
  assert.ok(JSON.parse(rejected[0].details).codeHash.length === 64);
});

test("admin status lookup and resend work after delivery failure", function () {
  const fixture = createFixture({ deliveryShouldFail: true });
  const generated = generateCode(fixture, "RESEND-CODE", true);
  fixture.backend.issueWork({
    code: "RESEND-CODE",
    requestId: "req-resend-issue",
    email: "learner@example.com",
    quizData: validQuizData
  });

  fixture.delivery.shouldFail = false;
  const resend = fixture.backend.resend({
    adminToken: ADMIN_TOKEN,
    codeId: generated.record.codeId,
    requestId: "req-resend-admin",
    email: "learner@example.com"
  });
  const status = fixture.backend.statusLookup({
    adminToken: ADMIN_TOKEN,
    codeId: generated.record.codeId
  });

  assert.strictEqual(resend.ok, true);
  assert.strictEqual(status.record.deliveryStatus, DELIVERY_STATUS.SENT);
  assert.ok(status.history.some(function (event) {
    return event.eventType === "delivery_resent";
  }));
});

test("existing v0.5 issuance module remains loadable", function () {
  const v05 = require(path.join("..", "platform", "issuance"));
  assert.strictEqual(typeof v05.createIssuanceService, "function");
  assert.strictEqual(typeof v05.validateQuizData, "function");
});

run();

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function run() {
  for (let i = 0; i < tests.length; i++) {
    tests[i].fn();
    console.log("PASS " + tests[i].name);
  }
  console.log("\n" + tests.length + " GAS v0.6 local mock tests passed.");
}

function createFixture(options) {
  const config = options || {};
  const storage = createMemoryStorage({
    failUpdateCodeCount: config.failUpdateCodeCount || 0,
    failAppendHistoryCount: config.failAppendHistoryCount || 0
  });
  const lockManager = config.lockManager || createMemoryLockManager();
  const delivery = config.delivery || createMemoryDelivery(config.deliveryShouldFail === true, config.deliveryThrows === true);
  const digest = {
    sha256: function (text) {
      return crypto.createHash("sha256").update(text, "utf8").digest("hex");
    }
  };
  const backend = createBackend({
    storage: storage,
    lockManager: lockManager,
    delivery: delivery,
    digest: digest,
    random: config.random || createDeterministicRandom(),
    config: {
      get: function (key) {
        if (key === "ADMIN_API_TOKEN") {
          return config.adminToken === undefined ? ADMIN_TOKEN : config.adminToken;
        }
        if (key === "CODE_HASH_PEPPER") {
          return "local-pepper";
        }
        return "";
      }
    },
    time: {
      nowIso: function () {
        return "2026-10-21T07:32:00.000Z";
      }
    },
    rateLimiter: config.rateLimiter,
    attemptLimiter: config.attemptLimiter
  });

  return {
    backend: backend,
    storage: storage,
    lockManager: lockManager,
    delivery: delivery,
    backendHash: function (code) {
      return digest.sha256("JSQUIZ_V06_CODE:local-pepper:" + code);
    }
  };
}

function generateCode(fixture, code, attendanceConfirmed) {
  return fixture.backend.generateCode({
    adminToken: ADMIN_TOKEN,
    applicantId: "applicant-" + code.toLowerCase(),
    email: "learner@example.com",
    attendanceConfirmed: attendanceConfirmed,
    code: code
  });
}

function createMemoryStorage(options) {
  const config = options || {};
  return {
    codes: [],
    history: [],
    historyFailures: [],
    requests: [],
    failUpdateCodeCount: config.failUpdateCodeCount || 0,
    failAppendHistoryCount: config.failAppendHistoryCount || 0,
    initSchema: function () {
      return { ok: true };
    },
    insertCode: function (row) {
      if (this.findCodeByHash(row.codeHash) || this.findCodeById(row.codeId)) {
        throw new Error("duplicate code");
      }
      this.codes.push(clone(row));
    },
    updateCode: function (row) {
      if (this.failUpdateCodeCount > 0) {
        this.failUpdateCodeCount -= 1;
        throw new backendApi.IssuanceError(ERROR_CODE.STORAGE_CONFLICT, "mock spreadsheet write failure");
      }
      this.codes[this.codes.findIndex(function (item) {
        return item.codeId === row.codeId;
      })] = clone(row);
    },
    findCodeByHash: function (codeHash) {
      const row = this.codes.find(function (item) {
        return item.codeHash === codeHash;
      });
      return row ? clone(row) : null;
    },
    findCodeById: function (codeId) {
      const row = this.codes.find(function (item) {
        return item.codeId === codeId;
      });
      return row ? clone(row) : null;
    },
    appendHistory: function (row) {
      if (this.failAppendHistoryCount > 0) {
        this.failAppendHistoryCount -= 1;
        throw new backendApi.IssuanceError(ERROR_CODE.STORAGE_CONFLICT, "mock history append failure");
      }
      this.history.push(clone(row));
    },
    appendHistoryFailure: function (row) {
      this.historyFailures.push(clone(row));
    },
    listHistoryByCodeId: function (codeId) {
      return this.history.filter(function (row) {
        return row.codeId === codeId;
      }).map(clone);
    },
    insertRequest: function (row) {
      this.requests.push(clone(row));
    },
    updateRequest: function (row) {
      const index = this.requests.findIndex(function (item) {
        return item.requestId === row.requestId;
      });
      if (index === -1) {
        this.requests.push(clone(row));
      } else {
        this.requests[index] = clone(row);
      }
    },
    findRequest: function (requestId) {
      const row = this.requests.find(function (item) {
        return item.requestId === requestId;
      });
      return row ? clone(row) : null;
    },
    listRequestsByCodeId: function (codeId) {
      return this.requests.filter(function (row) {
        return row.codeId === codeId;
      }).map(clone);
    }
  };
}

function createMemoryLockManager() {
  return {
    acquiredKeys: [],
    acquire: function (key, fn) {
      this.acquiredKeys.push(key);
      return fn();
    }
  };
}

function createMemoryAttemptLimiter(limit) {
  const counts = {};
  return {
    assertAllowed: function (attempt) {
      const key = attempt.codeHash + ":" + (attempt.clientKey || attempt.email || "");
      if ((counts[key] || 0) >= limit) {
        throw new backendApi.IssuanceError(ERROR_CODE.RATE_LIMITED, "mock attempt limit");
      }
    },
    recordFailure: function (attempt) {
      const key = attempt.codeHash + ":" + (attempt.clientKey || attempt.email || "");
      counts[key] = (counts[key] || 0) + 1;
    },
    recordSuccess: function (attempt) {
      const key = attempt.codeHash + ":" + (attempt.clientKey || attempt.email || "");
      delete counts[key];
    }
  };
}

function createMemoryDelivery(shouldFail, shouldThrow) {
  return {
    shouldFail: shouldFail,
    shouldThrow: shouldThrow,
    sent: [],
    deliver: function (message) {
      if (this.shouldThrow) {
        throw new Error("mock delivery exception");
      }
      if (this.shouldFail) {
        return {
          ok: false,
          reference: "mock-failed:" + message.workId,
          fileId: "mock-file:" + message.workId,
          errorMessage: "mock mail failure"
        };
      }
      this.sent.push(clone(message));
      return {
        ok: true,
        reference: "mock-mail:" + message.requestId,
        fileId: "mock-file:" + message.workId
      };
    },
    resend: function (message) {
      if (this.shouldFail) {
        return {
          ok: false,
          reference: "mock-resend-failed:" + message.workId,
          errorMessage: "mock resend failure"
        };
      }
      this.sent.push(clone(message));
      return {
        ok: true,
        reference: "mock-resend:" + message.requestId,
        fileId: message.fileId
      };
    }
  };
}

function createDeterministicRandom() {
  let id = 0;
  return {
    generateCode: function () {
      id += 1;
      return "MOCK-CODE-" + String(id).padStart(4, "0");
    },
    generateId: function () {
      id += 1;
      return "mockid" + String(id).padStart(6, "0");
    }
  };
}

function createQueuedRandom(codeQueue) {
  let id = 0;
  const queuedCodes = codeQueue.slice();
  return {
    generateCode: function () {
      return queuedCodes.shift() || ("QUEUE-CODE-" + String(id).padStart(4, "0"));
    },
    generateId: function () {
      id += 1;
      return "queuedid" + String(id).padStart(6, "0");
    }
  };
}

function createMockSpreadsheet() {
  return {
    sheets: {},
    getSheetByName: function (name) {
      return this.sheets[name] || null;
    },
    insertSheet: function (name) {
      const sheet = createMockSheet(name);
      this.sheets[name] = sheet;
      return sheet;
    }
  };
}

function createMockSheet(name) {
  return {
    name: name,
    rows: [],
    getLastRow: function () {
      return this.rows.length;
    },
    clear: function () {
      this.rows = [];
    },
    appendRow: function (row) {
      this.rows.push(row.slice());
    },
    getDataRange: function () {
      const self = this;
      return {
        getValues: function () {
          return self.rows.map(function (row) {
            return row.slice();
          });
        }
      };
    },
    getRange: function (row, column, rowCount, columnCount) {
      const self = this;
      return {
        getValues: function () {
          const values = [];
          for (let r = 0; r < rowCount; r++) {
            const sourceRow = self.rows[row - 1 + r] || [];
            values.push(sourceRow.slice(column - 1, column - 1 + columnCount));
          }
          return values;
        },
        setValues: function (values) {
          for (let r = 0; r < values.length; r++) {
            const targetIndex = row - 1 + r;
            self.rows[targetIndex] = self.rows[targetIndex] || [];
            for (let c = 0; c < values[r].length; c++) {
              self.rows[targetIndex][column - 1 + c] = values[r][c];
            }
          }
        }
      };
    }
  };
}

function withMockHtmlService(fn) {
  const previous = global.HtmlService;
  let lastHtml = "";
  global.HtmlService = {
    XFrameOptionsMode: {
      ALLOWALL: "ALLOWALL"
    },
    createHtmlOutput: function (html) {
      lastHtml = html;
      return {
        content: html,
        title: "",
        xframe: "",
        setTitle: function (title) {
          this.title = title;
          return this;
        },
        setXFrameOptionsMode: function (mode) {
          this.xframe = mode;
          return this;
        }
      };
    }
  };
  try {
    fn(function () {
      return lastHtml;
    });
  } finally {
    global.HtmlService = previous;
  }
}

function withMockContentService(fn) {
  const previous = global.ContentService;
  global.ContentService = {
    MimeType: {
      JSON: "application/json"
    },
    createTextOutput: function (text) {
      return {
        text: text,
        mimeType: "",
        setMimeType: function (mimeType) {
          this.mimeType = mimeType;
          return this;
        }
      };
    }
  };
  try {
    fn();
  } finally {
    global.ContentService = previous;
  }
}

function withMockProperties(values, fn) {
  const previous = global.PropertiesService;
  global.PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (key) {
          return values[key] || "";
        }
      };
    }
  };
  try {
    fn();
  } finally {
    global.PropertiesService = previous;
  }
}

function assertRejectsCode(fn, expectedCode) {
  let rejected = null;
  try {
    fn();
  } catch (error) {
    rejected = error;
  }

  assert.ok(rejected, "expected rejection " + expectedCode);
  assert.strictEqual(rejected.code, expectedCode);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
