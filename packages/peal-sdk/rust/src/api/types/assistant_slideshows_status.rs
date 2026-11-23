pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AssistantSlideshowsStatus {
    #[serde(default)]
    pub available: bool,
    #[serde(rename = "dailyLimit")]
    #[serde(default)]
    pub daily_limit: i64,
    #[serde(rename = "paymentMethodRequired")]
    #[serde(default)]
    pub payment_method_required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<AiProvider>,
    #[serde(default)]
    pub remaining: i64,
    #[serde(default)]
    pub sandbox: bool,
}

impl AssistantSlideshowsStatus {
    pub fn builder() -> AssistantSlideshowsStatusBuilder {
        <AssistantSlideshowsStatusBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AssistantSlideshowsStatusBuilder {
    available: Option<bool>,
    daily_limit: Option<i64>,
    payment_method_required: Option<bool>,
    provider: Option<AiProvider>,
    remaining: Option<i64>,
    sandbox: Option<bool>,
}

impl AssistantSlideshowsStatusBuilder {
    pub fn available(mut self, value: bool) -> Self {
        self.available = Some(value);
        self
    }

    pub fn daily_limit(mut self, value: i64) -> Self {
        self.daily_limit = Some(value);
        self
    }

    pub fn payment_method_required(mut self, value: bool) -> Self {
        self.payment_method_required = Some(value);
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

    pub fn sandbox(mut self, value: bool) -> Self {
        self.sandbox = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AssistantSlideshowsStatus`].
    /// This method will fail if any of the following fields are not set:
    /// - [`available`](AssistantSlideshowsStatusBuilder::available)
    /// - [`daily_limit`](AssistantSlideshowsStatusBuilder::daily_limit)
    /// - [`payment_method_required`](AssistantSlideshowsStatusBuilder::payment_method_required)
    /// - [`remaining`](AssistantSlideshowsStatusBuilder::remaining)
    /// - [`sandbox`](AssistantSlideshowsStatusBuilder::sandbox)
    pub fn build(self) -> Result<AssistantSlideshowsStatus, BuildError> {
        Ok(AssistantSlideshowsStatus {
            available: self
                .available
                .ok_or_else(|| BuildError::missing_field("available"))?,
            daily_limit: self
                .daily_limit
                .ok_or_else(|| BuildError::missing_field("daily_limit"))?,
            payment_method_required: self
                .payment_method_required
                .ok_or_else(|| BuildError::missing_field("payment_method_required"))?,
            provider: self.provider,
            remaining: self
                .remaining
                .ok_or_else(|| BuildError::missing_field("remaining"))?,
            sandbox: self
                .sandbox
                .ok_or_else(|| BuildError::missing_field("sandbox"))?,
        })
    }
}
