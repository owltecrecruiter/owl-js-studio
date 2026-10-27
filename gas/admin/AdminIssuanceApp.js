/*
 * OWL JS Studio interviewer issuance app.
 * Deploy this file together with IssuanceBackend.js in a SEPARATE Apps Script
 * project from the public learner bridge. Set ADMIN_WEB_APP=true there.
 *
 * This file is not loaded by GitHub Pages. It contains no passwords.
 */
var OwlJsAdminIssuance = (function (root) {
  "use strict";

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MAX_NAME_LENGTH = 120;
  var MAX_EMAIL_LENGTH = 254;
  var GENERIC_AUTH_ERROR = "認証に失敗しました。";
  var GENERIC_UNAVAILABLE = "この操作は利用できません。";

  function validateInterviewerForm(input) {
    var request = input || {};
    var name = String(request.applicantName || "").trim();
    var email = String(request.email || "").trim();
    var password = String(request.password || "");
    if (!name) {
      return { ok: false, message: "応募者氏名を入力してください。" };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return { ok: false, message: "応募者氏名は120文字以内にしてください。" };
    }
    if (!email) {
      return { ok: false, message: "メールアドレスを入力してください。" };
    }
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      return { ok: false, message: "メールアドレスの形式が不正です。" };
    }
    if (!password) {
      return { ok: false, message: "管理者パスワードを入力してください。" };
    }
    return { ok: true, applicantName: name, email: email, password: password };
  }

  function passwordsMatch(expected, provided) {
    var left = String(expected || "");
    var right = String(provided || "");
    if (!left || !right) {
      return false;
    }
    var max = Math.max(left.length, right.length);
    var diff = left.length ^ right.length;
    var i;
    for (i = 0; i < max; i++) {
      diff = diff | ((left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0));
    }
    return diff === 0;
  }

  function createConfigAdapter() {
    return {
      get: function (key) {
        if (typeof PropertiesService === "undefined" || !PropertiesService.getScriptProperties) {
          return "";
        }
        return PropertiesService.getScriptProperties().getProperty(key) || "";
      }
    };
  }

  function isTruthyProperty(config, key) {
    return String(config.get(key) || "").toLowerCase() === "true";
  }

  function createAdminAuthLimiter(config) {
    var adapter = config || createConfigAdapter();
    return {
      assertAllowed: function () {
        var limit = readPositiveInt(adapter.get("ADMIN_AUTH_ATTEMPT_LIMIT"), 5);
        if (limit <= 0) {
          return true;
        }
        var count = Number(getAuthCache().get(authCacheKey()) || "0");
        if (count >= limit) {
          var error = new Error("試行回数が上限に達しました。時間をおいて再試行してください。");
          error.code = "RATE_LIMITED";
          throw error;
        }
        return true;
      },
      recordFailure: function () {
        var limit = readPositiveInt(adapter.get("ADMIN_AUTH_ATTEMPT_LIMIT"), 5);
        if (limit <= 0) {
          return true;
        }
        var windowSeconds = readPositiveInt(adapter.get("ADMIN_AUTH_ATTEMPT_WINDOW_SECONDS"), 600);
        var cache = getAuthCache();
        var key = authCacheKey();
        cache.put(key, String(Number(cache.get(key) || "0") + 1), windowSeconds);
        return true;
      },
      recordSuccess: function () {
        getAuthCache().remove(authCacheKey());
        return true;
      }
    };
  }

  function getAuthCache() {
    if (typeof CacheService === "undefined" || !CacheService.getScriptCache) {
      return {
        store: {},
        get: function (key) {
          return this.store[key] || "0";
        },
        put: function (key, value) {
          this.store[key] = value;
        },
        remove: function (key) {
          delete this.store[key];
        }
      };
    }
    return CacheService.getScriptCache();
  }

  function authCacheKey() {
    return "owl_interviewer_auth_failures";
  }

  function readPositiveInt(value, defaultValue) {
    var parsed = parseInt(value, 10);
    if (!isFinite(parsed) || parsed < 0) {
      return defaultValue;
    }
    return parsed;
  }

  function generateInterviewerCode(input, overrides) {
    var deps = overrides || {};
    var config = deps.config || createConfigAdapter();
    var core = deps.core || root.JSQuizGasIssuanceV06Internal || root.JSQuizGasIssuanceV06;
    if (isTruthyProperty(config, "PUBLIC_LEARNER_DEPLOYMENT") || !isTruthyProperty(config, "ADMIN_WEB_APP")) {
      throw safeError(GENERIC_UNAVAILABLE, "AUTH_REQUIRED");
    }

    var limiter = deps.authLimiter || createAdminAuthLimiter(config);
    try {
      limiter.assertAllowed();
    } catch (error) {
      throw safeError("試行回数が上限に達しました。時間をおいて再試行してください。", "RATE_LIMITED");
    }

    var form = validateInterviewerForm(input);
    if (form.ok !== true) {
      throw safeError(form.message, "INVALID_REQUEST");
    }

    var expectedPassword = config.get("INTERVIEWER_ADMIN_PASSWORD");
    if (!passwordsMatch(expectedPassword, form.password)) {
      try {
        limiter.recordFailure();
      } catch (error) {}
      if (typeof deps.recordAuthFailure === "function") {
        deps.recordAuthFailure({ reason: "AUTH_REQUIRED" });
      } else {
        logInfo("interviewer_auth_rejected");
      }
      throw safeError(GENERIC_AUTH_ERROR, "AUTH_REQUIRED");
    }

    var generated;
    try {
      if (deps.backend && typeof deps.backend.generateCode === "function") {
        generated = deps.backend.generateCode({
          adminToken: config.get("ADMIN_API_TOKEN"),
          applicantId: form.applicantName,
          email: form.email,
          attendanceConfirmed: true,
          requestId: input && input.requestId ? input.requestId : ""
        });
      } else if (core && typeof core.adminGenerateCode === "function") {
        generated = core.adminGenerateCode({
          adminToken: config.get("ADMIN_API_TOKEN"),
          applicantId: form.applicantName,
          email: form.email,
          attendanceConfirmed: true,
          requestId: input && input.requestId ? input.requestId : ""
        });
      } else {
        throw safeError("発行できませんでした。管理者に連絡してください。", "INVALID_REQUEST");
      }
    } catch (error) {
      if (error && error.code === "AUTH_REQUIRED") {
        throw safeError("発行できませんでした。管理者に連絡してください。", "AUTH_REQUIRED");
      }
      throw error;
    }

    try {
      limiter.recordSuccess();
    } catch (error) {}

    return {
      ok: true,
      applicantName: form.applicantName,
      email: form.email,
      code: generated.code,
      issuedAt: generated.record && generated.record.issuedAt ? generated.record.issuedAt : "",
      codeId: generated.record && generated.record.codeId ? generated.record.codeId : "",
      attendanceConfirmed: true,
      status: generated.record && generated.record.status ? generated.record.status : "valid"
    };
  }

  function safeError(message, code) {
    var error = new Error(message);
    error.code = code || "INVALID_REQUEST";
    return error;
  }

  function logInfo(message) {
    if (typeof Logger !== "undefined" && Logger.log) {
      Logger.log(message);
    } else if (typeof console !== "undefined" && console.log) {
      console.log(message);
    }
  }

  function createInterviewerAppHtml() {
    return [
      "<!DOCTYPE html>",
      "<html lang=\"ja\">",
      "<head>",
      "<meta charset=\"UTF-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
      "<title>OWL JS Studio 発行コード管理</title>",
      "<style>",
      ":root{--chrome-bg:#243044;--editor-bg:#1e1e1e;--sidebar-bg:#1e2736;--border:#314056;--text:#e6edf5;--text-dim:#9aa8b8;--accent:#2b7fc1;--accent-strong:#1e6bb8}",
      "*{box-sizing:border-box}",
      "html,body{margin:0;min-height:100%;font-family:\"Yu Gothic\",\"Meiryo\",sans-serif;color:var(--text);background:var(--editor-bg)}",
      "body{display:flex;flex-direction:column}",
      "header{display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;background:var(--chrome-bg);border-bottom:1px solid var(--border)}",
      "h1{margin:0;font-size:16px;font-weight:700}",
      ".sub{margin:0;color:var(--text-dim);font-size:12px}",
      "main{width:min(480px,100%);margin:32px auto;padding:0 16px 40px}",
      "form,section{padding:16px;background:var(--sidebar-bg);border:1px solid var(--border);border-top:2px solid var(--accent)}",
      "label{display:block;margin:12px 0 6px;color:var(--text-dim);font-size:12px;font-weight:700}",
      "input{display:block;width:100%;padding:8px 10px;color:var(--text);background:#1e1e1e;border:1px solid #3e3e42;font:inherit}",
      "input:focus{outline:2px solid #75beff;outline-offset:1px;border-color:var(--accent)}",
      "button{font-family:inherit;font-weight:700;border:0;cursor:pointer}",
      ".main-button{margin-top:16px;padding:10px 12px;width:100%;color:#fff;background:var(--accent-strong)}",
      ".main-button:hover{background:var(--accent)}",
      ".main-button:disabled{color:#9aa8b8;background:#314056;cursor:default}",
      ".sub-button{margin-top:8px;padding:8px 12px;width:100%;color:var(--text);background:#314056}",
      ".status{min-height:1.4em;margin:10px 0 0;color:#e2c08d;font-size:13px;line-height:1.6}",
      ".status.error{color:#f48771}",
      ".hidden{display:none}",
      ".code-value{margin:12px 0;padding:12px;color:#b5cea8;background:#1f3a24;border:1px solid #3f6b43;font-family:Consolas,\"Courier New\",monospace;font-size:18px;letter-spacing:.04em;word-break:break-all}",
      ".result-title{margin:0 0 12px;color:#b5cea8;font-size:16px}",
      "dl{margin:0}",
      "dt{margin-top:8px;color:var(--text-dim);font-size:12px}",
      "dd{margin:4px 0 0;font-size:14px}",
      "</style>",
      "</head>",
      "<body>",
      "<header><div><h1>OWL JS Studio</h1><p class=\"sub\">面接官向け 発行コード管理</p></div></header>",
      "<main>",
      "<form id=\"issue-form\" novalidate>",
      "<label for=\"applicant-name\">応募者氏名</label>",
      "<input id=\"applicant-name\" name=\"applicantName\" type=\"text\" maxlength=\"120\" autocomplete=\"name\" required>",
      "<label for=\"applicant-email\">メールアドレス</label>",
      "<input id=\"applicant-email\" name=\"email\" type=\"email\" maxlength=\"254\" autocomplete=\"email\" required>",
      "<label for=\"admin-password\">管理者パスワード</label>",
      "<input id=\"admin-password\" name=\"password\" type=\"password\" maxlength=\"200\" autocomplete=\"off\" required>",
      "<p id=\"form-status\" class=\"status\" aria-live=\"polite\"></p>",
      "<button id=\"submit-button\" class=\"main-button\" type=\"submit\">発行コードを生成する</button>",
      "</form>",
      "<section id=\"result-view\" class=\"hidden\">",
      "<p class=\"result-title\">発行コードを作成しました</p>",
      "<dl>",
      "<dt>応募者氏名</dt><dd id=\"result-name\"></dd>",
      "<dt>登録メールアドレス</dt><dd id=\"result-email\"></dd>",
      "<dt>発行コード</dt>",
      "</dl>",
      "<p id=\"result-code\" class=\"code-value\"></p>",
      "<button id=\"copy-button\" class=\"main-button\" type=\"button\">コードをコピー</button>",
      "<button id=\"continue-button\" class=\"sub-button\" type=\"button\">続けて発行する</button>",
      "<p id=\"copy-status\" class=\"status\" aria-live=\"polite\"></p>",
      "</section>",
      "</main>",
      "<script>",
      "(function(){",
      "var form=document.getElementById('issue-form');",
      "var resultView=document.getElementById('result-view');",
      "var nameInput=document.getElementById('applicant-name');",
      "var emailInput=document.getElementById('applicant-email');",
      "var passwordInput=document.getElementById('admin-password');",
      "var submitButton=document.getElementById('submit-button');",
      "var formStatus=document.getElementById('form-status');",
      "var inFlight=false;",
      "form.addEventListener('submit',function(event){",
      "event.preventDefault();",
      "if(inFlight){return;}",
      "var applicantName=nameInput.value.trim();",
      "var email=emailInput.value.trim();",
      "var password=passwordInput.value;",
      "if(!applicantName){showFormError('応募者氏名を入力してください。');nameInput.focus();return;}",
      "if(!email){showFormError('メールアドレスを入力してください。');emailInput.focus();return;}",
      "if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){showFormError('メールアドレスの形式が不正です。');emailInput.focus();return;}",
      "if(!password){showFormError('管理者パスワードを入力してください。');passwordInput.focus();return;}",
      "inFlight=true;",
      "submitButton.disabled=true;",
      "formStatus.className='status';",
      "formStatus.textContent='発行コードを作成しています。';",
      "if(typeof google==='undefined'||!google.script||!google.script.run){",
      "finishWithError('発行サーバーに接続できません。管理者に連絡してください。');",
      "return;",
      "}",
      "google.script.run",
      ".withSuccessHandler(showSuccess)",
      ".withFailureHandler(function(error){finishWithError(error&&error.message?error.message:'発行できませんでした。');})",
      ".generateInterviewerCode({applicantName:applicantName,email:email,password:password});",
      "});",
      "document.getElementById('copy-button').addEventListener('click',function(){",
      "var code=document.getElementById('result-code').textContent;",
      "if(!code){return;}",
      "if(navigator.clipboard&&navigator.clipboard.writeText){",
      "navigator.clipboard.writeText(code).then(function(){document.getElementById('copy-status').textContent='コピーしました。';}).catch(fallbackCopy);",
      "}else{fallbackCopy();}",
      "function fallbackCopy(){var area=document.createElement('textarea');area.value=code;document.body.appendChild(area);area.select();try{document.execCommand('copy');document.getElementById('copy-status').textContent='コピーしました。';}catch(error){document.getElementById('copy-status').textContent='コピーできませんでした。手動でコピーしてください。';}document.body.removeChild(area);}",
      "});",
      "document.getElementById('continue-button').addEventListener('click',function(){",
      "resultView.classList.add('hidden');",
      "form.classList.remove('hidden');",
      "nameInput.value='';",
      "emailInput.value='';",
      "passwordInput.value='';",
      "formStatus.textContent='';",
      "document.getElementById('copy-status').textContent='';",
      "inFlight=false;",
      "submitButton.disabled=false;",
      "nameInput.focus();",
      "});",
      "function showSuccess(result){",
      "inFlight=false;",
      "submitButton.disabled=false;",
      "passwordInput.value='';",
      "if(!result||result.ok!==true||!result.code){showFormError('発行できませんでした。');return;}",
      "document.getElementById('result-name').textContent=result.applicantName||'';",
      "document.getElementById('result-email').textContent=result.email||'';",
      "document.getElementById('result-code').textContent=result.code;",
      "form.classList.add('hidden');",
      "resultView.classList.remove('hidden');",
      "document.getElementById('copy-status').textContent='';",
      "}",
      "function finishWithError(message){",
      "inFlight=false;",
      "submitButton.disabled=false;",
      "showFormError(message);",
      "}",
      "function showFormError(message){",
      "formStatus.className='status error';",
      "formStatus.textContent=message;",
      "}",
      "})();",
      "</script>",
      "</body></html>"
    ].join("");
  }

  var api = {
    validateInterviewerForm: validateInterviewerForm,
    passwordsMatch: passwordsMatch,
    generateInterviewerCode: generateInterviewerCode,
    createInterviewerAppHtml: createInterviewerAppHtml,
    createAdminAuthLimiter: createAdminAuthLimiter
  };

  root.createInterviewerAppHtml = createInterviewerAppHtml;
  root.generateInterviewerCode = generateInterviewerCode;
  root.OwlJsAdminIssuance = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  return api;
})(typeof globalThis !== "undefined" ? globalThis : this);

function generateInterviewerCode() {
  return OwlJsAdminIssuance.generateInterviewerCode.apply(OwlJsAdminIssuance, arguments);
}

function createInterviewerAppHtml() {
  return OwlJsAdminIssuance.createInterviewerAppHtml.apply(OwlJsAdminIssuance, arguments);
}
