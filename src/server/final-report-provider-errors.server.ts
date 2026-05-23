// SERVER-ONLY helpers for final-report provider failure classification.
// Keep this module free of raw prompts, raw responses, URLs, and credentials.

export type FinalReportProviderSafeErrorCategory =
  | "media_url_unfetchable_or_rejected"
  | "provider_request_contract_invalid"
  | "model_unsupported_request_shape"
  | "response_schema_or_json_mode_invalid"
  | "safety_or_content_rejected"
  | "provider_invalid_argument_unknown"
  | "provider_rate_limited"
  | "provider_server_error"
  | "provider_network_error"
  | "provider_credits_exhausted"
  | "provider_unknown_error";

export type FinalReportProviderFailureCode =
  | "media_url_provider_rejected"
  | "media_url_provider_rejected_after_confirmed_fetchability"
  | "final_report_provider_request_invalid"
  | "final_report_model_request_shape_unsupported"
  | "final_report_provider_invalid_argument";

export type FinalReportProviderErrorClassification = {
  category: FinalReportProviderSafeErrorCategory;
  failureCode: FinalReportProviderFailureCode | null;
  bodyBytes: number;
};

export function classifyFinalReportProviderError(input: {
  status: number | null;
  body?: string;
  mediaUrlConfirmedFetchable: boolean;
}): FinalReportProviderErrorClassification {
  const body = input.body ?? "";
  const normalised = body.toLowerCase();
  const bodyBytes = new TextEncoder().encode(body).length;

  if (input.status === 402) {
    return { category: "provider_credits_exhausted", failureCode: null, bodyBytes };
  }
  if (input.status === 429) {
    return { category: "provider_rate_limited", failureCode: null, bodyBytes };
  }
  if (input.status !== null && input.status >= 500) {
    return { category: "provider_server_error", failureCode: null, bodyBytes };
  }
  if (input.status === null) {
    return { category: "provider_network_error", failureCode: null, bodyBytes };
  }
  if (input.status !== 400) {
    return { category: "provider_unknown_error", failureCode: null, bodyBytes };
  }

  if (!input.mediaUrlConfirmedFetchable) {
    return {
      category: "media_url_unfetchable_or_rejected",
      failureCode: "media_url_provider_rejected",
      bodyBytes,
    };
  }

  if (
    /\b(file[_-]?url|media url|fetch|download|unreachable|not found|404|url)\b/.test(normalised)
  ) {
    return {
      category: "media_url_unfetchable_or_rejected",
      failureCode: "media_url_provider_rejected_after_confirmed_fetchability",
      bodyBytes,
    };
  }

  if (/\b(tool_choice|tool call|function call|tools?|function|unsupported)\b/.test(normalised)) {
    return {
      category: "model_unsupported_request_shape",
      failureCode: "final_report_model_request_shape_unsupported",
      bodyBytes,
    };
  }

  if (/\b(schema|json|response_format|response format|mime|content part|part)\b/.test(normalised)) {
    return {
      category: "response_schema_or_json_mode_invalid",
      failureCode: "final_report_provider_request_invalid",
      bodyBytes,
    };
  }

  if (/\b(safety|blocked|policy|content rejected|prohibited)\b/.test(normalised)) {
    return {
      category: "safety_or_content_rejected",
      failureCode: "final_report_provider_invalid_argument",
      bodyBytes,
    };
  }

  if (
    /\b(invalid argument|invalid request|bad request|request contains an invalid argument)\b/.test(
      normalised,
    )
  ) {
    return {
      category: "provider_invalid_argument_unknown",
      failureCode: "final_report_provider_invalid_argument",
      bodyBytes,
    };
  }

  return {
    category: "provider_request_contract_invalid",
    failureCode: "final_report_provider_request_invalid",
    bodyBytes,
  };
}

export function isFallbackModelEligibleForFinalReportProviderError(
  category: FinalReportProviderSafeErrorCategory,
): boolean {
  return (
    category === "model_unsupported_request_shape" ||
    category === "response_schema_or_json_mode_invalid" ||
    category === "provider_invalid_argument_unknown" ||
    category === "provider_request_contract_invalid"
  );
}
