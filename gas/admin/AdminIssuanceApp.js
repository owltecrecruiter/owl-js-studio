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

  function getOfficialLogoSrc() {
    var uri = "";
    if (root && typeof root.OWL_JS_STUDIO_LOGO_DATA_URI === "string") {
      uri = root.OWL_JS_STUDIO_LOGO_DATA_URI;
    }
    if (uri.indexOf("data:image/") === 0) {
      return uri;
    }
    return "https://owltecrecruiter.github.io/owl-js-studio/owl-logo.png";
  }

  function getStudioUrl() {
    if (root && typeof root.OWL_JS_STUDIO_URL === "string" && root.OWL_JS_STUDIO_URL) {
      return root.OWL_JS_STUDIO_URL;
    }
    return "https://owltecrecruiter.github.io/owl-js-studio/";
  }

  function getStudioQrMarkup() {
    if (root && typeof root.OWL_JS_STUDIO_QR_SVG === "string") {
      return root.OWL_JS_STUDIO_QR_SVG;
    }
    return "";
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/\"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function createInterviewerAppHtml() {
    var logoSrc = escapeAttribute(getOfficialLogoSrc());
    var studioUrl = escapeAttribute(getStudioUrl());
    var qrMarkup = getStudioQrMarkup();
    return [
      "<!DOCTYPE html>",
      "<html lang=\"ja\">",
      "<head>",
      "<meta charset=\"UTF-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
      "<title>OWL JS Studio 発行コード管理</title>",
      "<style>",
      ":root{--bg:#f4f6f8;--card:#ffffff;--text:#1f2937;--muted:#5b6775;--line:#d7dee7;--accent:#1e6bb8;--accent-soft:#e8f2fb}",
      "*{box-sizing:border-box}",
      "html,body{margin:0;min-height:100%;font-family:\"Yu Gothic\",\"Meiryo\",sans-serif;color:var(--text);background:var(--bg)}",
      "body{display:flex;flex-direction:column}",
      "header{display:flex;align-items:center;gap:14px;min-height:72px;padding:12px 28px;background:#fff;border-bottom:1px solid var(--line)}",
      ".header-logo{width:54px;height:auto}",
      "h1{margin:0;font-size:22px;font-weight:700}",
      ".sub{margin:2px 0 0;color:var(--muted);font-size:13px}",
      "main{width:min(1120px,100%);margin:0 auto;padding:32px 24px 48px}",
      ".home-grid{display:grid;grid-template-columns:1.05fr 1.2fr 0.95fr;gap:24px}",
      ".panel{padding:24px;background:var(--card);border:1px solid var(--line);border-radius:12px}",
      ".panel h2{margin:0 0 12px;font-size:18px}",
      ".panel p,.panel li{color:var(--muted);font-size:14px;line-height:1.7}",
      ".panel ol{margin:0;padding-left:18px}",
      ".panel li+li{margin-top:8px}",
      "label{display:block;margin:14px 0 6px;color:var(--muted);font-size:12px;font-weight:700}",
      "input{display:block;width:100%;padding:10px 12px;color:var(--text);background:#fff;border:1px solid #c5d0dc;border-radius:8px;font:inherit}",
      "input:focus{outline:2px solid #75beff;outline-offset:1px;border-color:var(--accent)}",
      "button{font-family:inherit;font-weight:700;border:0;cursor:pointer;border-radius:8px}",
      ".main-button{margin-top:16px;padding:12px 14px;width:100%;color:#fff;background:var(--accent)}",
      ".main-button:hover{background:#185a9c}",
      ".main-button:disabled{color:#9aa8b8;background:#d7dee7;cursor:default}",
      ".sub-button{margin-top:8px;padding:10px 12px;width:100%;color:var(--text);background:var(--accent-soft)}",
      ".status{min-height:1.4em;margin:10px 0 0;color:#8a6d3b;font-size:13px;line-height:1.6}",
      ".status.error{color:#c0342b}",
      ".hidden{display:none}",
      ".code-value{margin:12px 0;padding:12px;color:#146c2e;background:#f3faf4;border:1px solid #b7e0c2;border-radius:8px;font-family:Consolas,\"Courier New\",monospace;font-size:18px;letter-spacing:.04em;word-break:break-all}",
      ".result-title{margin:0 0 12px;color:#146c2e;font-size:16px}",
      "dl{margin:0}",
      "dt{margin-top:8px;color:var(--muted);font-size:12px}",
      "dd{margin:4px 0 0;font-size:14px}",
      ".print-card{margin-top:16px;padding:18px;background:#fff;border:1px solid #222;color:#111}",
      ".print-card .print-logo{width:72px;height:auto;display:block;margin:0 auto 8px}",
      ".print-card h3{margin:0;text-align:center;font-size:16px}",
      ".print-kicker{margin:4px 0 12px;text-align:center;font-size:12px;letter-spacing:.08em}",
      ".print-name{margin:0 0 12px;text-align:center;font-size:15px;font-weight:700}",
      ".print-code{margin:0 0 14px;text-align:center;font-size:20px;letter-spacing:.06em;font-family:Consolas,\"Courier New\",monospace;word-break:break-all}",
      ".print-howto{margin:0 0 10px;font-size:12px;line-height:1.6}",
      ".print-url{margin:0 0 8px;font-size:12px;word-break:break-all}",
      ".print-company{margin:0;font-size:11px;line-height:1.5}",
      ".print-qr{width:84px;height:84px;margin:8px auto 0}",
      ".print-qr svg{width:100%;height:100%}",
      "@media (max-width:900px){.home-grid{grid-template-columns:1fr}header{padding:12px 16px}}",
      "@page{size:105mm 148mm;margin:8mm}",
      "@media print{body{background:#fff;color:#111}.no-print{display:none!important}header,.home-intro,.home-flow,#issue-form,.result-actions,.status{display:none!important}main{width:auto;margin:0;padding:0}#result-view,.panel{display:block!important;border:0;padding:0;background:#fff;box-shadow:none}#print-card{display:block!important;width:89mm;min-height:132mm;margin:0;page-break-inside:avoid}}",
      "</style>",
      "</head>",
      "<body>",
      "<header class=\"no-print\">",
      "<img class=\"header-logo\" src=\"" + logoSrc + "\" alt=\"OWL Technology\">",
      "<div><h1>OWL JS Studio</h1><p class=\"sub\">面接官向け 発行コード管理</p></div>",
      "</header>",
      "<main>",
      "<div class=\"home-grid\">",
      "<section class=\"panel home-intro no-print\">",
      "<h2>プログラミング学習特典</h2>",
      "<p>OWL JS Studio は、応募者がブラウザ上で JavaScript を学び、自分の3択クイズを完成させる学習特典です。</p>",
      "<p>完成したクイズは、登録メールアドレスへ HTML ファイルとして届きます。</p>",
      "</section>",
      "<section class=\"panel\">",
      "<form id=\"issue-form\" novalidate>",
      "<h2>特典コード発行</h2>",
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
      "<p class=\"result-title no-print\">発行コードを作成しました</p>",
      "<dl class=\"no-print\">",
      "<dt>応募者氏名</dt><dd id=\"result-name\"></dd>",
      "<dt>登録メールアドレス</dt><dd id=\"result-email\"></dd>",
      "<dt>発行コード</dt>",
      "</dl>",
      "<p id=\"result-code\" class=\"code-value no-print\"></p>",
      "<article id=\"print-card\" class=\"print-card\">",
      "<img class=\"print-logo\" src=\"" + logoSrc + "\" alt=\"OWL Technology\">",
      "<h3>OWL JS Studio</h3>",
      "<p class=\"print-kicker\">プログラミング学習 特典コード</p>",
      "<p id=\"print-name\" class=\"print-name\"></p>",
      "<p id=\"print-code\" class=\"print-code\"></p>",
      "<p class=\"print-howto\">ご利用方法：下の URL から OWL JS Studio を開き、STEP 1〜5 を進めたあと、CLEAR からこのコードを入力してください。完成したクイズは登録メールへ HTML ファイルで届きます。</p>",
      "<p class=\"print-url\">" + studioUrl + "</p>",
      qrMarkup ? "<div class=\"print-qr\">" + qrMarkup + "</div>" : "",
      "<p class=\"print-company\">株式会社アウルテクノロジー<br>https://owl-tec.co.jp/</p>",
      "</article>",
      "<div class=\"result-actions no-print\">",
      "<button id=\"copy-button\" class=\"main-button\" type=\"button\">コードをコピー</button>",
      "<button id=\"print-button\" class=\"sub-button\" type=\"button\">特典カードを印刷</button>",
      "<button id=\"continue-button\" class=\"sub-button\" type=\"button\">続けて発行する</button>",
      "<p id=\"copy-status\" class=\"status\" aria-live=\"polite\"></p>",
      "</div>",
      "</section>",
      "</section>",
      "<section class=\"panel home-flow no-print\">",
      "<h2>利用の流れ</h2>",
      "<ol>",
      "<li>面接官が特典コードを発行し、必要なら印刷して手渡します。</li>",
      "<li>応募者が OWL JS Studio で学習し、自分のクイズを完成させます。</li>",
      "<li>完成したクイズが、登録メールアドレスへ届きます。</li>",
      "</ol>",
      "</section>",
      "</div>",
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
      "document.getElementById('print-button').addEventListener('click',function(){",
      "window.print();",
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
      "document.getElementById('print-name').textContent=(result.applicantName||'')+' 様';",
      "document.getElementById('print-code').textContent=result.code;",
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
