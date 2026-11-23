pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ApiKeyMaker {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
}

impl ApiKeyMaker {
    pub fn builder() -> ApiKeyMakerBuilder {
        <ApiKeyMakerBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ApiKeyMakerBuilder {
    id: Option<String>,
    name: Option<String>,
}

impl ApiKeyMakerBuilder {
    pub fn id(mut self, value: impl Into<String>) -> Self {
        self.id = Some(value.into());
        self
    }

    pub fn name(mut self, value: impl Into<String>) -> Self {
        self.name = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`ApiKeyMaker`].
    /// This method will fail if any of the following fields are not set:
    /// - [`id`](ApiKeyMakerBuilder::id)
    /// - [`name`](ApiKeyMakerBuilder::name)
    pub fn build(self) -> Result<ApiKeyMaker, BuildError> {
        Ok(ApiKeyMaker {
            id: self.id.ok_or_else(|| BuildError::missing_field("id"))?,
            name: self.name.ok_or_else(|| BuildError::missing_field("name"))?,
        })
    }
}
