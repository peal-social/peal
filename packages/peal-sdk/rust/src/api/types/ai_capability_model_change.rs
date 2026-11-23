pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AiCapabilityModelChange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub provider: AiProvider,
}

impl AiCapabilityModelChange {
    pub fn builder() -> AiCapabilityModelChangeBuilder {
        <AiCapabilityModelChangeBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiCapabilityModelChangeBuilder {
    model: Option<String>,
    provider: Option<AiProvider>,
}

impl AiCapabilityModelChangeBuilder {
    pub fn model(mut self, value: impl Into<String>) -> Self {
        self.model = Some(value.into());
        self
    }

    pub fn provider(mut self, value: AiProvider) -> Self {
        self.provider = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AiCapabilityModelChange`].
    /// This method will fail if any of the following fields are not set:
    /// - [`provider`](AiCapabilityModelChangeBuilder::provider)
    pub fn build(self) -> Result<AiCapabilityModelChange, BuildError> {
        Ok(AiCapabilityModelChange {
            model: self.model,
            provider: self
                .provider
                .ok_or_else(|| BuildError::missing_field("provider"))?,
        })
    }
}
