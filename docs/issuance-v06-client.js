/*
 * JavaScript学習プラットフォーム v0.6
 * GitHub Pages -> public learner-only GAS HTML Service bridge preparation.
 *
 * OWL JS Studio loads this helper from index.html. Configure the public learner
 * GAS Web App URL in studio-config.js at runtime. Do not use a private
 * "only myself" Web App as the GitHub Pages learner bridge.
 */
(function (root) {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 30000;
  var ISSUE_TYPE = "jsquiz:v0.6:issue";
  var RESULT_TYPE = "jsquiz:v0.6:result";
  var ERROR_TYPE = "jsquiz:v0.6:error";
  var READY_TYPE = "jsquiz:v0.7:ready";
  var AUTH_TYPE = "jsquiz:v0.8:auth";
  var AUTH_RESULT_TYPE = "jsquiz:v0.8:auth-result";
  var AUTH_ERROR_TYPE = "jsquiz:v0.8:auth-error";

  function createGasBridgeClient(options) {
    var config = options || {};
    var bridgeUrl = config.bridgeUrl || "";
    var bridgeOrigin = bridgeUrl ? new URL(bridgeUrl).origin : "";
    var postTargetOrigin = config.postTargetOrigin || config.targetOrigin || bridgeOrigin;
    var allowedReplyOrigins = createAllowedReplyOrigins(config, postTargetOrigin);
    var timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    var frameTitle = config.frameTitle || "JavaScript学習プラットフォーム発行ブリッジ";
    var frameContainer = config.frameContainer || null;
    var inFlight = {};

    return {
      isConfigured: function () {
        return bridgeUrl !== "" && postTargetOrigin !== "" && allowedReplyOrigins.length > 0;
      },
      verifyAccessCode: function (input) {
        var request = input || {};
        if (!bridgeUrl) {
          return Promise.reject(new Error("GAS bridge URL is not configured."));
        }
        var requestId = request.requestId || createBrowserRequestId();
        return postToBridge({
          type: AUTH_TYPE,
          resultType: AUTH_RESULT_TYPE,
          errorType: AUTH_ERROR_TYPE,
          requestId: requestId,
          payload: {
            code: request.code,
            requestId: requestId
          }
        });
      },
      issueCurrentQuiz: function (input) {
        var request = input || {};
        if (!bridgeUrl) {
          return Promise.reject(new Error("GAS bridge URL is not configured."));
        }
        if (typeof root.getLastValidQuizData !== "function") {
          return Promise.reject(new Error("getLastValidQuizData() is unavailable."));
        }

        var quizData = root.getLastValidQuizData();
        if (!quizData) {
          return Promise.reject(new Error("No validated quiz data is available."));
        }

        var requestId = request.requestId || createBrowserRequestId();
        var payload = {
          code: request.code,
          requestId: requestId,
          email: request.email || "",
          quizData: quizData
        };

        return postToBridge({
          type: ISSUE_TYPE,
          resultType: RESULT_TYPE,
          errorType: ERROR_TYPE,
          requestId: requestId,
          payload: payload
        });
      }
    };

    function postToBridge(options) {
      var requestId = options.requestId;
      var payload = options.payload;
      var messageType = options.type;
      var resultType = options.resultType;
      var errorType = options.errorType;
      return new Promise(function (resolve, reject) {
        if (inFlight[requestId]) {
          reject(new Error("This issuance request is already in progress."));
          return;
        }
        inFlight[requestId] = true;

        var bridgeSession = createBridgeSession();
        var iframe = createBridgeFrame(bridgeSession);
        var trustedBridgeWindow = null;
        var trustedBridgeOrigin = "";
        var payloadSent = false;

        var timeout = root.setTimeout(function () {
          cleanup();
          reject(new Error("GAS bridge response timed out. Confirm the learner bridge is deployed with the v0.7 bridgeSession handshake and not as a private only-myself Web App."));
        }, timeoutMs);

        function onMessage(event) {
          var data = event.data || {};
          if (data.type !== READY_TYPE && data.type !== resultType && data.type !== errorType) {
            return;
          }
          if (!isAllowedReplyOrigin(event.origin)) {
            return;
          }
          if (data.bridgeSession !== bridgeSession) {
            return;
          }
          if (data.type === READY_TYPE) {
            if (!isWindowSource(event.source)) {
              return;
            }
            trustedBridgeWindow = event.source;
            trustedBridgeOrigin = event.origin;
            addOrigin(allowedReplyOrigins, trustedBridgeOrigin);
            sendPayload();
            return;
          }
          if (event.source !== trustedBridgeWindow || event.origin !== trustedBridgeOrigin) {
            return;
          }
          if (data.requestId !== requestId) {
            return;
          }
          if (data.type === resultType) {
            cleanup();
            resolve(data.result);
          } else if (data.type === errorType) {
            cleanup();
            reject(new Error(data.message || "GAS bridge returned an error."));
          }
        }

        function cleanup() {
          root.clearTimeout(timeout);
          root.removeEventListener("message", onMessage);
          delete inFlight[requestId];
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }

        root.addEventListener("message", onMessage);

        function sendPayload() {
          if (payloadSent || !trustedBridgeWindow || !trustedBridgeOrigin) {
            return;
          }
          payloadSent = true;
          trustedBridgeWindow.postMessage({
            type: messageType,
            requestId: requestId,
            bridgeSession: bridgeSession,
            payload: payload
          }, trustedBridgeOrigin);
        }
      });
    }

    function createBridgeFrame(bridgeSession) {
      var iframe = root.document.createElement("iframe");
      iframe.src = appendBridgeSession(bridgeUrl, bridgeSession);
      iframe.title = frameTitle;
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.border = "0";
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.setAttribute("aria-hidden", "true");
      (frameContainer || root.document.body).appendChild(iframe);
      return iframe;
    }

    function isAllowedReplyOrigin(origin) {
      return isAllowedGasBridgeReplyOrigin(origin, bridgeOrigin, allowedReplyOrigins);
    }
  }

  function createBrowserRequestId() {
    if (root.crypto && root.crypto.randomUUID) {
      return root.crypto.randomUUID();
    }
    var randomPart = Math.random().toString(36).slice(2);
    return "browser_" + Date.now().toString(36) + "_" + randomPart;
  }

  function createBridgeSession() {
    if (root.crypto && root.crypto.randomUUID) {
      return "bridge-" + root.crypto.randomUUID();
    }
    var randomPart = Math.random().toString(36).slice(2);
    return "bridge-" + Date.now().toString(36) + "_" + randomPart;
  }

  function appendBridgeSession(bridgeUrl, bridgeSession) {
    var url = new URL(bridgeUrl);
    url.searchParams.set("bridgeSession", bridgeSession);
    url.hash = "bridgeSession=" + encodeURIComponent(bridgeSession);
    return url.href;
  }

  function isScriptGoogleUserContentHost(hostname) {
    var host = String(hostname || "").toLowerCase();
    if (host === "script.googleusercontent.com") {
      return true;
    }
    if (host.endsWith(".script.googleusercontent.com") && host.length > ".script.googleusercontent.com".length) {
      return true;
    }
    return /(?:^|\.)[a-z0-9-]+-script\.googleusercontent\.com$/.test(host);
  }

  function isScriptGoogleUserContentOrigin(origin) {
    try {
      var url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin) {
        return false;
      }
      return isScriptGoogleUserContentHost(url.hostname);
    } catch (error) {
      return false;
    }
  }

  function isAppsScriptWebAppOrigin(origin) {
    try {
      var url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin) {
        return false;
      }
      var host = url.hostname.toLowerCase();
      return host === "script.google.com" || isScriptGoogleUserContentHost(host);
    } catch (error) {
      return false;
    }
  }

  function isAllowedGasBridgeReplyOrigin(origin, webAppOrigin, allowlist) {
    var normalized = "";
    try {
      normalized = normalizeHttpsOrigin(origin);
    } catch (error) {
      return false;
    }
    if (!normalized) {
      return false;
    }
    var list = allowlist || [];
    if (list.indexOf(normalized) !== -1) {
      return true;
    }
    return isAppsScriptWebAppOrigin(webAppOrigin) && isScriptGoogleUserContentOrigin(normalized);
  }

  function isWindowSource(source) {
    return source && typeof source.postMessage === "function";
  }

  function createAllowedReplyOrigins(config, postTargetOrigin) {
    var origins = [];
    addOrigin(origins, postTargetOrigin);
    addOrigin(origins, config.replyOrigin || config.allowedReplyOrigin || "");
    if (Array.isArray(config.replyOrigins)) {
      config.replyOrigins.forEach(function (origin) {
        addOrigin(origins, origin);
      });
    }
    if (Array.isArray(config.allowedReplyOrigins)) {
      config.allowedReplyOrigins.forEach(function (origin) {
        addOrigin(origins, origin);
      });
    }
    return origins;
  }

  function addOrigin(origins, origin) {
    var normalized = normalizeHttpsOrigin(origin);
    if (normalized && origins.indexOf(normalized) === -1) {
      origins.push(normalized);
    }
  }

  function normalizeHttpsOrigin(origin) {
    if (!origin) {
      return "";
    }
    var url = new URL(String(origin));
    if (url.protocol !== "https:") {
      throw new Error("GAS bridge origins must use https.");
    }
    return url.origin;
  }

  var api = {
    createGasBridgeClient: createGasBridgeClient,
    appendBridgeSession: appendBridgeSession,
    isAllowedGasBridgeReplyOrigin: isAllowedGasBridgeReplyOrigin,
    isScriptGoogleUserContentOrigin: isScriptGoogleUserContentOrigin
  };
  root.JSQuizGasBridgeV06 = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
