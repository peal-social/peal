pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct InboxPrivateReply {
    #[serde(rename = "authorId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_id: Option<String>,
    #[serde(rename = "commentId")]
    #[serde(default)]
    pub comment_id: String,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<InboxPrivateReplyReason>,
    #[serde(rename = "ruleId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
    #[serde(rename = "settledAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<String>,
    pub status: InboxPrivateReplyStatus,
    #[serde(default)]
    pub text: String,
}

impl InboxPrivateReply {
    pub fn builder() -> InboxPrivateReplyBuilder {
        <InboxPrivateReplyBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct InboxPrivateReplyBuilder {
    author_id: Option<String>,
    comment_id: Option<String>,
    created_at: Option<String>,
    id: Option<String>,
    reason: Option<InboxPrivateReplyReason>,
    rule_id: Option<String>,
    settled_at: Option<String>,
    status: Option<InboxPrivateReplyStatus>,
    text: Option<String>,
}

impl InboxPrivateReplyBuilder {
    pub fn author_id(mut self, value: impl Into<String>) -> Self {
        self.author_id = Some(value.into());
        self
    }

    pub fn comment_id(mut self, value: impl Into<String>) -> Self {
        self.comment_id = Some(value.into());
        self
    }

    pub fn created_at(mut self, value: impl Into<String>) -> Self {
        self.created_at = Some(value.into());
        self
    }

    pub fn id(mut self, value: impl Into<String>) -> Self {
        self.id = Some(value.into());
        self
    }

    pub fn reason(mut self, value: InboxPrivateReplyReason) -> Self {
        self.reason = Some(value);
        self
    }

    pub fn rule_id(mut self, value: impl Into<String>) -> Self {
        self.rule_id = Some(value.into());
        self
    }

    pub fn settled_at(mut self, value: impl Into<String>) -> Self {
        self.settled_at = Some(value.into());
        self
    }

    pub fn status(mut self, value: InboxPrivateReplyStatus) -> Self {
        self.status = Some(value);
        self
    }

    pub fn text(mut self, value: impl Into<String>) -> Self {
        self.text = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`InboxPrivateReply`].
    /// This method will fail if any of the following fields are not set:
    /// - [`comment_id`](InboxPrivateReplyBuilder::comment_id)
    /// - [`created_at`](InboxPrivateReplyBuilder::created_at)
    /// - [`id`](InboxPrivateReplyBuilder::id)
    /// - [`status`](InboxPrivateReplyBuilder::status)
    /// - [`text`](InboxPrivateReplyBuilder::text)
    pub fn build(self) -> Result<InboxPrivateReply, BuildError> {
        Ok(InboxPrivateReply {
            author_id: self.author_id,
            comment_id: self
                .comment_id
                .ok_or_else(|| BuildError::missing_field("comment_id"))?,
            created_at: self
                .created_at
                .ok_or_else(|| BuildError::missing_field("created_at"))?,
            id: self.id.ok_or_else(|| BuildError::missing_field("id"))?,
            reason: self.reason,
            rule_id: self.rule_id,
            settled_at: self.settled_at,
            status: self
                .status
                .ok_or_else(|| BuildError::missing_field("status"))?,
            text: self.text.ok_or_else(|| BuildError::missing_field("text"))?,
        })
    }
}
