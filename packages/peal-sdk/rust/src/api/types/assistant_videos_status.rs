pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AssistantVideosStatus {
    #[serde(default)]
    pub available: bool,
    #[serde(rename = "dailyLimit")]
    #[serde(default)]
    pub daily_limit: i64,
    #[serde(rename = "maxPromptLength")]
    #[serde(default)]
    pub max_prompt_length: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<AiProvider>,
    #[serde(default)]
    pub remaining: i64,
}

impl AssistantVideosStatus {
    pub fn builder() -> AssistantVideosStatusBuilder {
        <AssistantVideosStatusBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AssistantVideosStatusBuilder {
    available: Option<bool>,
    daily_limit: Option<i64>,
    max_prompt_length: Option<i64>,
    provider: Option<AiProvider>,
    remaining: Option<i64>,
}

impl AssistantVideosStatusBuilder {
    pub fn available(mut self, value: bool) -> Self {
        self.available = Some(value);
        self
    }

    pub fn daily_limit(mut self, value: i64) -> Self {
        self.daily_limit = Some(value);
        self
    }

    pub fn max_prompt_length(mut self, value: i64) -> Self {
        self.max_prompt_length = Some(value);
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

    /// Consumes the builder and constructs a [`AssistantVideosStatus`].
    /// This method will fail if any of the following fields are not set:
    /// - [`available`](AssistantVideosStatusBuilder::available)
    /// - [`daily_limit`](AssistantVideosStatusBuilder::daily_limit)
    /// - [`max_prompt_length`](AssistantVideosStatusBuilder::max_prompt_length)
    /// - [`remaining`](AssistantVideosStatusBuilder::remaining)
    pub fn build(self) -> Result<AssistantVideosStatus, BuildError> {
        Ok(AssistantVideosStatus {
            available: self
                .available
                .ok_or_else(|| BuildError::missing_field("available"))?,
            daily_limit: self
                .daily_limit
                .ok_or_else(|| BuildError::missing_field("daily_limit"))?,
            max_prompt_length: self
                .max_prompt_length
                .ok_or_else(|| BuildError::missing_field("max_prompt_length"))?,
            provider: self.provider,
            remaining: self
                .remaining
                .ok_or_else(|| BuildError::missing_field("remaining"))?,
        })
    }
}
