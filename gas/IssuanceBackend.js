/*
 * JavaScript学習プラットフォーム v0.6
 * GAS連携・発行管理システム
 *
 * GAS-compatible source. In Apps Script this file can be copied as Code.gs.
 * Local tests inject mock Spreadsheet/Lock/Mail/Drive adapters.
 */
var JSQuizGasIssuanceV06Internal = (function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.JSQuizGasIssuanceV06 = api;
  return api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SHEETS = Object.freeze({
    CODES: "issuance_codes",
    HISTORY: "issuance_history",
    REQUESTS: "issuance_requests"
  });

  var CODE_HEADERS = Object.freeze([
    "codeId",
    "codeHash",
    "applicantId",
    "email",
    "attendanceConfirmed",
    "status",
    "issuedAt",
    "redeemedAt",
    "deliveryStatus",
    "deliveryReference",
    "workId",
    "htmlFileId",
    "disabledAt",
    "disabledBy",
    "disabledReason",
    "updatedAt"
  ]);

  var HISTORY_HEADERS = Object.freeze([
    "eventId",
    "codeId",
    "eventType",
    "requestId",
    "createdAt",
    "details"
  ]);

  var REQUEST_HEADERS = Object.freeze([
    "requestId",
    "codeId",
    "requestHash",
    "status",
    "createdAt",
    "completedAt",
    "resultJson",
    "errorCode"
  ]);

  var CODE_STATUS = Object.freeze({
    VALID: "valid",
    USED: "used",
    DISABLED: "disabled"
  });

  var DELIVERY_STATUS = Object.freeze({
    PENDING: "pending",
    SENT: "sent",
    FAILED: "failed",
    NOT_REQUESTED: "not_requested"
  });

  var REQUEST_STATUS = Object.freeze({
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed"
  });

  var ERROR_CODE = Object.freeze({
    AUTH_REQUIRED: "AUTH_REQUIRED",
    CODE_NOT_FOUND: "CODE_NOT_FOUND",
    CODE_DISABLED: "CODE_DISABLED",
    CODE_USED: "CODE_USED",
    ATTENDANCE_NOT_CONFIRMED: "ATTENDANCE_NOT_CONFIRMED",
    INVALID_EMAIL: "INVALID_EMAIL",
    INVALID_QUIZ_DATA: "INVALID_QUIZ_DATA",
    INVALID_REQUEST: "INVALID_REQUEST",
    REQUEST_CONFLICT: "REQUEST_CONFLICT",
    STORAGE_CONFLICT: "STORAGE_CONFLICT",
    LOCK_UNAVAILABLE: "LOCK_UNAVAILABLE",
    RATE_LIMITED: "RATE_LIMITED",
    OUTPUT_FOLDER_UNAVAILABLE: "OUTPUT_FOLDER_UNAVAILABLE"
  });

  var PRIVILEGE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  var PRIVILEGE_CODE_LENGTH = 8;
  var LEGACY_HEX_CODE_LENGTH = 24;
  var DOWNLOAD_FILE_FALLBACK = "マイクイズ";
  var DOWNLOAD_FILE_TITLE_MAX = 80;
  var DOWNLOAD_FILE_NAME_MAX = 60;
  var DEFAULT_OUTPUT_FOLDER_ID = "1M4LFa1x91dEX4P0Peg8aCGxYVwLGelt9";
  var OUTPUT_FOLDER_UNAVAILABLE_MESSAGE = "成果物の保存先フォルダにアクセスできません。フォルダの共有設定を確認し、学習者用GAS実行アカウントへ編集権限を付与してください。Drive直下には保存しません。";
  var APPLICANT_NAME_MISSING_MESSAGE = "応募者氏名が登録されていないため、成果物を保存できません。面接官の発行内容を確認してください。";
  var CODE_NOT_FOUND_MESSAGE = "発行コードが正しくありません。半角英数字8文字（ハイフン不要）か、以前お渡ししたコードをもう一度確認してください。";

  var QUIZ_LIMITS = Object.freeze({
    questionCount: 3,
    choiceCount: 3,
    maxGameTitleLength: 40,
    maxQuestionLength: 120,
    maxChoiceLength: 80,
    maxRequestIdLength: 120,
    maxApplicantIdLength: 120,
    maxEmailLength: 254,
    maxReasonLength: 300
  });

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

  function IssuanceError(code, message, details) {
    this.name = "IssuanceError";
    this.code = code;
    this.message = message;
    this.details = details || null;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IssuanceError);
    }
  }
  IssuanceError.prototype = Object.create(Error.prototype);
  IssuanceError.prototype.constructor = IssuanceError;

  function createBackend(deps) {
    var options = deps || {};
    var storage = requireDependency(options.storage, "storage");
    var lockManager = requireDependency(options.lockManager, "lockManager");
    var digest = options.digest || createGasDigestAdapter();
    var random = options.random || createGasRandomAdapter(digest);
    var delivery = options.delivery || createGasDriveMailDelivery(options);
    var time = options.time || createTimeAdapter();
    var config = options.config || createGasConfigAdapter();
    var rateLimiter = options.rateLimiter || createNoopRateLimiter();
    var attemptLimiter = options.attemptLimiter || createNoopAttemptLimiter();

    return {
      setup: function () {
        return storage.initSchema();
      },
      generateCode: generateCode,
      verifyCode: verifyCode,
      issueWork: issueWork,
      disableCode: disableCode,
      statusLookup: statusLookup,
      resend: resend
    };

    function generateCode(input) {
      var request = input || {};
      assertAdmin(request.adminToken);
      var applicantId = validateBoundedString(request.applicantId, "applicantId", QUIZ_LIMITS.maxApplicantIdLength);
      var email = validateOptionalEmail(request.email);
      var attendanceConfirmed = request.attendanceConfirmed === true;
      var issuedAt = time.nowIso();
      var attempts = 0;

      return lockManager.acquire("issuance:generate", function () {
        var code;
        var codeHash;
        var codeId;
        do {
          attempts = attempts + 1;
          code = request.code ? normalizeCode(request.code) : random.generateCode();
          codeHash = hashCode(code);
          codeId = request.codeId || ("code_" + random.generateId());
          if (attempts > 5) {
            throw new IssuanceError(ERROR_CODE.STORAGE_CONFLICT, "発行コードの重複を解消できません。");
          }
        } while (storage.findCodeByHash(codeHash) || storage.findCodeById(codeId));

        var row = {
          codeId: codeId,
          codeHash: codeHash,
          applicantId: applicantId,
          email: email,
          attendanceConfirmed: attendanceConfirmed,
          status: CODE_STATUS.VALID,
          issuedAt: issuedAt,
          redeemedAt: "",
          deliveryStatus: DELIVERY_STATUS.NOT_REQUESTED,
          deliveryReference: "",
          workId: "",
          htmlFileId: "",
          disabledAt: "",
          disabledBy: "",
          disabledReason: "",
          updatedAt: issuedAt
        };
        storage.insertCode(row);
        appendHistory(codeId, "code_created", request.requestId || "", {
          applicantId: applicantId,
          emailPresent: email !== "",
          attendanceConfirmed: attendanceConfirmed
        });
        return {
          ok: true,
          code: code,
          record: publicCodeRecord(row)
        };
      });
    }

    function verifyCode(input) {
      var request = input || {};
      var normalizedCode = normalizeCode(request.code);
      var row = findStoredCode(request.code);
      var codeHash = row ? row.codeHash : hashCode(normalizedCode);
      rateLimiter.check({
        action: "verifyCode",
        code: normalizedCode,
        codeHash: codeHash,
        clientKey: request.clientKey || ""
      });
      if (!row) {
        appendRejectedAttempt("", "", ERROR_CODE.CODE_NOT_FOUND, {
          codeHash: codeHash,
          clientKey: request.clientKey || ""
        });
        throw new IssuanceError(ERROR_CODE.CODE_NOT_FOUND, CODE_NOT_FOUND_MESSAGE);
      }
      try {
        validateCodeCanIssue(row);
      } catch (error) {
        appendRejectedAttempt(row.codeId, "", error && error.code ? error.code : ERROR_CODE.INVALID_REQUEST, {
          codeHash: codeHash,
          clientKey: request.clientKey || ""
        });
        throw error;
      }
      return {
        ok: true,
        codeId: row.codeId,
        attendanceConfirmed: row.attendanceConfirmed === true,
        status: row.status
      };
    }

    function issueWork(input) {
      var request = input || {};
      var requestId = "";
      var normalizedCode = "";
      var codeHash = "";
      var email = "";
      try {
        requestId = validateRequestId(request.requestId);
        normalizedCode = normalizeCode(request.code);
        var matchedRow = findStoredCode(request.code);
        codeHash = matchedRow ? matchedRow.codeHash : hashCode(normalizedCode);
        email = validateOptionalEmail(request.email);
      } catch (error) {
        appendRejectedAttempt("", safeRequestId(request.requestId), error && error.code ? error.code : ERROR_CODE.INVALID_REQUEST, {
          codeHash: codeHash,
          clientKey: request.clientKey || "",
          email: request.email || ""
        });
        throw error;
      }
      rateLimiter.check({
        action: "issueWork",
        code: normalizedCode,
        codeHash: codeHash,
        clientKey: request.clientKey || email || ""
      });
      try {
        attemptLimiter.assertAllowed({
          action: "issueWork",
          codeHash: codeHash,
          clientKey: request.clientKey || email || "",
          email: email,
          requestId: requestId
        });
      } catch (error) {
        appendRejectedAttempt("", requestId, error && error.code ? error.code : ERROR_CODE.RATE_LIMITED, {
          codeHash: codeHash,
          clientKey: request.clientKey || "",
          email: email
        });
        throw error;
      }

      return lockManager.acquire("issuance:code:" + codeHash, function () {
        var row = storage.findCodeByHash(codeHash);
        if (!row) {
          row = findStoredCode(request.code);
        }
        if (!row) {
          recordRejectedAttempt("", requestId, ERROR_CODE.CODE_NOT_FOUND, {
            codeHash: codeHash,
            clientKey: request.clientKey || "",
            email: email
          });
          throw new IssuanceError(ERROR_CODE.CODE_NOT_FOUND, CODE_NOT_FOUND_MESSAGE);
        }

        var existingRequest = storage.findRequest(requestId);
        if (existingRequest && existingRequest.codeId !== row.codeId) {
          recordRejectedAttempt(row.codeId, requestId, ERROR_CODE.REQUEST_CONFLICT, {
            codeHash: codeHash,
            clientKey: request.clientKey || "",
            email: email
          });
          throw new IssuanceError(ERROR_CODE.REQUEST_CONFLICT, "requestIdが別の発行コードで使用済みです。");
        }

        var quizData;
        try {
          quizData = validateQuizData(request.quizData);
        } catch (error) {
          recordRejectedAttempt(row.codeId, requestId, error && error.code ? error.code : ERROR_CODE.INVALID_QUIZ_DATA, {
            codeHash: codeHash,
            clientKey: request.clientKey || "",
            email: email
          });
          throw error;
        }
        var requestHash = hashIssueRequest(row.codeId, email, quizData);
        if (existingRequest && existingRequest.requestHash && existingRequest.requestHash !== requestHash) {
          recordRejectedAttempt(row.codeId, requestId, ERROR_CODE.REQUEST_CONFLICT, {
            codeHash: codeHash,
            clientKey: request.clientKey || "",
            email: email
          });
          throw new IssuanceError(ERROR_CODE.REQUEST_CONFLICT, "requestIdが異なる発行内容で使用済みです。");
        }
        if (existingRequest && existingRequest.status === REQUEST_STATUS.COMPLETED) {
          var cached = parseJson(existingRequest.resultJson);
          cached.idempotent = true;
          return cached;
        }
        if (row.status === CODE_STATUS.USED && existingRequest && existingRequest.codeId === row.codeId && row.htmlFileId) {
          var reusedDriveFileName = "";
          try {
            reusedDriveFileName = createDriveFileName(row.applicantId, quizData.gameTitle);
          } catch (error) {
            reusedDriveFileName = "";
          }
          var reused = {
            ok: true,
            codeId: row.codeId,
            applicantId: row.applicantId,
            workId: row.workId,
            fileName: createDownloadFileName(quizData.gameTitle),
            driveFileName: reusedDriveFileName,
            issuedAt: row.redeemedAt || time.nowIso(),
            deliveryStatus: row.deliveryStatus,
            deliveryReference: row.deliveryReference,
            idempotent: true
          };
          storage.updateRequest({
            requestId: requestId,
            codeId: row.codeId,
            requestHash: requestHash,
            status: REQUEST_STATUS.COMPLETED,
            createdAt: existingRequest.createdAt,
            completedAt: time.nowIso(),
            resultJson: stringifyJson(reused),
            errorCode: ""
          });
          return reused;
        }
        try {
          validateCodeCanIssue(row);
        } catch (error) {
          recordRejectedAttempt(row.codeId, requestId, error && error.code ? error.code : ERROR_CODE.INVALID_REQUEST, {
            codeHash: codeHash,
            clientKey: request.clientKey || "",
            email: email
          });
          throw error;
        }

        var mailFileName;
        var driveFileName;
        try {
          mailFileName = createDownloadFileName(quizData.gameTitle);
          driveFileName = createDriveFileName(row.applicantId, quizData.gameTitle);
          if (typeof delivery.assertOutputFolder === "function") {
            delivery.assertOutputFolder();
          }
        } catch (error) {
          recordRejectedAttempt(row.codeId, requestId, error && error.code ? error.code : ERROR_CODE.INVALID_REQUEST, {
            codeHash: codeHash,
            clientKey: request.clientKey || "",
            email: email
          });
          throw error;
        }

        if (!existingRequest) {
          storage.insertRequest({
            requestId: requestId,
            codeId: row.codeId,
            requestHash: requestHash,
            status: REQUEST_STATUS.PENDING,
            createdAt: time.nowIso(),
            completedAt: "",
            resultJson: "",
            errorCode: ""
          });
        }

        try {
          var workId = "work_" + random.generateId();
          var fileName = mailFileName;
          var html = createTrustedStandaloneQuizHtml({
            quizData: quizData,
            issuanceReference: {
              codeId: row.codeId,
              applicantId: row.applicantId,
              workId: workId,
              requestId: requestId
            }
          });
          var issuedAt = time.nowIso();
          row.status = CODE_STATUS.USED;
          row.redeemedAt = issuedAt;
          row.deliveryStatus = DELIVERY_STATUS.PENDING;
          row.deliveryReference = "";
          row.workId = workId;
          row.updatedAt = issuedAt;
          storage.updateCode(row);
          appendHistory(row.codeId, "work_generated", requestId, {
            workId: workId,
            fileName: fileName,
            driveFileName: driveFileName
          });

          var deliveryResult = attemptDelivery(function () {
            return delivery.deliver({
              codeId: row.codeId,
              applicantId: row.applicantId,
              email: email || row.email,
              requestId: requestId,
              workId: workId,
              fileName: fileName,
              mailFileName: mailFileName,
              driveFileName: driveFileName,
              existingFileId: row.htmlFileId || "",
              gameTitle: quizData.gameTitle,
              html: html
            });
          });

          row.deliveryStatus = deliveryResult.ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED;
          row.deliveryReference = deliveryResult.reference || "";
          row.htmlFileId = deliveryResult.fileId || "";
          row.updatedAt = time.nowIso();
          storage.updateCode(row);
          appendHistory(row.codeId, deliveryResult.ok ? "delivery_sent" : "delivery_failed", requestId, {
            reference: row.deliveryReference,
            fileId: row.htmlFileId,
            errorMessage: deliveryResult.errorMessage || ""
          });

          var result = {
            ok: true,
            codeId: row.codeId,
            applicantId: row.applicantId,
            workId: workId,
            fileName: fileName,
            driveFileName: driveFileName,
            issuedAt: issuedAt,
            deliveryStatus: row.deliveryStatus,
            deliveryReference: row.deliveryReference,
            idempotent: false
          };
          storage.updateRequest({
            requestId: requestId,
            codeId: row.codeId,
            requestHash: requestHash,
            status: REQUEST_STATUS.COMPLETED,
            createdAt: existingRequest ? existingRequest.createdAt : issuedAt,
            completedAt: time.nowIso(),
            resultJson: stringifyJson(result),
            errorCode: ""
          });
          try {
            attemptLimiter.recordSuccess({
              action: "issueWork",
              codeHash: codeHash,
              clientKey: request.clientKey || email || "",
              email: email,
              requestId: requestId
            });
          } catch (error) {
            logInfo("attemptLimiter.recordSuccess failed: " + (error && error.message ? error.message : String(error)));
          }
          return result;
        } catch (error) {
          storage.updateRequest({
            requestId: requestId,
            codeId: row.codeId,
            requestHash: existingRequest && existingRequest.requestHash ? existingRequest.requestHash : requestHash,
            status: REQUEST_STATUS.FAILED,
            createdAt: existingRequest ? existingRequest.createdAt : time.nowIso(),
            completedAt: time.nowIso(),
            resultJson: "",
            errorCode: error && error.code ? error.code : ERROR_CODE.INVALID_REQUEST
          });
          throw error;
        }
      });
    }

    function disableCode(input) {
      var request = input || {};
      assertAdmin(request.adminToken);
      var reason = validateOptionalBoundedString(request.reason, "reason", QUIZ_LIMITS.maxReasonLength) || "No reason provided";
      var disabledBy = validateOptionalBoundedString(request.disabledBy, "disabledBy", 120) || "admin";
      var row = resolveCodeForAdmin(request);

      return lockManager.acquire("issuance:code:" + row.codeHash, function () {
        var current = storage.findCodeByHash(row.codeHash);
        if (!current) {
          throw new IssuanceError(ERROR_CODE.CODE_NOT_FOUND, "発行コードが見つかりません。");
        }
        current.status = CODE_STATUS.DISABLED;
        current.disabledAt = time.nowIso();
        current.disabledBy = disabledBy;
        current.disabledReason = reason;
        current.updatedAt = time.nowIso();
        storage.updateCode(current);
        appendHistory(current.codeId, "code_disabled", request.requestId || "", {
          disabledBy: disabledBy,
          reason: reason
        });
        return {
          ok: true,
          record: publicCodeRecord(current)
        };
      });
    }

    function statusLookup(input) {
      var request = input || {};
      assertAdmin(request.adminToken);
      var row = resolveCodeForAdmin(request);
      return {
        ok: true,
        record: publicCodeRecord(row),
        history: storage.listHistoryByCodeId(row.codeId),
        requests: storage.listRequestsByCodeId(row.codeId)
      };
    }

    function resend(input) {
      var request = input || {};
      assertAdmin(request.adminToken);
      var requestId = validateRequestId(request.requestId || request.deliveryRequestId);
      var row = resolveCodeForAdmin(request);
      var email = validateOptionalEmail(request.email) || row.email;
      if (!email) {
        throw new IssuanceError(ERROR_CODE.INVALID_EMAIL, "再送先メールアドレスが必要です。");
      }

      return lockManager.acquire("issuance:code:" + row.codeHash, function () {
        var current = storage.findCodeByHash(row.codeHash);
        if (!current || !current.workId || !current.htmlFileId) {
          throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, "再送できる発行済み作品がありません。");
        }
        appendHistory(current.codeId, "delivery_retry_requested", requestId, {
          workId: current.workId
        });
        var result = delivery.resend({
          codeId: current.codeId,
          applicantId: current.applicantId,
          email: email,
          requestId: requestId,
          workId: current.workId,
          fileId: current.htmlFileId,
          mailFileName: findGeneratedMailFileName(current.codeId),
          previousReference: current.deliveryReference
        });
        current.deliveryStatus = result.ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED;
        current.deliveryReference = result.reference || current.deliveryReference || "";
        current.updatedAt = time.nowIso();
        storage.updateCode(current);
        appendHistory(current.codeId, result.ok ? "delivery_resent" : "delivery_failed", requestId, {
          reference: current.deliveryReference,
          errorMessage: result.errorMessage || ""
        });
        return {
          ok: result.ok,
          codeId: current.codeId,
          workId: current.workId,
          deliveryStatus: current.deliveryStatus,
          deliveryReference: current.deliveryReference
        };
      });
    }

    function resolveCodeForAdmin(request) {
      var row = null;
      if (request.codeId) {
        row = storage.findCodeById(validateBoundedString(request.codeId, "codeId", 160));
      } else if (request.codeHash) {
        row = storage.findCodeByHash(validateBoundedString(request.codeHash, "codeHash", 128));
      } else if (request.code) {
        row = findStoredCode(request.code);
      }
      if (!row) {
        throw new IssuanceError(ERROR_CODE.CODE_NOT_FOUND, CODE_NOT_FOUND_MESSAGE);
      }
      return row;
    }

    function findStoredCode(rawCode) {
      var candidates = codeLookupCandidates(rawCode);
      var i;
      for (i = 0; i < candidates.length; i++) {
        var row = storage.findCodeByHash(hashCode(candidates[i]));
        if (row) {
          return row;
        }
      }
      return null;
    }

    function hashCode(code) {
      var pepper = config.get("CODE_HASH_PEPPER") || "";
      return digest.sha256("JSQUIZ_V06_CODE:" + pepper + ":" + normalizeCode(code));
    }

    function hashIssueRequest(codeId, email, quizData) {
      var pepper = config.get("CODE_HASH_PEPPER") || "";
      return digest.sha256("JSQUIZ_V06_REQUEST:" + pepper + ":" + stringifyJson({
        codeId: codeId,
        email: email || "",
        quizData: quizData
      }));
    }

    function assertAdmin(adminToken) {
      var expected = config.get("ADMIN_API_TOKEN");
      if (!expected || String(adminToken || "") !== expected) {
        throw new IssuanceError(ERROR_CODE.AUTH_REQUIRED, "管理者権限が必要です。");
      }
    }

    function appendHistory(codeId, eventType, requestId, details) {
      try {
        storage.appendHistory({
          eventId: "evt_" + random.generateId(),
          codeId: codeId || "",
          eventType: eventType,
          requestId: requestId || "",
          createdAt: time.nowIso(),
          details: stringifyJson(details || {})
        });
      } catch (error) {
        if (typeof storage.appendHistoryFailure === "function") {
          storage.appendHistoryFailure({
            codeId: codeId || "",
            eventType: eventType,
            requestId: requestId || "",
            createdAt: time.nowIso(),
            errorMessage: error && error.message ? error.message : String(error)
          });
        }
      }
    }

    function recordRejectedAttempt(codeId, requestId, reason, details) {
      try {
        attemptLimiter.recordFailure({
          action: "issueWork",
          codeHash: details && details.codeHash ? details.codeHash : "",
          clientKey: details && details.clientKey ? details.clientKey : "",
          email: details && details.email ? details.email : "",
          requestId: requestId || "",
          reason: reason
        });
      } catch (error) {
        logInfo("attemptLimiter.recordFailure failed: " + (error && error.message ? error.message : String(error)));
      }
      appendRejectedAttempt(codeId, requestId, reason, details);
    }

    function appendRejectedAttempt(codeId, requestId, reason, details) {
      var safeDetails = {
        reason: reason,
        codeHash: details && details.codeHash ? details.codeHash : "",
        clientKeyHash: details && details.clientKey ? hashAttemptValue(details.clientKey) : "",
        emailHash: details && details.email ? hashAttemptValue(details.email) : "",
        requestIdPresent: Boolean(requestId)
      };
      appendHistory(codeId || "", "code_rejected", requestId || "", safeDetails);
    }

    function hashAttemptValue(value) {
      var pepper = config.get("CODE_HASH_PEPPER") || "";
      return digest.sha256("JSQUIZ_V06_ATTEMPT:" + pepper + ":" + String(value || ""));
    }

    function findGeneratedMailFileName(codeId) {
      var events = storage.listHistoryByCodeId(codeId) || [];
      var i;
      for (i = events.length - 1; i >= 0; i--) {
        if (events[i].eventType !== "work_generated") {
          continue;
        }
        var details = parseJson(events[i].details);
        if (details && details.fileName) {
          return String(details.fileName);
        }
      }
      return "";
    }
  }

  function createSpreadsheetStorage(spreadsheet) {
    return {
      initSchema: initSchema,
      insertCode: function (row) {
        var sheet = getSheet(SHEETS.CODES, CODE_HEADERS);
        if (this.findCodeByHash(row.codeHash) || this.findCodeById(row.codeId)) {
          throw new IssuanceError(ERROR_CODE.STORAGE_CONFLICT, "発行コードが重複しています。");
        }
        sheet.appendRow(toRow(row, CODE_HEADERS));
      },
      updateCode: function (row) {
        updateByColumn(SHEETS.CODES, CODE_HEADERS, "codeId", row.codeId, row);
      },
      findCodeByHash: function (codeHash) {
        return findByColumn(SHEETS.CODES, CODE_HEADERS, "codeHash", codeHash);
      },
      findCodeById: function (codeId) {
        return findByColumn(SHEETS.CODES, CODE_HEADERS, "codeId", codeId);
      },
      appendHistory: function (row) {
        getSheet(SHEETS.HISTORY, HISTORY_HEADERS).appendRow(toRow(row, HISTORY_HEADERS));
      },
      listHistoryByCodeId: function (codeId) {
        return listByColumn(SHEETS.HISTORY, HISTORY_HEADERS, "codeId", codeId);
      },
      insertRequest: function (row) {
        if (this.findRequest(row.requestId)) {
          throw new IssuanceError(ERROR_CODE.STORAGE_CONFLICT, "requestIdが重複しています。");
        }
        getSheet(SHEETS.REQUESTS, REQUEST_HEADERS).appendRow(toRow(row, REQUEST_HEADERS));
      },
      updateRequest: function (row) {
        updateByColumn(SHEETS.REQUESTS, REQUEST_HEADERS, "requestId", row.requestId, row);
      },
      findRequest: function (requestId) {
        return findByColumn(SHEETS.REQUESTS, REQUEST_HEADERS, "requestId", requestId);
      },
      listRequestsByCodeId: function (codeId) {
        return listByColumn(SHEETS.REQUESTS, REQUEST_HEADERS, "codeId", codeId);
      }
    };

    function initSchema() {
      ensureSheet(SHEETS.CODES, CODE_HEADERS);
      ensureSheet(SHEETS.HISTORY, HISTORY_HEADERS);
      ensureSheet(SHEETS.REQUESTS, REQUEST_HEADERS);
      return {
        ok: true,
        sheets: [SHEETS.CODES, SHEETS.HISTORY, SHEETS.REQUESTS]
      };
    }

    function getSheet(name, headers) {
      return ensureSheet(name, headers);
    }

    function ensureSheet(name, headers) {
      var sheet = spreadsheet.getSheetByName(name);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(name);
      }
      var existing = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, headers.length).getValues()[0] : [];
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else if (existing.join("\t") !== headers.join("\t")) {
        throw new IssuanceError(ERROR_CODE.STORAGE_CONFLICT, name + " のヘッダーがv0.6スキーマと一致しません。既存データを確認してください。");
      }
      return sheet;
    }

    function findByColumn(sheetName, headers, columnName, value) {
      var rows = readObjects(sheetName, headers);
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][columnName]) === String(value)) {
          return clone(rows[i]);
        }
      }
      return null;
    }

    function listByColumn(sheetName, headers, columnName, value) {
      var rows = readObjects(sheetName, headers);
      var output = [];
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][columnName]) === String(value)) {
          output.push(clone(rows[i]));
        }
      }
      return output;
    }

    function updateByColumn(sheetName, headers, columnName, value, row) {
      var sheet = ensureSheet(sheetName, headers);
      var values = sheet.getDataRange().getValues();
      var col = headers.indexOf(columnName);
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][col]) === String(value)) {
          sheet.getRange(r + 1, 1, 1, headers.length).setValues([toRow(row, headers)]);
          return;
        }
      }
      throw new IssuanceError(ERROR_CODE.CODE_NOT_FOUND, "更新対象が見つかりません。");
    }

    function readObjects(sheetName, headers) {
      var sheet = ensureSheet(sheetName, headers);
      if (sheet.getLastRow() <= 1) {
        return [];
      }
      var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
      var rows = [];
      for (var r = 0; r < values.length; r++) {
        var object = {};
        for (var c = 0; c < headers.length; c++) {
          object[headers[c]] = values[r][c];
        }
        if (object.codeId || object.requestId || object.eventId) {
          rows.push(object);
        }
      }
      return rows;
    }
  }

  function createGasLockManager() {
    return {
      acquire: function (_key, fn) {
        var lock = LockService.getScriptLock();
        try {
          lock.waitLock(30000);
        } catch (error) {
          throw new IssuanceError(ERROR_CODE.LOCK_UNAVAILABLE, "ロックを取得できませんでした。時間をおいて再試行してください。");
        }
        try {
          return fn();
        } finally {
          lock.releaseLock();
        }
      }
    };
  }

  function createGasDigestAdapter() {
    return {
      sha256: function (text) {
        var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
        var output = "";
        for (var i = 0; i < bytes.length; i++) {
          var value = bytes[i];
          if (value < 0) {
            value += 256;
          }
          output += ("0" + value.toString(16)).slice(-2);
        }
        return output;
      }
    };
  }

  function createGasRandomAdapter(digest) {
    return {
      generateCode: function () {
        var entropy = Utilities.getUuid() + ":" + Utilities.getUuid() + ":" + Utilities.getUuid() + ":" + String(new Date().getTime());
        return createPrivilegeCode(digest, entropy);
      },
      generateId: function () {
        return Utilities.getUuid().replace(/-/g, "").slice(0, 24);
      }
    };
  }

  function createGasDriveMailDelivery(options) {
    var config = options && options.config ? options.config : createGasConfigAdapter();
    return {
      assertOutputFolder: function () {
        getOutputFolder(getDriveApp(), config);
      },
      deliver: function (message) {
        return saveAndMail(message);
      },
      resend: function (message) {
        return mailExisting(message);
      }
    };

    function saveAndMail(message) {
      var drive = getDriveApp();
      var existingFileId = message && (message.existingFileId || message.fileId) ? String(message.existingFileId || message.fileId) : "";
      var file;
      if (existingFileId) {
        try {
          file = drive.getFileById(existingFileId);
        } catch (error) {
          throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
        }
      } else {
        var folder = getOutputFolder(drive, config);
        var driveFileName = message.driveFileName || createDriveFileName(message.applicantId, message.gameTitle);
        var blob = Utilities.newBlob(message.html, "text/html", driveFileName);
        try {
          file = folder.createFile(blob);
        } catch (error) {
          throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
        }
      }
      if (!file || typeof file.getId !== "function") {
        throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
      }
      return mailExisting({
        email: message.email,
        workId: message.workId,
        mailFileName: resolveMailFileName(message, file),
        gameTitle: message.gameTitle,
        fileId: file.getId(),
        requestId: message.requestId,
        html: message.html
      });
    }

    function mailExisting(message) {
      if (!message.email) {
        return {
          ok: false,
          reference: "mail:not-sent",
          fileId: message.fileId || "",
          errorMessage: "email is empty"
        };
      }
      var file = getDriveApp().getFileById(message.fileId);
      var attachment;
      try {
        attachment = file.getBlob();
        attachment.setName(resolveMailFileName(message, file));
      } catch (error) {
        return {
          ok: false,
          reference: "mail:failed:" + message.requestId,
          fileId: message.fileId,
          errorMessage: error && error.message ? error.message : "attachment read failed"
        };
      }
      if (!isAttachmentSizeAllowed(attachment)) {
        return {
          ok: false,
          reference: "mail:failed:" + message.requestId,
          fileId: message.fileId,
          errorMessage: "HTML attachment exceeds the mail size limit"
        };
      }
      try {
        MailApp.sendEmail({
          to: message.email,
          subject: COMPLETED_QUIZ_MAIL_SUBJECT,
          body: buildCompletedQuizMailBody({
            fileName: attachment.getName()
          }),
          attachments: [attachment]
        });
      } catch (error) {
        return {
          ok: false,
          reference: "mail:failed:" + message.requestId,
          fileId: message.fileId,
          errorMessage: error && error.message ? error.message : "mail send failed"
        };
      }
      return {
        ok: true,
        reference: "mail:" + message.requestId,
        fileId: message.fileId
      };
    }
  }

  var COMPLETED_QUIZ_MAIL_SUBJECT = "【OWL JS Studio】完成したクイズをお届けします";
  var MAIL_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

  function buildCompletedQuizMailBody(details) {
    var fileName = details && details.fileName ? String(details.fileName) : "quiz.html";
    return [
      "OWL JS Studioの学習、お疲れさまでした。",
      "",
      "全STEPをクリアし、オリジナルの3択クイズが完成しました。",
      "完成したクイズを、HTMLファイル（" + fileName + "）としてこのメールに添付しています。",
      "",
      "【添付ファイルの開き方】",
      "1. 添付された .html ファイルを保存します。",
      "2. 保存したファイルをブラウザで開きます。",
      "3. インターネット接続がなくても、そのファイルだけでクイズを遊べます。",
      "",
      "株式会社アウルテクノロジー",
      "公式ホームページ: https://owl-tec.co.jp/"
    ].join("\n");
  }

  function isAttachmentSizeAllowed(blob) {
    if (!blob || typeof blob.getBytes !== "function") {
      return true;
    }
    try {
      return blob.getBytes().length <= MAIL_ATTACHMENT_MAX_BYTES;
    } catch (error) {
      return true;
    }
  }

  function createGasConfigAdapter() {
    return {
      get: function (key) {
        return PropertiesService.getScriptProperties().getProperty(key) || "";
      }
    };
  }

  function createTimeAdapter() {
    return {
      nowIso: function () {
        return new Date().toISOString();
      }
    };
  }

  function createNoopRateLimiter() {
    return {
      check: function () {
        return true;
      }
    };
  }

  function createNoopAttemptLimiter() {
    return {
      assertAllowed: function () {
        return true;
      },
      recordFailure: function () {
        return true;
      },
      recordSuccess: function () {
        return true;
      }
    };
  }

  function createGasAttemptLimiter(config, digest) {
    var gasConfig = config || createGasConfigAdapter();
    var gasDigest = digest || createGasDigestAdapter();
    return {
      assertAllowed: function (attempt) {
        var limit = readPositiveInt(gasConfig.get("ISSUANCE_ATTEMPT_LIMIT"), 5);
        if (limit <= 0) {
          return true;
        }
        var cache = getAttemptCache();
        var count = Number(cache.get(attemptCacheKey(attempt)) || "0");
        if (count >= limit) {
          throw new IssuanceError(ERROR_CODE.RATE_LIMITED, "発行コードの試行回数が上限に達しました。時間をおいて再試行してください。");
        }
        return true;
      },
      recordFailure: function (attempt) {
        var limit = readPositiveInt(gasConfig.get("ISSUANCE_ATTEMPT_LIMIT"), 5);
        if (limit <= 0) {
          return true;
        }
        var windowSeconds = readPositiveInt(gasConfig.get("ISSUANCE_ATTEMPT_WINDOW_SECONDS"), 600);
        var cache = getAttemptCache();
        var key = attemptCacheKey(attempt);
        var count = Number(cache.get(key) || "0") + 1;
        cache.put(key, String(count), windowSeconds);
        return true;
      },
      recordSuccess: function (attempt) {
        getAttemptCache().remove(attemptCacheKey(attempt));
        return true;
      }
    };

    function getAttemptCache() {
      if (typeof CacheService === "undefined" || !CacheService.getScriptCache) {
        return {
          get: function () {
            return "0";
          },
          put: function () {},
          remove: function () {}
        };
      }
      return CacheService.getScriptCache();
    }

    function attemptCacheKey(attempt) {
      var normalized = {
        action: attempt && attempt.action ? String(attempt.action) : "",
        codeHash: attempt && attempt.codeHash ? String(attempt.codeHash) : "",
        clientKey: attempt && attempt.clientKey ? String(attempt.clientKey) : "",
        email: attempt && attempt.email ? String(attempt.email) : ""
      };
      return "issuance_attempt:" + gasDigest.sha256("JSQUIZ_V06_ATTEMPT_KEY:" + stringifyJson(normalized)).slice(0, 80);
    }
  }

  function createDefaultGasBackend() {
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    var config = createGasConfigAdapter();
    var digest = createGasDigestAdapter();
    return createBackend({
      storage: createSpreadsheetStorage(spreadsheet),
      lockManager: createGasLockManager(),
      config: config,
      digest: digest,
      attemptLimiter: createGasAttemptLimiter(config, digest)
    });
  }

  function doGet(e) {
    var config = createGasConfigAdapter();
    if (isAdminWebApp(config)) {
      return serveInterviewerAdminApp();
    }
    var html = createLearnerBridgeHtml({
      allowedOrigin: config.get("LEARNER_PAGE_ORIGIN"),
      bridgeSession: extractBridgeSession(e)
    });
    return HtmlService.createHtmlOutput(html)
      .setTitle("JavaScript学習プラットフォーム 発行")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  function serveInterviewerAdminApp() {
    var htmlBuilder = resolveInterviewerHtmlBuilder();
    var html = htmlBuilder
      ? htmlBuilder()
      : "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\"><title>発行コード管理</title></head><body><p>面接官用画面のファイルが不足しています。</p></body></html>";
    var output = HtmlService.createHtmlOutput(html).setTitle("OWL JS Studio 発行コード管理");
    if (HtmlService.XFrameOptionsMode && HtmlService.XFrameOptionsMode.DEFAULT) {
      output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
    }
    return output;
  }

  function resolveInterviewerHtmlBuilder() {
    var g = typeof globalThis !== "undefined" ? globalThis : null;
    if (g && typeof g.createInterviewerAppHtml === "function") {
      return g.createInterviewerAppHtml;
    }
    return null;
  }

  function doPost(e) {
    return jsonOutput(errorResponse(new IssuanceError(
      ERROR_CODE.INVALID_REQUEST,
      "Public JSON API is disabled. Use the HTML Service bridge served by doGet()."
    )));
  }

  function assertAdminCallable(input, functionName) {
    var config = createGasConfigAdapter();
    if (isPublicLearnerDeployment(config)) {
      throw new IssuanceError(ERROR_CODE.AUTH_REQUIRED, functionName + " is disabled in PUBLIC_LEARNER_DEPLOYMENT.");
    }
    var expected = config.get("ADMIN_API_TOKEN");
    if (!expected || String((input || {}).adminToken || "") !== expected) {
      throw new IssuanceError(ERROR_CODE.AUTH_REQUIRED, "管理者権限が必要です。");
    }
  }

  function assertEditorTestHelperAllowed(properties) {
    var config = {
      get: function (key) {
        return properties.getProperty(key) || "";
      }
    };
    if (isPublicLearnerDeployment(config)) {
      throw new IssuanceError(ERROR_CODE.AUTH_REQUIRED, "testGenerateCode is disabled in PUBLIC_LEARNER_DEPLOYMENT.");
    }
    if (config.get("ENABLE_GAS_EDITOR_TEST_HELPERS") !== "true") {
      throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, "testGenerateCode is disabled. Set ENABLE_GAS_EDITOR_TEST_HELPERS=true only for editor-only testing.");
    }
  }

  function isPublicLearnerDeployment(config) {
    return String(config.get("PUBLIC_LEARNER_DEPLOYMENT") || "").toLowerCase() === "true";
  }

  function isAdminWebApp(config) {
    var adapter = config || createGasConfigAdapter();
    return String(adapter.get("ADMIN_WEB_APP") || "").toLowerCase() === "true";
  }

  function setupSpreadsheetSchema(input) {
    assertAdminCallable(input || {}, "setupSpreadsheetSchema");
    return createDefaultGasBackend().setup();
  }

  function adminGenerateCode(input) {
    assertAdminCallable(input || {}, "adminGenerateCode");
    return createDefaultGasBackend().generateCode(input);
  }

  function testGenerateCode() {
    var properties = PropertiesService.getScriptProperties();
    assertEditorTestHelperAllowed(properties);
    var logPlaintextCode = properties.getProperty("LOG_TEST_PLAINTEXT_CODE") === "true";
    var applicantId = "test-applicant-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
    var result = adminGenerateCode({
      adminToken: properties.getProperty("ADMIN_API_TOKEN") || "",
      applicantId: applicantId,
      attendanceConfirmed: true,
      requestId: "test-generate-code-" + new Date().getTime()
    });
    var summary = {
      ok: result.ok,
      codeId: result.record.codeId,
      applicantId: result.record.applicantId,
      attendanceConfirmed: result.record.attendanceConfirmed,
      status: result.record.status,
      issuedAt: result.record.issuedAt
    };

    logInfo("testGenerateCode result: " + stringifyJson(summary));
    if (logPlaintextCode) {
      logInfo("[TEST ONLY] Plaintext generated code: " + result.code);
    } else {
      logInfo("Plaintext code logging is disabled. Set Script Property LOG_TEST_PLAINTEXT_CODE=true only while testing if you need to see it.");
    }
    return summary;
  }

  function adminDisableCode(input) {
    assertAdminCallable(input || {}, "adminDisableCode");
    return createDefaultGasBackend().disableCode(input);
  }

  function adminStatusLookup(input) {
    assertAdminCallable(input || {}, "adminStatusLookup");
    return createDefaultGasBackend().statusLookup(input);
  }

  function adminResend(input) {
    assertAdminCallable(input || {}, "adminResend");
    return createDefaultGasBackend().resend(input);
  }

  function createLearnerBridgeHtml(options) {
    var allowedOrigin = (options && options.allowedOrigin) || "";
    var bridgeSession = sanitizeBridgeSession((options && options.bridgeSession) || "");
    var serializedAllowedOrigin = safeSerializeForInlineScript(allowedOrigin);
    var serializedBridgeSession = safeSerializeForInlineScript(bridgeSession);
    return "<!DOCTYPE html>\n" +
      "<html lang=\"ja\">\n" +
      "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>作品発行</title></head>\n" +
      "<body>\n" +
      "<main><h1>作品発行</h1><p id=\"status\">GitHub Pagesからの発行データを待っています。</p></main>\n" +
      "<script>\n" +
      createLearnerBridgeClientScript(serializedAllowedOrigin, serializedBridgeSession) +
      "</script>\n" +
      "</body></html>";
  }

  function createLearnerBridgeClientScript(serializedAllowedOrigin, serializedBridgeSession) {
    return [
      "'use strict';",
      "const allowedOrigin=" + serializedAllowedOrigin + ";",
      "const injectedBridgeSession=" + serializedBridgeSession + ";",
      "const bridgeVersion='v0.7-connectivity-diagnostics';",
      "const statusEl = document.getElementById('status');",
      "let bridgeSession = injectedBridgeSession;",
      "let readyPosted = false;",
      "resolveBridgeSessionAndPostReady();",
      "window.addEventListener('message', function (event) {",
      "  const data = event.data || {};",
      "  if (data.type !== 'jsquiz:v0.6:issue' && data.type !== 'jsquiz:v0.7:ping') { return; }",
      "  postBridgeDiagnostic('message_received', { receivedType: String(data.type || ''), hasRequestId: Boolean(data.requestId), hasBridgeSession: Boolean(data.bridgeSession), learnerOriginConfigured: Boolean(allowedOrigin), messageOrigin: event.origin || '' });",
      "  if (!allowedOrigin || event.origin !== allowedOrigin) { statusEl.textContent = '許可されていない送信元です。'; postBridgeDiagnostic('origin_rejected', { receivedType: String(data.type || ''), learnerOriginConfigured: Boolean(allowedOrigin), messageOrigin: event.origin || '' }); return; }",
      "  if (bridgeSession && data.bridgeSession !== bridgeSession) { statusEl.textContent = 'bridge session が一致しません。'; postBridgeDiagnostic('bridge_session_rejected', { receivedType: String(data.type || ''), hasBridgeSession: Boolean(data.bridgeSession) }); return; }",
      "  if (data.type === 'jsquiz:v0.7:ping') { statusEl.textContent = '接続確認に応答しました。'; postToLearner({ type: 'jsquiz:v0.7:pong', requestId: data.requestId || '', bridgeSession: bridgeSession, ok: true, timestamp: new Date().toISOString(), observedOrigin: event.origin, locationOrigin: safeLocationOrigin(), learnerOriginConfigured: Boolean(allowedOrigin), bridgeVersion: bridgeVersion }); return; }",
      "  statusEl.textContent = '発行処理中です...';",
      "  google.script.run",
      "    .withSuccessHandler(function (result) { statusEl.textContent = result.deliveryStatus === 'sent' ? '発行しました。メールを確認してください。' : '発行しましたが、配送に失敗しました。管理者に連絡してください。'; postToLearner({ type: 'jsquiz:v0.6:result', requestId: data.requestId || '', bridgeSession: bridgeSession, result: result }); })",
      "    .withFailureHandler(function (error) { statusEl.textContent = '発行できませんでした。'; postToLearner({ type: 'jsquiz:v0.6:error', requestId: data.requestId || '', bridgeSession: bridgeSession, message: error && error.message ? error.message : String(error) }); })",
      "    .issueWorkFromBridge(data.payload || {});",
      "});",
      "function resolveBridgeSessionAndPostReady() {",
      "  const fromLocation = readBridgeSessionFromBrowserLocation();",
      "  if (fromLocation) { bridgeSession = fromLocation; postBridgeReadyOnce('location'); return; }",
      "  if (injectedBridgeSession) { postBridgeReadyOnce('injected'); return; }",
      "  if (typeof google !== 'undefined' && google.script && google.script.url && typeof google.script.url.getLocation === 'function') {",
      "    let settled = false;",
      "    try {",
      "      google.script.url.getLocation(function (location) {",
      "        if (settled) { return; }",
      "        settled = true;",
      "        const fromGasUrl = readBridgeSessionFromGasUrlLocation(location);",
      "        if (fromGasUrl) { bridgeSession = fromGasUrl; }",
      "        postBridgeReadyOnce(fromGasUrl ? 'gasUrl' : 'empty');",
      "      });",
      "      setTimeout(function () {",
      "        if (settled) { return; }",
      "        settled = true;",
      "        postBridgeReadyOnce(bridgeSession ? 'injected' : 'empty');",
      "      }, 1500);",
      "      return;",
      "    } catch (error) {}",
      "  }",
      "  postBridgeReadyOnce(bridgeSession ? 'injected' : 'empty');",
      "}",
      "function postBridgeReadyOnce(sessionSource) {",
      "  if (readyPosted) { return; }",
      "  readyPosted = true;",
      "  postToLearner({ type: 'jsquiz:v0.7:ready', bridgeSession: bridgeSession, sessionSource: sessionSource || '', ok: true, timestamp: new Date().toISOString(), locationOrigin: safeLocationOrigin(), learnerOriginConfigured: Boolean(allowedOrigin), bridgeVersion: bridgeVersion });",
      "}",
      "function postBridgeDiagnostic(code, details) {",
      "  postToLearner({ type: 'jsquiz:v0.7:diagnostic', code: code, bridgeSession: bridgeSession, timestamp: new Date().toISOString(), locationOrigin: safeLocationOrigin(), learnerOriginConfigured: Boolean(allowedOrigin), bridgeVersion: bridgeVersion, details: details || {} });",
      "}",
      "function postToLearner(message) {",
      "  if (!allowedOrigin || allowedOrigin === '*') { return; }",
      "  const targets = [];",
      "  addTarget(targets, window.parent);",
      "  addTarget(targets, window.top);",
      "  try { if (window.parent && window.parent.parent) { addTarget(targets, window.parent.parent); } } catch (error) {}",
      "  for (let i = 0; i < targets.length; i++) {",
      "    try { targets[i].postMessage(message, allowedOrigin); } catch (error) {}",
      "  }",
      "}",
      "function addTarget(targets, target) {",
      "  if (!target) { return; }",
      "  for (let i = 0; i < targets.length; i++) { if (targets[i] === target) { return; } }",
      "  targets.push(target);",
      "}",
      "function readBridgeSessionFromBrowserLocation() {",
      "  try { return readBridgeSessionFromSearchAndHash(window.location.search, window.location.hash); } catch (error) { return ''; }",
      "}",
      "function readBridgeSessionFromGasUrlLocation(location) {",
      "  if (!location) { return ''; }",
      "  const parameter = location.parameter || {};",
      "  const fromParameter = sanitizeClientBridgeSession(Array.isArray(parameter.bridgeSession) ? parameter.bridgeSession[0] : parameter.bridgeSession);",
      "  if (fromParameter) { return fromParameter; }",
      "  const parameters = location.parameters || {};",
      "  const fromParameters = sanitizeClientBridgeSession(parameters.bridgeSession && parameters.bridgeSession[0]);",
      "  if (fromParameters) { return fromParameters; }",
      "  return readBridgeSessionFromSearchAndHash('', location.hash || '');",
      "}",
      "function readBridgeSessionFromSearchAndHash(search, hash) {",
      "  const fromSearch = readBridgeSessionFromEncodedQuery(search);",
      "  if (fromSearch) { return fromSearch; }",
      "  return readBridgeSessionFromEncodedQuery(hash);",
      "}",
      "function readBridgeSessionFromEncodedQuery(query) {",
      "  const text = String(query || '').replace(/^[?#]/, '');",
      "  if (!text) { return ''; }",
      "  const parts = text.split('&');",
      "  for (let i = 0; i < parts.length; i++) {",
      "    const pair = parts[i].split('=');",
      "    let key = pair[0] || '';",
      "    try { key = decodeURIComponent(key.replace(/\\+/g, ' ')); } catch (error) {}",
      "    if (key !== 'bridgeSession') { continue; }",
      "    let raw = pair.slice(1).join('=');",
      "    try { raw = decodeURIComponent(raw.replace(/\\+/g, ' ')); } catch (error) {}",
      "    return sanitizeClientBridgeSession(raw);",
      "  }",
      "  return '';",
      "}",
      "function sanitizeClientBridgeSession(value) {",
      "  const text = String(value || '').trim();",
      "  if (!text || text.length > 160 || !/^[A-Za-z0-9._~-]+$/.test(text)) { return ''; }",
      "  return text;",
      "}",
      "function safeLocationOrigin() {",
      "  try { return window.location && window.location.origin ? window.location.origin : ''; } catch (error) { return ''; }",
      "}",
      ""
    ].join("\n");
  }

  function extractBridgeSession(e) {
    var value = "";
    try {
      if (e && e.parameter && e.parameter.bridgeSession) {
        value = e.parameter.bridgeSession;
      } else if (e && e.parameters && e.parameters.bridgeSession && e.parameters.bridgeSession.length) {
        value = e.parameters.bridgeSession[0];
      } else if (e && e.queryString) {
        value = readBridgeSessionFromQueryString(e.queryString);
      }
    } catch (error) {
      value = "";
    }
    return sanitizeBridgeSession(value);
  }

  function readBridgeSessionFromQueryString(queryString) {
    var text = String(queryString || "").replace(/^\?/, "");
    if (!text) {
      return "";
    }
    var parts = text.split("&");
    var i;
    for (i = 0; i < parts.length; i++) {
      var pair = parts[i].split("=");
      var key = pair[0] || "";
      var raw = pair.slice(1).join("=");
      try {
        key = decodeURIComponent(key.replace(/\+/g, " "));
        raw = decodeURIComponent(raw.replace(/\+/g, " "));
      } catch (error) {}
      if (key === "bridgeSession") {
        return raw;
      }
    }
    return "";
  }

  function sanitizeBridgeSession(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }
    if (text.length > 160 || !/^[A-Za-z0-9._~-]+$/.test(text)) {
      return "";
    }
    return text;
  }

  function issueWorkFromBridge(payload) {
    if (isAdminWebApp(createGasConfigAdapter())) {
      throw new IssuanceError(ERROR_CODE.AUTH_REQUIRED, "この操作は利用できません。");
    }
    return createDefaultGasBackend().issueWork(payload);
  }

  function jsonOutput(value) {
    return ContentService
      .createTextOutput(stringifyJson(value))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function errorResponse(error) {
    return {
      ok: false,
      error: {
        code: error && error.code ? error.code : ERROR_CODE.INVALID_REQUEST,
        message: error && error.message ? error.message : "Request failed",
        details: error && error.details ? error.details : null
      }
    };
  }

  function logInfo(message) {
    if (typeof Logger !== "undefined" && Logger.log) {
      Logger.log(message);
    } else if (typeof console !== "undefined" && console.log) {
      console.log(message);
    }
  }

  function validateCodeCanIssue(row) {
    if (row.status === CODE_STATUS.DISABLED) {
      throw new IssuanceError(ERROR_CODE.CODE_DISABLED, "この発行コードは無効化されています。");
    }
    if (row.status === CODE_STATUS.USED) {
      throw new IssuanceError(ERROR_CODE.CODE_USED, "この発行コードはすでに使用されています。");
    }
    if (row.status !== CODE_STATUS.VALID) {
      throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, "この発行コードの状態では発行できません。");
    }
    if (row.attendanceConfirmed !== true && row.attendanceConfirmed !== "true") {
      throw new IssuanceError(ERROR_CODE.ATTENDANCE_NOT_CONFIRMED, "出席確認が完了していないため発行できません。");
    }
  }

  function namedColorNames() {
    return Object.keys(NAMED_COLORS).filter(function (name) {
      return name !== "grey";
    }).join(" / ");
  }

  function normalizeWorkColor(value, label) {
    if (typeof value !== "string") {
      throwQuizError(label + "は文字列である必要があります。");
    }
    var trimmed = value.trim();
    if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, trimmed.toLowerCase()) && /^[A-Za-z]+$/.test(trimmed)) {
      return NAMED_COLORS[trimmed.toLowerCase()];
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return "#" + trimmed.slice(1).toLowerCase();
    }
    throwQuizError(label + "は #RRGGBB か、" + namedColorNames() + " のいずれかにしてください。");
  }

  function validateQuizData(data) {
    if (!isPlainObject(data)) {
      throwQuizError("作品データはタイトル・色・3問を含むオブジェクトである必要があります。");
    }
    assertExactKeys(data, ["gameTitle", "backgroundColor", "textColor", "questions"], "作品データ");
    var gameTitle = validateQuizString(data.gameTitle, "gameTitle", QUIZ_LIMITS.maxGameTitleLength);
    var backgroundColor = normalizeWorkColor(data.backgroundColor, "backgroundColor");
    var textColor = normalizeWorkColor(data.textColor, "textColor");
    if (!Array.isArray(data.questions) || data.questions.length !== QUIZ_LIMITS.questionCount) {
      throwQuizError("クイズデータは3問の配列である必要があります。");
    }
    var questions = [];
    var i;
    for (i = 0; i < data.questions.length; i++) {
      var question = data.questions[i];
      if (!isPlainObject(question)) {
        throwQuizError("第" + (i + 1) + "問はオブジェクトである必要があります。");
      }
      assertExactKeys(question, ["question", "choices", "correctIndex"], "第" + (i + 1) + "問");
      var questionText = validateQuizString(question.question, "第" + (i + 1) + "問の問題文", QUIZ_LIMITS.maxQuestionLength);
      if (!Array.isArray(question.choices) || question.choices.length !== QUIZ_LIMITS.choiceCount) {
        throwQuizError("第" + (i + 1) + "問の選択肢は3つ必要です。");
      }
      var choices = [];
      var j;
      for (j = 0; j < question.choices.length; j++) {
        choices.push(validateQuizString(question.choices[j], "第" + (i + 1) + "問の選択肢" + (j + 1), QUIZ_LIMITS.maxChoiceLength));
      }
      if (question.correctIndex !== 0 && question.correctIndex !== 1 && question.correctIndex !== 2) {
        throwQuizError("第" + (i + 1) + "問のcorrectIndexは0/1/2の整数だけです。");
      }
      questions.push({
        question: questionText,
        choices: choices,
        correctIndex: question.correctIndex
      });
    }
    return {
      gameTitle: gameTitle,
      backgroundColor: backgroundColor,
      textColor: textColor,
      questions: questions
    };
  }

  function escapeHtmlText(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function getEmbeddedLogoSrc() {
    var uri = "";
    try {
      if (typeof globalThis !== "undefined" && globalThis && globalThis.OWL_JS_STUDIO_LOGO_DATA_URI) {
        uri = String(globalThis.OWL_JS_STUDIO_LOGO_DATA_URI);
      }
    } catch (error) {
      uri = "";
    }
    if (uri.indexOf("data:image/") === 0) {
      return uri;
    }
    return "";
  }

  function createTrustedStandaloneQuizHtml(input) {
    var work = validateQuizData((input || {}).quizData);
    if (!/^#[0-9a-f]{6}$/.test(work.backgroundColor) || !/^#[0-9a-f]{6}$/.test(work.textColor)) {
      throwQuizError("色の値が安全ではありません。");
    }
    var logoSrc = getEmbeddedLogoSrc();
    var logoHtml = logoSrc
      ? "      <img class=\"studio-logo\" src=\"" + escapeHtmlText(logoSrc) + "\" alt=\"OWL Technology\">\n"
      : "";
    var serializedWork = indentMultiline(safeSerializeForInlineScript(work, true), 4);
    return [
      "<!DOCTYPE html>",
      "<html lang=\"ja\">",
      "<head>",
      "  <meta charset=\"UTF-8\">",
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
      "  <title>" + escapeHtmlText("発行作品 - " + work.gameTitle) + "</title>",
      "  <!-- 画面デザイン -->",
      "  <style>",
      "    * { box-sizing: border-box; }",
      "    body {",
      "      margin: 0;",
      "      min-height: 100vh;",
      "      display: grid;",
      "      place-items: center;",
      "      font-family: 'Yu Gothic', 'Meiryo', sans-serif;",
      "      background: #d9e2ec;",
      "      color: #1f2937;",
      "    }",
      "    main.quiz-surface { width: min(92vw, 520px); }",
      "    .quiz-surface { width: 100%; max-width: 480px; font-family: 'Yu Gothic', 'Meiryo', sans-serif; }",
      "    .quiz-surface .screen { padding: 20px 18px 16px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14), inset 0 0 0 1px rgba(15, 23, 42, 0.18); }",
      "    .quiz-surface .title-screen { text-align: center; }",
      "    .quiz-surface .kicker { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; opacity: 0.72; }",
      "    .quiz-surface .game-title { margin: 0 0 10px; font-size: 26px; line-height: 1.35; font-weight: 700; }",
      "    .quiz-surface .quiz-total { margin: 0 0 18px; font-size: 13px; font-weight: 700; }",
      "    .quiz-surface .question-number { display: inline-block; margin: 0 0 8px; padding: 3px 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; border: 1px solid currentColor; }",
      "    .quiz-surface .question-meter { position: relative; height: 4px; margin: 0 0 14px; overflow: hidden; }",
      "    .quiz-surface .question-meter::before { content: \"\"; position: absolute; inset: 0; background: currentColor; opacity: 0.18; }",
      "    .quiz-surface .question-meter-fill { position: relative; display: block; height: 100%; width: 0; background: currentColor; opacity: 0.55; }",
      "    .quiz-surface .question-text,",
      "    .quiz-surface .result-heading { margin: 0 0 14px; font-size: 18px; line-height: 1.5; font-weight: 700; }",
      "    .quiz-surface .choices { display: grid; gap: 8px; margin-bottom: 12px; }",
      "    .quiz-surface button { font-family: inherit; font-weight: 700; cursor: pointer; }",
      "    .quiz-surface .choice-button,",
      "    .quiz-surface .main-button { width: 100%; color: inherit; background: transparent; border: 1px solid currentColor; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55), 0 0 0 2px rgba(15, 23, 42, 0.28); }",
      "    .quiz-surface .choice-button { padding: 11px 12px; font-size: 14px; text-align: left; }",
      "    .quiz-surface .choice-button:disabled { cursor: not-allowed; opacity: 0.72; }",
      "    .quiz-surface .choice-button.selected { outline: 2px solid currentColor; }",
      "    .quiz-surface .main-button { padding: 12px 14px; font-size: 15px; }",
      "    .quiz-surface .start-button { padding: 14px 16px; font-size: 16px; letter-spacing: 0.08em; border-width: 2px; }",
      "    .quiz-surface .answer-message { min-height: 24px; margin: 0 0 12px; font-size: 15px; font-weight: 700; }",
      "    .quiz-surface .correct { color: #14843c; }",
      "    .quiz-surface .incorrect { color: #c0342b; }",
      "    .quiz-surface .score-label { margin: 0 0 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; opacity: 0.72; }",
      "    .quiz-surface .score-text { margin: 0 0 10px; font-size: 32px; font-weight: 700; line-height: 1.15; }",
      "    .quiz-surface .result-message { margin: 0 0 16px; font-size: 14px; line-height: 1.6; }",
      "    .quiz-surface .result-actions { display: grid; gap: 8px; }",
      "    .quiz-surface .maker-credit { margin: 16px 0 0; font-size: 12px; line-height: 1.45; opacity: 0.78; }",
      "    .quiz-surface .maker-credit-powered { display: block; font-size: 10px; letter-spacing: 0.08em; opacity: 0.82; }",
      "    .quiz-surface .company-legal { display: block; margin-top: 4px; }",
      "    .quiz-surface .maker-credit a { color: inherit; text-decoration: none; font-weight: 600; }",
      "    .quiz-surface .studio-logo { display: block; width: min(168px, 64%); height: auto; margin: 0 auto 10px; }",
      "    .quiz-surface .studio-product-name { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; opacity: 0.8; }",
      "    .quiz-surface .quiz-brand-mark { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; opacity: 0.7; }",
      "    .quiz-surface .result-celebrate { margin: 0 0 10px; font-size: 14px; line-height: 1.6; }",
      "    .quiz-surface .result-company { margin: 0 0 8px; font-size: 12px; line-height: 1.6; opacity: 0.86; }",
      "    .quiz-surface .hidden { display: none; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <main class=\"quiz-surface\">",
      "    <!-- タイトル画面 -->",
      "    <section id=\"title-screen\" class=\"screen title-screen\">",
      logoHtml +
      "      <p class=\"studio-product-name\">OWL JS Studio</p>",
      "      <p class=\"kicker\">3択クイズ</p>",
      "      <h1 id=\"game-title\" class=\"game-title\"></h1>",
      "      <p id=\"quiz-total\" class=\"quiz-total\">全3問</p>",
      "      <button id=\"start-button\" class=\"main-button start-button\" type=\"button\">はじめる</button>",
      "      <p class=\"maker-credit\">",
      "        <span class=\"maker-credit-powered\">Powered by OWL Technology</span>",
      "        <span class=\"company-legal\">株式会社アウルテクノロジー</span>",
      "        <a href=\"https://owl-tec.co.jp/\" target=\"_blank\" rel=\"noopener noreferrer\">会社ホームページ</a>",
      "      </p>",
      "    </section>",
      "    <!-- クイズ画面 -->",
      "    <section id=\"quiz-screen\" class=\"screen quiz-screen hidden\">",
      "      <p class=\"quiz-brand-mark\">OWL JS Studio</p>",
      "      <p id=\"question-number\" class=\"question-number\"></p>",
      "      <div class=\"question-meter\" aria-hidden=\"true\"><span id=\"question-meter-fill\" class=\"question-meter-fill\"></span></div>",
      "      <h2 id=\"question-text\" class=\"question-text\"></h2>",
      "      <div class=\"choices\">",
      "        <button id=\"choice-0\" class=\"choice-button\" type=\"button\"></button>",
      "        <button id=\"choice-1\" class=\"choice-button\" type=\"button\"></button>",
      "        <button id=\"choice-2\" class=\"choice-button\" type=\"button\"></button>",
      "      </div>",
      "      <p id=\"answer-message\" class=\"answer-message\" aria-live=\"polite\"></p>",
      "      <button id=\"next-button\" class=\"main-button hidden\" type=\"button\">次の問題へ</button>",
      "    </section>",
      "    <!-- 結果画面 -->",
      "    <section id=\"result-screen\" class=\"screen result-screen hidden\">",
      "      <p class=\"kicker\">結果発表</p>",
      "      <h2 class=\"result-heading\">クイズ終了</h2>",
      "      <p class=\"score-label\">正解数</p>",
      "      <p id=\"score-text\" class=\"score-text\"></p>",
      "      <p id=\"result-message\" class=\"result-message\"></p>",
      "      <div class=\"result-actions\">",
      "        <button id=\"retry-button\" class=\"main-button\" type=\"button\">もう一度挑戦する</button>",
      "        <button id=\"back-to-title-button\" class=\"main-button\" type=\"button\">タイトルへ戻る</button>",
      "      </div>",
      "      <p class=\"result-celebrate\">学習を最後まで進めました。オリジナルクイズの完成、おめでとうございます。</p>",
      "      <p class=\"result-company\">このクイズは、株式会社アウルテクノロジーのプログラミング学習特典「OWL JS Studio」で作成されました。</p>",
      "      <p class=\"maker-credit\"><a href=\"https://owl-tec.co.jp/\" target=\"_blank\" rel=\"noopener noreferrer\">株式会社アウルテクノロジー のホームページ</a></p>",
      "    </section>",
      "  </main>",
      "  <script>",
      "    // ========================================",
      "    // 学習者が作った問題データ",
      "    // gameTitle / backgroundColor / textColor / questions を編集できます",
      "    // questions[].correctIndex は 0 始まりです（0=1番目, 1=2番目, 2=3番目）",
      "    // ========================================",
      "    const quizData = " + serializedWork + ";",
      "",
      "    // ========================================",
      "    // ゲームの状態管理",
      "    // ========================================",
      "    let currentQuestionIndex = 0;",
      "    let correctCount = 0;",
      "    let answered = false;",
      "",
      "    const titleScreen = document.getElementById('title-screen');",
      "    const quizScreen = document.getElementById('quiz-screen');",
      "    const resultScreen = document.getElementById('result-screen');",
      "    const gameTitle = document.getElementById('game-title');",
      "    const questionNumber = document.getElementById('question-number');",
      "    const questionText = document.getElementById('question-text');",
      "    const answerMessage = document.getElementById('answer-message');",
      "    const nextButton = document.getElementById('next-button');",
      "    const scoreText = document.getElementById('score-text');",
      "    const resultMessage = document.getElementById('result-message');",
      "    const startButton = document.getElementById('start-button');",
      "    const retryButton = document.getElementById('retry-button');",
      "    const backToTitleButton = document.getElementById('back-to-title-button');",
      "    const questionMeterFill = document.getElementById('question-meter-fill');",
      "    const choiceButtons = [",
      "      document.getElementById('choice-0'),",
      "      document.getElementById('choice-1'),",
      "      document.getElementById('choice-2')",
      "    ];",
      "",
      "    // ========================================",
      "    // 画面表示処理",
      "    // ========================================",
      "    function applyTheme(node) {",
      "      node.style.backgroundColor = quizData.backgroundColor;",
      "      node.style.color = quizData.textColor;",
      "    }",
      "",
      "    function showOnly(target) {",
      "      titleScreen.classList.toggle('hidden', target !== titleScreen);",
      "      quizScreen.classList.toggle('hidden', target !== quizScreen);",
      "      resultScreen.classList.toggle('hidden', target !== resultScreen);",
      "    }",
      "",
      "    function showTitle() {",
      "      currentQuestionIndex = 0;",
      "      correctCount = 0;",
      "      answered = false;",
      "      gameTitle.textContent = quizData.gameTitle;",
      "      showOnly(titleScreen);",
      "    }",
      "",
      "    function startQuiz() {",
      "      currentQuestionIndex = 0;",
      "      correctCount = 0;",
      "      showQuestion();",
      "    }",
      "",
      "    function showQuestion() {",
      "      const currentQuestion = quizData.questions[currentQuestionIndex];",
      "      answered = false;",
      "      showOnly(quizScreen);",
      "      questionNumber.textContent = '第' + (currentQuestionIndex + 1) + '問 / 全3問';",
      "      if (questionMeterFill) {",
      "        questionMeterFill.style.width = (((currentQuestionIndex + 1) / quizData.questions.length) * 100) + '%';",
      "      }",
      "      questionText.textContent = currentQuestion.question;",
      "      answerMessage.textContent = '';",
      "      answerMessage.className = 'answer-message';",
      "      nextButton.classList.add('hidden');",
      "      nextButton.textContent = currentQuestionIndex === quizData.questions.length - 1 ? '結果を見る' : '次の問題へ';",
      "      for (let i = 0; i < choiceButtons.length; i++) {",
      "        choiceButtons[i].textContent = currentQuestion.choices[i];",
      "        choiceButtons[i].disabled = false;",
      "        choiceButtons[i].classList.remove('selected');",
      "      }",
      "    }",
      "",
      "    function showResult() {",
      "      showOnly(resultScreen);",
      "      scoreText.textContent = correctCount + ' / ' + quizData.questions.length;",
      "      if (correctCount === quizData.questions.length) {",
      "        resultMessage.textContent = '全問正解です。すばらしい！';",
      "      } else if (correctCount >= 2) {",
      "        resultMessage.textContent = 'よくできました。もう一度挑戦して満点を目指しましょう。';",
      "      } else {",
      "        resultMessage.textContent = 'もう一度チャレンジして、JavaScriptに慣れていきましょう。';",
      "      }",
      "    }",
      "",
      "    // ========================================",
      "    // 回答判定",
      "    // ========================================",
      "    function checkAnswer(selectedIndex) {",
      "      if (answered) { return; }",
      "      answered = true;",
      "      choiceButtons[selectedIndex].classList.add('selected');",
      "      if (selectedIndex === quizData.questions[currentQuestionIndex].correctIndex) {",
      "        correctCount = correctCount + 1;",
      "        answerMessage.textContent = '正解！';",
      "        answerMessage.classList.add('correct');",
      "      } else {",
      "        answerMessage.textContent = '不正解';",
      "        answerMessage.classList.add('incorrect');",
      "      }",
      "      for (let i = 0; i < choiceButtons.length; i++) {",
      "        choiceButtons[i].disabled = true;",
      "      }",
      "      nextButton.classList.remove('hidden');",
      "    }",
      "",
      "    function goToNextQuestion() {",
      "      currentQuestionIndex = currentQuestionIndex + 1;",
      "      if (currentQuestionIndex < quizData.questions.length) {",
      "        showQuestion();",
      "      } else {",
      "        showResult();",
      "      }",
      "    }",
      "",
      "    // ========================================",
      "    // イベント登録",
      "    // ========================================",
      "    applyTheme(titleScreen);",
      "    applyTheme(quizScreen);",
      "    applyTheme(resultScreen);",
      "    startButton.addEventListener('click', startQuiz);",
      "    choiceButtons[0].addEventListener('click', function () { checkAnswer(0); });",
      "    choiceButtons[1].addEventListener('click', function () { checkAnswer(1); });",
      "    choiceButtons[2].addEventListener('click', function () { checkAnswer(2); });",
      "    nextButton.addEventListener('click', goToNextQuestion);",
      "    retryButton.addEventListener('click', startQuiz);",
      "    backToTitleButton.addEventListener('click', showTitle);",
      "    showTitle();",
      "  </script>",
      "</body>",
      "</html>"
    ].join("\n");
  }

  function indentMultiline(text, spaces) {
    var pad = new Array(spaces + 1).join(" ");
    return String(text).split("\n").join("\n" + pad);
  }


  function validateOptionalEmail(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return "";
    }
    var email = validateBoundedString(String(value), "email", QUIZ_LIMITS.maxEmailLength);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new IssuanceError(ERROR_CODE.INVALID_EMAIL, "メールアドレスの形式が不正です。");
    }
    return email;
  }

  function validateRequestId(requestId) {
    return validateBoundedString(requestId, "requestId", QUIZ_LIMITS.maxRequestIdLength);
  }

  function safeRequestId(requestId) {
    try {
      return validateRequestId(requestId);
    } catch (error) {
      return "";
    }
  }

  function normalizeCode(code) {
    return validateBoundedString(code, "code", 120).toUpperCase().replace(/\s+/g, "");
  }

  function codeLookupCandidates(code) {
    var normalized = normalizeCode(code);
    var compact = normalized.replace(/-/g, "");
    var list = [];
    addCandidate(list, normalized);
    addCandidate(list, compact);
    if (compact.length === LEGACY_HEX_CODE_LENGTH && /^[0-9A-F]+$/.test(compact)) {
      addCandidate(list, compact.replace(/(.{4})/g, "$1-").replace(/-$/, ""));
    }
    return list;
  }

  function addCandidate(list, value) {
    if (value && list.indexOf(value) === -1) {
      list.push(value);
    }
  }

  function hexToByteValues(hex) {
    var bytes = [];
    var i;
    for (i = 0; i + 1 < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return bytes;
  }

  function createPrivilegeCode(digest, entropy) {
    var hasher = digest || createGasDigestAdapter();
    var alphabet = PRIVILEGE_CODE_ALPHABET;
    var limit = Math.floor(256 / alphabet.length) * alphabet.length;
    var out = "";
    var round = 0;
    while (out.length < PRIVILEGE_CODE_LENGTH && round < 16) {
      var hex = hasher.sha256("JSQUIZ_V06_PRIVILEGE:" + String(entropy) + ":" + String(round));
      var bytes = hexToByteValues(hex);
      var i;
      for (i = 0; i < bytes.length && out.length < PRIVILEGE_CODE_LENGTH; i++) {
        if (bytes[i] < limit) {
          out += alphabet.charAt(bytes[i] % alphabet.length);
        }
      }
      round += 1;
    }
    if (out.length !== PRIVILEGE_CODE_LENGTH) {
      throw new IssuanceError(ERROR_CODE.STORAGE_CONFLICT, "発行コードを生成できませんでした。");
    }
    return out;
  }

  function sanitizeFileNamePart(value, maxLength) {
    var text = String(value == null ? "" : value);
    text = text.replace(/[\u0000-\u001F\u007F]/g, "");
    text = text.replace(/[\\/:*?"<>|]/g, "_");
    text = text.replace(/^\.+/, "");
    text = text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    text = text.replace(/[ .]+$/, "");
    if (!text || text === "." || text === "..") {
      return "";
    }
    if (text.length > maxLength) {
      text = text.slice(0, maxLength).replace(/[ .]+$/, "");
    }
    return text;
  }

  function createDownloadFileName(gameTitle) {
    var title = sanitizeFileNamePart(gameTitle, DOWNLOAD_FILE_TITLE_MAX) || DOWNLOAD_FILE_FALLBACK;
    return title + ".html";
  }

  function createDriveFileName(applicantName, gameTitle) {
    var namePart = sanitizeFileNamePart(applicantName, DOWNLOAD_FILE_NAME_MAX);
    if (!namePart) {
      throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, APPLICANT_NAME_MISSING_MESSAGE);
    }
    var titlePart = sanitizeFileNamePart(gameTitle, DOWNLOAD_FILE_TITLE_MAX) || DOWNLOAD_FILE_FALLBACK;
    return namePart + "_" + titlePart + ".html";
  }

  function ensureHtmlFileName(name) {
    var fileName = String(name || "");
    if (!fileName) {
      return DOWNLOAD_FILE_FALLBACK + ".html";
    }
    if (!/\.html$/i.test(fileName)) {
      return fileName + ".html";
    }
    return fileName;
  }

  function mailFileNameFromDriveName(driveName) {
    var name = String(driveName || "");
    var match = name.match(/^[^_]+_(.+\.html)$/i);
    return match ? match[1] : "";
  }

  function resolveMailFileName(message, file) {
    if (message && message.mailFileName) {
      return ensureHtmlFileName(message.mailFileName);
    }
    if (message && message.gameTitle) {
      return createDownloadFileName(message.gameTitle);
    }
    var fromDrive = file && typeof file.getName === "function" ? mailFileNameFromDriveName(file.getName()) : "";
    if (fromDrive) {
      return ensureHtmlFileName(fromDrive);
    }
    return DOWNLOAD_FILE_FALLBACK + ".html";
  }

  function resolveDownloadFileName(message, file) {
    return resolveMailFileName(message, file);
  }

  function resolveOutputFolderId(config) {
    var adapter = config || {};
    var fromOutput = adapter.get ? String(adapter.get("OUTPUT_FOLDER_ID") || "").trim() : "";
    if (fromOutput) {
      return fromOutput;
    }
    var fromDelivery = adapter.get ? String(adapter.get("DELIVERY_FOLDER_ID") || "").trim() : "";
    if (fromDelivery) {
      return fromDelivery;
    }
    return DEFAULT_OUTPUT_FOLDER_ID;
  }

  function getDriveApp() {
    if (typeof DriveApp === "undefined" || !DriveApp || typeof DriveApp.getFolderById !== "function") {
      throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
    }
    return DriveApp;
  }

  function getOutputFolder(drive, config) {
    var folderId = resolveOutputFolderId(config);
    if (!folderId) {
      throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
    }
    if (!drive || typeof drive.getFolderById !== "function") {
      throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
    }
    var folder;
    try {
      folder = drive.getFolderById(folderId);
    } catch (error) {
      throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
    }
    if (!folder || typeof folder.createFile !== "function") {
      throw new IssuanceError(ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE, OUTPUT_FOLDER_UNAVAILABLE_MESSAGE);
    }
    return folder;
  }

  function readPositiveInt(value, defaultValue) {
    var parsed = parseInt(value, 10);
    if (!isFinite(parsed) || parsed < 0) {
      return defaultValue;
    }
    return parsed;
  }

  function validateBoundedString(value, label, maxLength) {
    if (typeof value !== "string") {
      throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, label + "は文字列である必要があります。");
    }
    var normalized = value.trim();
    if (!normalized) {
      throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, label + "は空にできません。");
    }
    if (normalized.length > maxLength) {
      throw new IssuanceError(ERROR_CODE.INVALID_REQUEST, label + "は" + maxLength + "文字以内にしてください。");
    }
    return normalized;
  }

  function validateOptionalBoundedString(value, label, maxLength) {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    return validateBoundedString(String(value), label, maxLength);
  }

  function publicCodeRecord(row) {
    var copy = clone(row);
    delete copy.codeHash;
    return copy;
  }

  function toRow(object, headers) {
    var row = [];
    for (var i = 0; i < headers.length; i++) {
      row.push(object[headers[i]] === undefined || object[headers[i]] === null ? "" : object[headers[i]]);
    }
    return row;
  }

  function assertExactKeys(object, expectedKeys, label) {
    var actual = Object.keys(object).sort();
    var expected = expectedKeys.slice().sort();
    if (actual.length !== expected.length) {
      throwQuizError(label + "に余分または不足している項目があります。");
    }
    for (var i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        throwQuizError(label + "に余分または不足している項目があります。");
      }
    }
  }

  function throwQuizError(message) {
    throw new IssuanceError(ERROR_CODE.INVALID_QUIZ_DATA, message);
  }

  function validateQuizString(value, label, maxLength) {
    try {
      return validateBoundedString(value, label, maxLength);
    } catch (error) {
      throwQuizError(error && error.message ? error.message : label + "が不正です。");
    }
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function safeSerializeForInlineScript(value, pretty) {
    var json = pretty === true ? JSON.stringify(value, null, 2) : stringifyJson(value);
    return json
      .replace(/</g, "\\u003C")
      .replace(/>/g, "\\u003E")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function sanitizeReference(reference) {
    var output = {};
    var allowed = ["codeId", "applicantId", "workId", "requestId"];
    for (var i = 0; i < allowed.length; i++) {
      if (reference[allowed[i]] !== undefined && reference[allowed[i]] !== null) {
        output[allowed[i]] = String(reference[allowed[i]]).slice(0, 160);
      }
    }
    return output;
  }

  function stringifyJson(value) {
    return JSON.stringify(value);
  }

  function parseJson(value) {
    return JSON.parse(value || "{}");
  }

  function clone(value) {
    return parseJson(stringifyJson(value));
  }

  function attemptDelivery(deliverFn) {
    try {
      var result = deliverFn();
      return result || {
        ok: false,
        reference: "delivery:empty-result",
        fileId: "",
        errorMessage: "delivery returned empty result"
      };
    } catch (error) {
      if (error && error.code === ERROR_CODE.OUTPUT_FOLDER_UNAVAILABLE) {
        throw error;
      }
      return {
        ok: false,
        reference: "delivery:exception",
        fileId: "",
        errorMessage: error && error.message ? error.message : "delivery failed"
      };
    }
  }

  function requireDependency(value, name) {
    if (!value) {
      throw new Error("Missing dependency: " + name);
    }
    return value;
  }

  return {
    SHEETS: SHEETS,
    CODE_HEADERS: CODE_HEADERS,
    HISTORY_HEADERS: HISTORY_HEADERS,
    REQUEST_HEADERS: REQUEST_HEADERS,
    CODE_STATUS: CODE_STATUS,
    DELIVERY_STATUS: DELIVERY_STATUS,
    REQUEST_STATUS: REQUEST_STATUS,
    ERROR_CODE: ERROR_CODE,
    QUIZ_LIMITS: QUIZ_LIMITS,
    PRIVILEGE_CODE_ALPHABET: PRIVILEGE_CODE_ALPHABET,
    PRIVILEGE_CODE_LENGTH: PRIVILEGE_CODE_LENGTH,
    CODE_NOT_FOUND_MESSAGE: CODE_NOT_FOUND_MESSAGE,
    DEFAULT_OUTPUT_FOLDER_ID: DEFAULT_OUTPUT_FOLDER_ID,
    OUTPUT_FOLDER_UNAVAILABLE_MESSAGE: OUTPUT_FOLDER_UNAVAILABLE_MESSAGE,
    APPLICANT_NAME_MISSING_MESSAGE: APPLICANT_NAME_MISSING_MESSAGE,
    IssuanceError: IssuanceError,
    createPrivilegeCode: createPrivilegeCode,
    createDownloadFileName: createDownloadFileName,
    createDriveFileName: createDriveFileName,
    resolveOutputFolderId: resolveOutputFolderId,
    normalizeCode: normalizeCode,
    codeLookupCandidates: codeLookupCandidates,
    createBackend: createBackend,
    createSpreadsheetStorage: createSpreadsheetStorage,
    createGasLockManager: createGasLockManager,
    createGasDigestAdapter: createGasDigestAdapter,
    createGasRandomAdapter: createGasRandomAdapter,
    createGasDriveMailDelivery: createGasDriveMailDelivery,
    createNoopRateLimiter: createNoopRateLimiter,
    createNoopAttemptLimiter: createNoopAttemptLimiter,
    createGasAttemptLimiter: createGasAttemptLimiter,
    validateQuizData: validateQuizData,
    createTrustedStandaloneQuizHtml: createTrustedStandaloneQuizHtml,
    COMPLETED_QUIZ_MAIL_SUBJECT: COMPLETED_QUIZ_MAIL_SUBJECT,
    buildCompletedQuizMailBody: buildCompletedQuizMailBody,
    createLearnerBridgeHtml: createLearnerBridgeHtml,
    extractBridgeSession: extractBridgeSession,
    sanitizeBridgeSession: sanitizeBridgeSession,
    readBridgeSessionFromQueryString: readBridgeSessionFromQueryString,
    issueWorkFromBridge: issueWorkFromBridge,
    doGet: doGet,
    doPost: doPost,
    isPublicLearnerDeployment: isPublicLearnerDeployment,
    isAdminWebApp: isAdminWebApp,
    setupSpreadsheetSchema: setupSpreadsheetSchema,
    adminGenerateCode: adminGenerateCode,
    testGenerateCode: testGenerateCode,
    adminDisableCode: adminDisableCode,
    adminStatusLookup: adminStatusLookup,
    adminResend: adminResend
  };
});

function setupSpreadsheetSchema() {
  return JSQuizGasIssuanceV06Internal.setupSpreadsheetSchema.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function doGet() {
  return JSQuizGasIssuanceV06Internal.doGet.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function doPost() {
  return JSQuizGasIssuanceV06Internal.doPost.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function issueWorkFromBridge() {
  return JSQuizGasIssuanceV06Internal.issueWorkFromBridge.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function adminGenerateCode() {
  return JSQuizGasIssuanceV06Internal.adminGenerateCode.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function testGenerateCode() {
  return JSQuizGasIssuanceV06Internal.testGenerateCode.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function adminDisableCode() {
  return JSQuizGasIssuanceV06Internal.adminDisableCode.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function adminStatusLookup() {
  return JSQuizGasIssuanceV06Internal.adminStatusLookup.apply(JSQuizGasIssuanceV06Internal, arguments);
}

function adminResend() {
  return JSQuizGasIssuanceV06Internal.adminResend.apply(JSQuizGasIssuanceV06Internal, arguments);
}
