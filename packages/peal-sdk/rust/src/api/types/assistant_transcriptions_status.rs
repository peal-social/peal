pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AssistantTranscriptionsStatus {
    #[serde(default)]
    pub available: bool,
    #[serde(rename = "dailyLimit")]
    #[serde(default)]
    pub daily_limit: i64,
    #[serde(rename = "maxBytes")]
    #[serde(default)]
    pub max_bytes: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<AiProvider>,
    #[serde(default)]
    pub remaining: i64,
}

impl AssistantTranscriptionsStatus {
    pub fn builder() -> AssistantTranscriptionsStatusBuilder {
        <AssistantTranscriptionsStatusBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AssistantTranscriptionsStatusBuilder {
    available: Option<bool>,
    daily_limit: Option<i64>,
    max_bytes: Option<i64>,
    provider: Option<AiProvider>,
    remaining: Option<i64>,
}

impl AssistantTranscriptionsStatusBuilder {
    pub fn available(mut self, value: bool) -> Self {
        self.available = Some(value);
        self
    }

    pub fn daily_limit(mut self, value: i64) -> Self {
        self.daily_limit = Some(value);
        self
    }

    pub fn max_bytes(mut self, value: i64) -> Self {
        self.max_bytes = Some(value);
        self
    }

    pub fn provider(mut self, value: AiProvider) -> Self {
        self.provider = Some(value);
        self
    }

    pub fn remaining(mut self, value: i64) -> Self {
        self.remaining = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AssistantTranscriptionsStatus`].
    /// This method will fail if any of the following fields are not set:
    /// - [`available`](AssistantTranscriptionsStatusBuilder::available)
    /// - [`daily_limit`](AssistantTranscriptionsStatusBuilder::daily_limit)
    /// - [`max_bytes`](AssistantTranscriptionsStatusBuilder::max_bytes)
    /// - [`remaining`](AssistantTranscriptionsStatusBuilder::remaining)
    pub fn build(self) -> Result<AssistantTranscriptionsStatus, BuildError> {
        Ok(AssistantTranscriptionsStatus {
            available: self
                .available
                .ok_or_else(|| BuildError::missing_field("available"))?,
            daily_limit: self
                .daily_limit
                .ok_or_else(|| BuildError::missing_field("daily_limit"))?,
            max_bytes: self
                .max_bytes
                .ok_or_else(|| BuildError::missing_field("max_bytes"))?,
            provider: self.provider,
            remaining: self
                .remaining
                .ok_or_else(|| BuildError::missing_field("remaining"))?,
        })
    }
}
