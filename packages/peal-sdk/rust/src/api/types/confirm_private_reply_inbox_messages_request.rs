pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ConfirmPrivateReplyInboxMessagesRequest {
    #[serde(default)]
    pub went: bool,
}

impl ConfirmPrivateReplyInboxMessagesRequest {
    pub fn builder() -> ConfirmPrivateReplyInboxMessagesRequestBuilder {
        <ConfirmPrivateReplyInboxMessagesRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ConfirmPrivateReplyInboxMessagesRequestBuilder {
    went: Option<bool>,
}

impl ConfirmPrivateReplyInboxMessagesRequestBuilder {
    pub fn went(mut self, value: bool) -> Self {
        self.went = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ConfirmPrivateReplyInboxMessagesRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`went`](ConfirmPrivateReplyInboxMessagesRequestBuilder::went)
    pub fn build(self) -> Result<ConfirmPrivateReplyInboxMessagesRequest, BuildError> {
        Ok(ConfirmPrivateReplyInboxMessagesRequest {
            went: self.went.ok_or_else(|| BuildError::missing_field("went"))?,
        })
    }
}
