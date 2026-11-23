pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AiProviderTest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl AiProviderTest {
    pub fn builder() -> AiProviderTestBuilder {
        <AiProviderTestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AiProviderTestBuilder {
    model: Option<String>,
}

impl AiProviderTestBuilder {
    pub fn model(mut self, value: impl Into<String>) -> Self {
        self.model = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`AiProviderTest`].
    pub fn build(self) -> Result<AiProviderTest, BuildError> {
        Ok(AiProviderTest { model: self.model })
    }
}
