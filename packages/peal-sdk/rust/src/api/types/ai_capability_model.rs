pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AiCapabilityModel {
    pub capability: AiCapability,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<AiProvider>,
    #[serde(rename = "serverModel")]
    #[serde(default)]
    pub server_model: bool,
    #[serde(rename = "updatedAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl AiCapabilityModel {
    pub fn builder() -> AiCapabilityModelBuilder {
        <AiCapabilityModelBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiCapabilityModelBuilder {
    capability: Option<AiCapability>,
    model: Option<String>,
    provider: Option<AiProvider>,
    server_model: Option<bool>,
    updated_at: Option<String>,
}

impl AiCapabilityModelBuilder {
    pub fn capability(mut self, value: AiCapability) -> Self {
        self.capability = Some(value);
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

    pub fn server_model(mut self, value: bool) -> Self {
        self.server_model = Some(value);
        self
    }

    pub fn updated_at(mut self, value: impl Into<String>) -> Self {
        self.updated_at = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`AiCapabilityModel`].
    /// This method will fail if any of the following fields are not set:
    /// - [`capability`](AiCapabilityModelBuilder::capability)
    /// - [`server_model`](AiCapabilityModelBuilder::server_model)
    pub fn build(self) -> Result<AiCapabilityModel, BuildError> {
        Ok(AiCapabilityModel {
            capability: self
                .capability
                .ok_or_else(|| BuildError::missing_field("capability"))?,
            model: self.model,
            provider: self.provider,
            server_model: self
                .server_model
                .ok_or_else(|| BuildError::missing_field("server_model"))?,
            updated_at: self.updated_at,
        })
    }
}
