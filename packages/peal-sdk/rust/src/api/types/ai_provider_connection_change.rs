pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AiProviderConnectionChange {
    #[serde(rename = "apiKey")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(rename = "baseUrl")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

impl AiProviderConnectionChange {
    pub fn builder() -> AiProviderConnectionChangeBuilder {
        <AiProviderConnectionChangeBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiProviderConnectionChangeBuilder {
    api_key: Option<String>,
    base_url: Option<String>,
}

impl AiProviderConnectionChangeBuilder {
    pub fn api_key(mut self, value: impl Into<String>) -> Self {
        self.api_key = Some(value.into());
        self
    }

    pub fn base_url(mut self, value: impl Into<String>) -> Self {
        self.base_url = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`AiProviderConnectionChange`].
    pub fn build(self) -> Result<AiProviderConnectionChange, BuildError> {
        Ok(AiProviderConnectionChange {
            api_key: self.api_key,
            base_url: self.base_url,
        })
    }
}
