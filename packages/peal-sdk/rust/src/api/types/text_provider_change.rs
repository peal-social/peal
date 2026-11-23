pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct TextProviderChange {
    #[serde(rename = "apiKey")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(rename = "baseUrl")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<TextProviderKind>,
    #[serde(default)]
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<AiProvider>,
}

impl TextProviderChange {
    pub fn builder() -> TextProviderChangeBuilder {
        <TextProviderChangeBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct TextProviderChangeBuilder {
    api_key: Option<String>,
    base_url: Option<String>,
    kind: Option<TextProviderKind>,
    model: Option<String>,
    provider: Option<AiProvider>,
}

impl TextProviderChangeBuilder {
    pub fn api_key(mut self, value: impl Into<String>) -> Self {
        self.api_key = Some(value.into());
        self
    }

    pub fn base_url(mut self, value: impl Into<String>) -> Self {
        self.base_url = Some(value.into());
        self
    }

    pub fn kind(mut self, value: TextProviderKind) -> Self {
        self.kind = Some(value);
        self
    }

    pub fn model(mut self, value: impl Into<String>) -> Self {
        self.model = Some(value.into());
        self
    }

    pub fn provider(mut self, value: AiProvider) -> Self {
        self.provider = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`TextProviderChange`].
    /// This method will fail if any of the following fields are not set:
    /// - [`model`](TextProviderChangeBuilder::model)
    pub fn build(self) -> Result<TextProviderChange, BuildError> {
        Ok(TextProviderChange {
            api_key: self.api_key,
            base_url: self.base_url,
            kind: self.kind,
            model: self
                .model
                .ok_or_else(|| BuildError::missing_field("model"))?,
            provider: self.provider,
        })
    }
}
