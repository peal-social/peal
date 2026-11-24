pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ConfirmMessagesRequest {
    #[serde(default)]
    pub sent: bool,
}

impl ConfirmMessagesRequest {
    pub fn builder() -> ConfirmMessagesRequestBuilder {
        <ConfirmMessagesRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ConfirmMessagesRequestBuilder {
    sent: Option<bool>,
}

impl ConfirmMessagesRequestBuilder {
    pub fn sent(mut self, value: bool) -> Self {
        self.sent = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ConfirmMessagesRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`sent`](ConfirmMessagesRequestBuilder::sent)
    pub fn build(self) -> Result<ConfirmMessagesRequest, BuildError> {
        Ok(ConfirmMessagesRequest {
            sent: self.sent.ok_or_else(|| BuildError::missing_field("sent"))?,
        })
    }
}
