pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct PostExternalIdChange {
    #[serde(rename = "externalId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,
}

impl PostExternalIdChange {
    pub fn builder() -> PostExternalIdChangeBuilder {
        <PostExternalIdChangeBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct PostExternalIdChangeBuilder {
    external_id: Option<String>,
}

impl PostExternalIdChangeBuilder {
    pub fn external_id(mut self, value: impl Into<String>) -> Self {
        self.external_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`PostExternalIdChange`].
    pub fn build(self) -> Result<PostExternalIdChange, BuildError> {
        Ok(PostExternalIdChange {
            external_id: self.external_id,
        })
    }
}
