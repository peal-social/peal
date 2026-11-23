pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AiCapabilityModels {
    #[serde(default)]
    pub models: Vec<AiCapabilityModel>,
}

impl AiCapabilityModels {
    pub fn builder() -> AiCapabilityModelsBuilder {
        <AiCapabilityModelsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiCapabilityModelsBuilder {
    models: Option<Vec<AiCapabilityModel>>,
}

impl AiCapabilityModelsBuilder {
    pub fn models(mut self, value: Vec<AiCapabilityModel>) -> Self {
        self.models = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AiCapabilityModels`].
    /// This method will fail if any of the following fields are not set:
    /// - [`models`](AiCapabilityModelsBuilder::models)
    pub fn build(self) -> Result<AiCapabilityModels, BuildError> {
        Ok(AiCapabilityModels {
            models: self
                .models
                .ok_or_else(|| BuildError::missing_field("models"))?,
        })
    }
}
