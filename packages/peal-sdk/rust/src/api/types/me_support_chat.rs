pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct MeSupportChat {
    #[serde(rename = "emailSignature")]
    #[serde(default)]
    pub email_signature: String,
}

impl MeSupportChat {
    pub fn builder() -> MeSupportChatBuilder {
        <MeSupportChatBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct MeSupportChatBuilder {
    email_signature: Option<String>,
}

impl MeSupportChatBuilder {
    pub fn email_signature(mut self, value: impl Into<String>) -> Self {
        self.email_signature = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`MeSupportChat`].
    /// This method will fail if any of the following fields are not set:
    /// - [`email_signature`](MeSupportChatBuilder::email_signature)
    pub fn build(self) -> Result<MeSupportChat, BuildError> {
        Ok(MeSupportChat {
            email_signature: self
                .email_signature
                .ok_or_else(|| BuildError::missing_field("email_signature"))?,
        })
    }
}
