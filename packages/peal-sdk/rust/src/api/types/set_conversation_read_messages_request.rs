pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SetConversationReadMessagesRequest {
    #[serde(default)]
    pub read: bool,
}

impl SetConversationReadMessagesRequest {
    pub fn builder() -> SetConversationReadMessagesRequestBuilder {
        <SetConversationReadMessagesRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SetConversationReadMessagesRequestBuilder {
    read: Option<bool>,
}

impl SetConversationReadMessagesRequestBuilder {
    pub fn read(mut self, value: bool) -> Self {
        self.read = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`SetConversationReadMessagesRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`read`](SetConversationReadMessagesRequestBuilder::read)
    pub fn build(self) -> Result<SetConversationReadMessagesRequest, BuildError> {
        Ok(SetConversationReadMessagesRequest {
            read: self.read.ok_or_else(|| BuildError::missing_field("read"))?,
        })
    }
}
