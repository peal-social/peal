pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct UsageAllowanceReachedEncoded {
    #[serde(rename = "_tag")]
    pub tag: UsageAllowanceReachedEncodedTag,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(default)]
    pub allowed: i64,
    #[serde(rename = "billingUrl")]
    #[serde(default)]
    pub billing_url: String,
    pub meter: Meter,
    pub reason: AllowanceReason,
    #[serde(rename = "resetsAt")]
    #[serde(default)]
    pub resets_at: String,
    #[serde(default)]
    pub used: i64,
}

impl UsageAllowanceReachedEncoded {
    pub fn builder() -> UsageAllowanceReachedEncodedBuilder {
        <UsageAllowanceReachedEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct UsageAllowanceReachedEncodedBuilder {
    tag: Option<UsageAllowanceReachedEncodedTag>,
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    allowed: Option<i64>,
    billing_url: Option<String>,
    meter: Option<Meter>,
    reason: Option<AllowanceReason>,
    resets_at: Option<String>,
    used: Option<i64>,
}

impl UsageAllowanceReachedEncodedBuilder {
    pub fn tag(mut self, value: UsageAllowanceReachedEncodedTag) -> Self {
        self.tag = Some(value);
        self
    }

    pub fn code(mut self, value: impl Into<String>) -> Self {
        self.code = Some(value.into());
        self
    }

    pub fn message(mut self, value: impl Into<String>) -> Self {
        self.message = Some(value.into());
        self
    }

    pub fn request_id(mut self, value: impl Into<String>) -> Self {
        self.request_id = Some(value.into());
        self
    }

    pub fn allowed(mut self, value: i64) -> Self {
        self.allowed = Some(value);
        self
    }

    pub fn billing_url(mut self, value: impl Into<String>) -> Self {
        self.billing_url = Some(value.into());
        self
    }

    pub fn meter(mut self, value: Meter) -> Self {
        self.meter = Some(value);
        self
    }

    pub fn reason(mut self, value: AllowanceReason) -> Self {
        self.reason = Some(value);
        self
    }

    pub fn resets_at(mut self, value: impl Into<String>) -> Self {
        self.resets_at = Some(value.into());
        self
    }

    pub fn used(mut self, value: i64) -> Self {
        self.used = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`UsageAllowanceReachedEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`tag`](UsageAllowanceReachedEncodedBuilder::tag)
    /// - [`allowed`](UsageAllowanceReachedEncodedBuilder::allowed)
    /// - [`billing_url`](UsageAllowanceReachedEncodedBuilder::billing_url)
    /// - [`meter`](UsageAllowanceReachedEncodedBuilder::meter)
    /// - [`reason`](UsageAllowanceReachedEncodedBuilder::reason)
    /// - [`resets_at`](UsageAllowanceReachedEncodedBuilder::resets_at)
    /// - [`used`](UsageAllowanceReachedEncodedBuilder::used)
    pub fn build(self) -> Result<UsageAllowanceReachedEncoded, BuildError> {
        Ok(UsageAllowanceReachedEncoded {
            tag: self.tag.ok_or_else(|| BuildError::missing_field("tag"))?,
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            allowed: self
                .allowed
                .ok_or_else(|| BuildError::missing_field("allowed"))?,
            billing_url: self
                .billing_url
                .ok_or_else(|| BuildError::missing_field("billing_url"))?,
            meter: self
                .meter
                .ok_or_else(|| BuildError::missing_field("meter"))?,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
            resets_at: self
                .resets_at
                .ok_or_else(|| BuildError::missing_field("resets_at"))?,
            used: self.used.ok_or_else(|| BuildError::missing_field("used"))?,
        })
    }
}
