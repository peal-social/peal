pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct CommentRuleChange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keywords: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paused: Option<bool>,
    #[serde(rename = "privateReply")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_reply: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
}

impl CommentRuleChange {
    pub fn builder() -> CommentRuleChangeBuilder {
        <CommentRuleChangeBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct CommentRuleChangeBuilder {
    keywords: Option<Vec<String>>,
    paused: Option<bool>,
    private_reply: Option<String>,
    reply: Option<String>,
}

impl CommentRuleChangeBuilder {
    pub fn keywords(mut self, value: Vec<String>) -> Self {
        self.keywords = Some(value);
        self
    }

    pub fn paused(mut self, value: bool) -> Self {
        self.paused = Some(value);
        self
    }

    pub fn private_reply(mut self, value: impl Into<String>) -> Self {
        self.private_reply = Some(value.into());
        self
    }

    pub fn reply(mut self, value: impl Into<String>) -> Self {
        self.reply = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`CommentRuleChange`].
    pub fn build(self) -> Result<CommentRuleChange, BuildError> {
        Ok(CommentRuleChange {
            keywords: self.keywords,
            paused: self.paused,
            private_reply: self.private_reply,
            reply: self.reply,
        })
    }
}
