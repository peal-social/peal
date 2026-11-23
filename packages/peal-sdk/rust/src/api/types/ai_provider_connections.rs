pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AiProviderConnections {
    #[serde(default)]
    pub providers: Vec<AiProviderConnection>,
}

impl AiProviderConnections {
    pub fn builder() -> AiProviderConnectionsBuilder {
        <AiProviderConnectionsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiProviderConnectionsBuilder {
    providers: Option<Vec<AiProviderConnection>>,
}

impl AiProviderConnectionsBuilder {
    pub fn providers(mut self, value: Vec<AiProviderConnection>) -> Self {
        self.providers = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AiProviderConnections`].
    /// This method will fail if any of the following fields are not set:
    /// - [`providers`](AiProviderConnectionsBuilder::providers)
    pub fn build(self) -> Result<AiProviderConnections, BuildError> {
        Ok(AiProviderConnections {
            providers: self
                .providers
                .ok_or_else(|| BuildError::missing_field("providers"))?,
        })
    }
}
