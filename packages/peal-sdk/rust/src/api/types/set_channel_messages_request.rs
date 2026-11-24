pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SetChannelMessagesRequest {
    #[serde(default)]
    pub enabled: bool,
}

impl SetChannelMessagesRequest {
    pub fn builder() -> SetChannelMessagesRequestBuilder {
        <SetChannelMessagesRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SetChannelMessagesRequestBuilder {
    enabled: Option<bool>,
}

impl SetChannelMessagesRequestBuilder {
    pub fn enabled(mut self, value: bool) -> Self {
        self.enabled = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`SetChannelMessagesRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`enabled`](SetChannelMessagesRequestBuilder::enabled)
    pub fn build(self) -> Result<SetChannelMessagesRequest, BuildError> {
        Ok(SetChannelMessagesRequest {
            enabled: self
                .enabled
                .ok_or_else(|| BuildError::missing_field("enabled"))?,
        })
    }
}
