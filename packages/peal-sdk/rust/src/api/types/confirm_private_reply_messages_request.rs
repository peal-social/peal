pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ConfirmPrivateReplyMessagesRequest {
    #[serde(default)]
    pub went: bool,
}

impl ConfirmPrivateReplyMessagesRequest {
    pub fn builder() -> ConfirmPrivateReplyMessagesRequestBuilder {
        <ConfirmPrivateReplyMessagesRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ConfirmPrivateReplyMessagesRequestBuilder {
    went: Option<bool>,
}

impl ConfirmPrivateReplyMessagesRequestBuilder {
    pub fn went(mut self, value: bool) -> Self {
        self.went = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ConfirmPrivateReplyMessagesRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`went`](ConfirmPrivateReplyMessagesRequestBuilder::went)
    pub fn build(self) -> Result<ConfirmPrivateReplyMessagesRequest, BuildError> {
        Ok(ConfirmPrivateReplyMessagesRequest {
            went: self.went.ok_or_else(|| BuildError::missing_field("went"))?,
        })
    }
}
