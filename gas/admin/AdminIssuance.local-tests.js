/* eslint-disable no-console */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const backendApi = require("../IssuanceBackend");
const adminApp = require("./AdminIssuanceApp");

const tests = [];

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function createConfig(values) {
  const props = values || {};
  return {
    get: function (key) {
      return props[key] || "";
    }
  };
}

function createLimiter(limit) {
  let count = 0;
  return {
    assertAllowed: function () {
      if (count >= limit) {
        const error = new Error("limited");
        error.code = "RATE_LIMITED";
        throw error;
      }
    },
    recordFailure: function () {
      count += 1;
    },
    recordSuccess: function () {
      count = 0;
    },
    getCount: function () {
      return count;
    }
  };
}

test("empty fields are rejected before generation", function () {
  assert.strictEqual(adminApp.validateInterviewerForm({}).ok, false);
  assert.ok(adminApp.validateInterviewerForm({ applicantName: "山田", email: "", password: "x" }).message.indexOf("メール") !== -1);
  assert.ok(adminApp.validateInterviewerForm({ applicantName: "", email: "a@b.com", password: "x" }).message.indexOf("氏名") !== -1);
  assert.ok(adminApp.validateInterviewerForm({ applicantName: "山田", email: "a@b.com", password: "" }).message.indexOf("パスワード") !== -1);
});

test("email format is validated", function () {
  assert.strictEqual(adminApp.validateInterviewerForm({
    applicantName: "山田太郎",
    email: "not-an-email",
    password: "secret"
  }).ok, false);
  assert.strictEqual(adminApp.validateInterviewerForm({
    applicantName: "山田太郎",
    email: "taro@example.com",
    password: "secret"
  }).ok, true);
});

test("wrong password does not generate a code", function () {
  const generated = [];
  const limiter = createLimiter(5);
  const failures = [];
  assert.throws(function () {
    adminApp.generateInterviewerCode({
      applicantName: "山田太郎",
      email: "taro@example.com",
      password: "wrong"
    }, {
      config: createConfig({
        ADMIN_WEB_APP: "true",
        INTERVIEWER_ADMIN_PASSWORD: "correct-password",
        ADMIN_API_TOKEN: "admin-token"
      }),
      authLimiter: limiter,
      recordAuthFailure: function (details) {
        failures.push(details);
      },
      backend: {
        generateCode: function (request) {
          generated.push(request);
          return { ok: true, code: "SHOULD-NOT-EXIST", record: { codeId: "x", issuedAt: "t", status: "valid" } };
        }
      }
    });
  });
  assert.strictEqual(generated.length, 0);
  assert.strictEqual(limiter.getCount(), 1);
  assert.strictEqual(failures.length, 1);
  assert.strictEqual(JSON.stringify(failures[0]).indexOf("wrong"), -1);
  assert.strictEqual(JSON.stringify(failures[0]).indexOf("correct-password"), -1);
});

test("correct password generates a one-time attendance-confirmed code", function () {
  const generated = [];
  const result = adminApp.generateInterviewerCode({
    applicantName: "山田太郎",
    email: "taro@example.com",
    password: "correct-password"
  }, {
    config: createConfig({
      ADMIN_WEB_APP: "true",
      INTERVIEWER_ADMIN_PASSWORD: "correct-password",
      ADMIN_API_TOKEN: "admin-token"
    }),
    authLimiter: createLimiter(5),
    backend: {
      generateCode: function (request) {
        generated.push(request);
        return {
          ok: true,
          code: "ABCD-EFGH-IJKL-MNOP-QRST-UVWX",
          record: {
            codeId: "code_mock",
            applicantId: request.applicantId,
            email: request.email,
            attendanceConfirmed: request.attendanceConfirmed,
            status: "valid",
            issuedAt: "2026-10-27T00:00:00.000Z"
          }
        };
      }
    }
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.code, "ABCD-EFGH-IJKL-MNOP-QRST-UVWX");
  assert.strictEqual(result.applicantName, "山田太郎");
  assert.strictEqual(result.email, "taro@example.com");
  assert.strictEqual(result.attendanceConfirmed, true);
  assert.strictEqual(generated[0].adminToken, "admin-token");
  assert.strictEqual(generated[0].applicantId, "山田太郎");
  assert.strictEqual(generated[0].email, "taro@example.com");
  assert.strictEqual(generated[0].attendanceConfirmed, true);
});

test("generated codes stay compatible with existing hash and attendance rules", function () {
  const fixtureConfig = {
    get: function (key) {
      if (key === "ADMIN_API_TOKEN") {
        return "local-admin-token";
      }
      if (key === "CODE_HASH_PEPPER") {
        return "local-pepper";
      }
      return "";
    }
  };
  const storage = {
    codes: [],
    history: [],
    requests: [],
    initSchema: function () { return { ok: true }; },
    insertCode: function (row) { this.codes.push(JSON.parse(JSON.stringify(row))); },
    updateCode: function (row) {
      this.codes[this.codes.findIndex(function (item) { return item.codeId === row.codeId; })] = JSON.parse(JSON.stringify(row));
    },
    findCodeByHash: function (codeHash) {
      return this.codes.find(function (row) { return row.codeHash === codeHash; }) || null;
    },
    findCodeById: function (codeId) {
      return this.codes.find(function (row) { return row.codeId === codeId; }) || null;
    },
    appendHistory: function (row) { this.history.push(JSON.parse(JSON.stringify(row))); },
    listHistoryByCodeId: function () { return []; },
    insertRequest: function () {},
    updateRequest: function () {},
    findRequest: function () { return null; },
    listRequestsByCodeId: function () { return []; }
  };
  const backend = backendApi.createBackend({
    storage: storage,
    lockManager: { acquire: function (_key, fn) { return fn(); } },
    digest: {
      sha256: function (text) {
        return require("crypto").createHash("sha256").update(text).digest("hex");
      }
    },
    random: {
      generateCode: function () { return "COMPAT-CODE-0001"; },
      generateId: function () { return "compatid0001"; }
    },
    delivery: { deliver: function () { return { ok: true, reference: "mock", fileId: "file" }; }, resend: function () { return { ok: true }; } },
    config: fixtureConfig,
    time: { nowIso: function () { return "2026-10-27T00:00:00.000Z"; } }
  });

  const result = adminApp.generateInterviewerCode({
    applicantName: "佐藤花子",
    email: "hanako@example.com",
    password: "pw"
  }, {
    config: createConfig({
      ADMIN_WEB_APP: "true",
      INTERVIEWER_ADMIN_PASSWORD: "pw",
      ADMIN_API_TOKEN: "local-admin-token"
    }),
    authLimiter: createLimiter(5),
    backend: backend
  });

  const stored = storage.findCodeById(result.codeId);
  assert.strictEqual(stored.applicantId, "佐藤花子");
  assert.strictEqual(stored.email, "hanako@example.com");
  assert.strictEqual(stored.attendanceConfirmed, true);
  assert.strictEqual(stored.status, "valid");
  assert.ok(stored.codeHash);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, "code"), false);
  const verified = backend.verifyCode({ code: result.code });
  assert.strictEqual(verified.ok, true);
});

test("public learner deployment cannot call interviewer generation", function () {
  assert.throws(function () {
    adminApp.generateInterviewerCode({
      applicantName: "山田",
      email: "a@b.com",
      password: "pw"
    }, {
      config: createConfig({
        PUBLIC_LEARNER_DEPLOYMENT: "true",
        ADMIN_WEB_APP: "true",
        INTERVIEWER_ADMIN_PASSWORD: "pw",
        ADMIN_API_TOKEN: "token"
      }),
      authLimiter: createLimiter(5),
      backend: { generateCode: function () { throw new Error("should not run"); } }
    });
  });
});

test("learner project without ADMIN_WEB_APP cannot generate interviewer codes", function () {
  assert.throws(function () {
    adminApp.generateInterviewerCode({
      applicantName: "山田",
      email: "a@b.com",
      password: "pw"
    }, {
      config: createConfig({
        INTERVIEWER_ADMIN_PASSWORD: "pw",
        ADMIN_API_TOKEN: "token"
      }),
      authLimiter: createLimiter(5),
      backend: { generateCode: function () { throw new Error("should not run"); } }
    });
  });
});

test("auth limiter blocks further attempts", function () {
  const limiter = createLimiter(1);
  limiter.recordFailure();
  assert.throws(function () {
    adminApp.generateInterviewerCode({
      applicantName: "山田",
      email: "a@b.com",
      password: "pw"
    }, {
      config: createConfig({
        ADMIN_WEB_APP: "true",
        INTERVIEWER_ADMIN_PASSWORD: "pw"
      }),
      authLimiter: limiter,
      backend: { generateCode: function () { throw new Error("should not run"); } }
    });
  });
});

test("interviewer HTML has copy/continue controls and no secrets", function () {
  const html = adminApp.createInterviewerAppHtml();
  assert.ok(html.indexOf("発行コードを生成する") !== -1);
  assert.ok(html.indexOf("コードをコピー") !== -1);
  assert.ok(html.indexOf("続けて発行する") !== -1);
  assert.ok(html.indexOf("type=\"password\"") !== -1);
  assert.ok(html.indexOf("inFlight") !== -1);
  assert.ok(html.indexOf("generateInterviewerCode") !== -1);
  assert.strictEqual(html.indexOf("ADMIN_API_TOKEN"), -1);
  assert.strictEqual(html.indexOf("INTERVIEWER_ADMIN_PASSWORD"), -1);
  assert.strictEqual(html.indexOf("CODE_HASH_PEPPER"), -1);
  assert.strictEqual(html.indexOf("adminDisableCode"), -1);
  assert.strictEqual(html.indexOf("issueWorkFromBridge"), -1);
});

test("admin doGet serves interviewer HTML instead of the learner bridge", function () {
  const previousHtml = global.HtmlService;
  const previousProps = global.PropertiesService;
  let lastHtml = "";
  global.HtmlService = {
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL", DEFAULT: "DEFAULT" },
    createHtmlOutput: function (html) {
      lastHtml = html;
      return {
        content: html,
        title: "",
        xframe: "",
        setTitle: function (title) { this.title = title; return this; },
        setXFrameOptionsMode: function (mode) { this.xframe = mode; return this; }
      };
    }
  };
  global.PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (key) {
          return key === "ADMIN_WEB_APP" ? "true" : "";
        }
      };
    }
  };
  global.createInterviewerAppHtml = adminApp.createInterviewerAppHtml;
  try {
    const output = backendApi.doGet({});
    assert.ok(output.content.indexOf("面接官向け 発行コード管理") !== -1);
    assert.ok(output.content.indexOf("jsquiz:v0.6:issue") === -1);
    assert.strictEqual(output.xframe, "DEFAULT");
    assert.ok(lastHtml.indexOf("発行コードを生成する") !== -1);
  } finally {
    global.HtmlService = previousHtml;
    global.PropertiesService = previousProps;
    delete global.createInterviewerAppHtml;
  }
});

test("learner doGet is unchanged when ADMIN_WEB_APP is unset", function () {
  const previousHtml = global.HtmlService;
  const previousProps = global.PropertiesService;
  global.HtmlService = {
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL", DEFAULT: "DEFAULT" },
    createHtmlOutput: function (html) {
      return {
        content: html,
        title: "",
        xframe: "",
        setTitle: function (title) { this.title = title; return this; },
        setXFrameOptionsMode: function (mode) { this.xframe = mode; return this; }
      };
    }
  };
  global.PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (key) {
          return key === "LEARNER_PAGE_ORIGIN" ? "https://owltecrecruiter.github.io" : "";
        }
      };
    }
  };
  try {
    const output = backendApi.doGet({ parameter: { bridgeSession: "bridge-keep-learner" } });
    assert.strictEqual(output.xframe, "ALLOWALL");
    assert.ok(output.content.indexOf("jsquiz:v0.7:ready") !== -1);
    assert.ok(output.content.indexOf("issueWorkFromBridge") !== -1);
    assert.ok(output.content.indexOf("面接官向け") === -1);
  } finally {
    global.HtmlService = previousHtml;
    global.PropertiesService = previousProps;
  }
});

test("public docs do not contain interviewer secrets", function () {
  const docsDir = path.join(__dirname, "..", "..", "docs");
  fs.readdirSync(docsDir).forEach(function (name) {
    if (name === "owl-logo.png") {
      return;
    }
    const text = fs.readFileSync(path.join(docsDir, name), "utf8");
    assert.ok(text.indexOf("INTERVIEWER_ADMIN_PASSWORD") === -1, name);
    assert.ok(text.indexOf("ADMIN_API_TOKEN") === -1, name);
    assert.ok(text.indexOf("CODE_HASH_PEPPER") === -1, name);
  });
});

let failed = 0;
tests.forEach(function (item) {
  try {
    item.fn();
    console.log("PASS " + item.name);
  } catch (error) {
    failed += 1;
    console.log("FAIL " + item.name);
    console.log("  " + (error && error.message ? error.message : error));
  }
});

if (failed > 0) {
  console.log(failed + " failed");
  process.exit(1);
}
console.log(tests.length + " interviewer admin tests passed.");
