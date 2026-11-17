pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct NewInboxPrivateReply {
    #[serde(rename = "commentId")]
    #[serde(default)]
    pub comment_id: String,
    #[serde(default)]
    pub text: String,
}

impl NewInboxPrivateReply {
    pub fn builder() -> NewInboxPrivateReplyBuilder {
        <NewInboxPrivateReplyBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct NewInboxPrivateReplyBuilder {
    comment_id: Option<String>,
    text: Option<String>,
}

impl NewInboxPrivateReplyBuilder {
    pub fn comment_id(mut self, value: impl Into<String>) -> Self {
        self.comment_id = Some(value.into());
        self
    }

    pub fn text(mut self, value: impl Into<String>) -> Self {
        self.text = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`NewInboxPrivateReply`].
    /// This method will fail if any of the following fields are not set:
    /// - [`comment_id`](NewInboxPrivateReplyBuilder::comment_id)
    /// - [`text`](NewInboxPrivateReplyBuilder::text)
    pub fn build(self) -> Result<NewInboxPrivateReply, BuildError> {
        Ok(NewInboxPrivateReply {
            comment_id: self
                .comment_id
                .ok_or_else(|| BuildError::missing_field("comment_id"))?,
            text: self.text.ok_or_else(|| BuildError::missing_field("text"))?,
        })
    }
}
