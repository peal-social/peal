pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "_tag")]
#[non_exhaustive]
pub enum PaymentRequiredErrorBody {
    #[non_exhaustive]
    CompositionNeedsPayment {
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        #[serde(rename = "requestId")]
        #[serde(skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        #[serde(rename = "billingUrl")]
        #[serde(default)]
        billing_url: String,
    },

    #[non_exhaustive]
    PlanLimitReached {
        #[serde(flatten)]
        data: PlanLimitReachedEncoded,
    },

    /// Catch-all variant for unrecognized discriminant values.
    /// If the server sends a discriminant not recognized by the current SDK
    /// version, the raw payload is captured here so callers can still inspect it.
    #[serde(untagged)]
    __Unknown(serde_json::Value),
}

impl PaymentRequiredErrorBody {
    pub fn composition_needs_payment(billing_url: String) -> Self {
        Self::CompositionNeedsPayment {
            code: None,
            message: None,
            request_id: None,
            billing_url,
        }
    }

    pub fn plan_limit_reached(data: PlanLimitReachedEncoded) -> Self {
        Self::PlanLimitReached { data }
    }

    pub fn composition_needs_payment_with_code(
        code: String,
        message: Option<String>,
        request_id: Option<String>,
        billing_url: String,
    ) -> Self {
        Self::CompositionNeedsPayment {
            code: Some(code),
            message,
            request_id,
            billing_url,
        }
    }

    pub fn composition_needs_payment_with_message(
        code: Option<String>,
        message: String,
        request_id: Option<String>,
        billing_url: String,
    ) -> Self {
        Self::CompositionNeedsPayment {
            code,
            message: Some(message),
            request_id,
            billing_url,
        }
    }

    pub fn composition_needs_payment_with_request_id(
        code: Option<String>,
        message: Option<String>,
        request_id: String,
        billing_url: String,
    ) -> Self {
        Self::CompositionNeedsPayment {
            code,
            message,
            request_id: Some(request_id),
            billing_url,
        }
    }

    pub fn unknown(value: serde_json::Value) -> Self {
        Self::__Unknown(value)
    }
}
