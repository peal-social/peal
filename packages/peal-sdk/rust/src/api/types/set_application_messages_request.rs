pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SetApplicationMessagesRequest {
    #[serde(default)]
    pub allowed: bool,
    #[serde(rename = "clientId")]
    #[serde(default)]
    pub client_id: String,
}

impl SetApplicationMessagesRequest {
    pub fn builder() -> SetApplicationMessagesRequestBuilder {
        <SetApplicationMessagesRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SetApplicationMessagesRequestBuilder {
    allowed: Option<bool>,
    client_id: Option<String>,
}

impl SetApplicationMessagesRequestBuilder {
    pub fn allowed(mut self, value: bool) -> Self {
        self.allowed = Some(value);
        self
    }

    pub fn client_id(mut self, value: impl Into<String>) -> Self {
        self.client_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`SetApplicationMessagesRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`allowed`](SetApplicationMessagesRequestBuilder::allowed)
    /// - [`client_id`](SetApplicationMessagesRequestBuilder::client_id)
    pub fn build(self) -> Result<SetApplicationMessagesRequest, BuildError> {
        Ok(SetApplicationMessagesRequest {
            allowed: self
                .allowed
                .ok_or_else(|| BuildError::missing_field("allowed"))?,
            client_id: self
                .client_id
                .ok_or_else(|| BuildError::missing_field("client_id"))?,
        })
    }
}
