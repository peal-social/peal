pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AiProviderConnection {
    #[serde(rename = "baseUrl")]
    #[serde(default)]
    pub base_url: String,
    #[serde(rename = "keySet")]
    #[serde(default)]
    pub key_set: bool,
    #[serde(rename = "keyUnreadable")]
    #[serde(default)]
    pub key_unreadable: bool,
    pub provider: AiProvider,
    #[serde(rename = "updatedAt")]
    #[serde(default)]
    pub updated_at: String,
}

impl AiProviderConnection {
    pub fn builder() -> AiProviderConnectionBuilder {
        <AiProviderConnectionBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiProviderConnectionBuilder {
    base_url: Option<String>,
    key_set: Option<bool>,
    key_unreadable: Option<bool>,
    provider: Option<AiProvider>,
    updated_at: Option<String>,
}

impl AiProviderConnectionBuilder {
    pub fn base_url(mut self, value: impl Into<String>) -> Self {
        self.base_url = Some(value.into());
        self
    }

    pub fn key_set(mut self, value: bool) -> Self {
        self.key_set = Some(value);
        self
    }

    pub fn key_unreadable(mut self, value: bool) -> Self {
        self.key_unreadable = Some(value);
        self
    }

    pub fn provider(mut self, value: AiProvider) -> Self {
        self.provider = Some(value);
        self
    }

    pub fn updated_at(mut self, value: impl Into<String>) -> Self {
        self.updated_at = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`AiProviderConnection`].
    /// This method will fail if any of the following fields are not set:
    /// - [`base_url`](AiProviderConnectionBuilder::base_url)
    /// - [`key_set`](AiProviderConnectionBuilder::key_set)
    /// - [`key_unreadable`](AiProviderConnectionBuilder::key_unreadable)
    /// - [`provider`](AiProviderConnectionBuilder::provider)
    /// - [`updated_at`](AiProviderConnectionBuilder::updated_at)
    pub fn build(self) -> Result<AiProviderConnection, BuildError> {
        Ok(AiProviderConnection {
            base_url: self
                .base_url
                .ok_or_else(|| BuildError::missing_field("base_url"))?,
            key_set: self
                .key_set
                .ok_or_else(|| BuildError::missing_field("key_set"))?,
            key_unreadable: self
                .key_unreadable
                .ok_or_else(|| BuildError::missing_field("key_unreadable"))?,
            provider: self
                .provider
                .ok_or_else(|| BuildError::missing_field("provider"))?,
            updated_at: self
                .updated_at
                .ok_or_else(|| BuildError::missing_field("updated_at"))?,
        })
    }
}
