pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ConfirmReplyCommentsRequest {
    #[serde(default)]
    pub sent: bool,
}

impl ConfirmReplyCommentsRequest {
    pub fn builder() -> ConfirmReplyCommentsRequestBuilder {
        <ConfirmReplyCommentsRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ConfirmReplyCommentsRequestBuilder {
    sent: Option<bool>,
}

impl ConfirmReplyCommentsRequestBuilder {
    pub fn sent(mut self, value: bool) -> Self {
        self.sent = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ConfirmReplyCommentsRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`sent`](ConfirmReplyCommentsRequestBuilder::sent)
    pub fn build(self) -> Result<ConfirmReplyCommentsRequest, BuildError> {
        Ok(ConfirmReplyCommentsRequest {
            sent: self.sent.ok_or_else(|| BuildError::missing_field("sent"))?,
        })
    }
}
