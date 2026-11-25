pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PlatformCommentRule {
    pub platform: Platform,
    #[serde(rename = "privateReply")]
    pub private_reply: PlatformCommentRulePrivate,
    pub reply: PlatformCommentRuleReply,
}

impl PlatformCommentRule {
    pub fn builder() -> PlatformCommentRuleBuilder {
        <PlatformCommentRuleBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct PlatformCommentRuleBuilder {
    platform: Option<Platform>,
    private_reply: Option<PlatformCommentRulePrivate>,
    reply: Option<PlatformCommentRuleReply>,
}

impl PlatformCommentRuleBuilder {
    pub fn platform(mut self, value: Platform) -> Self {
        self.platform = Some(value);
        self
    }

    pub fn private_reply(mut self, value: PlatformCommentRulePrivate) -> Self {
        self.private_reply = Some(value);
        self
    }

    pub fn reply(mut self, value: PlatformCommentRuleReply) -> Self {
        self.reply = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`PlatformCommentRule`].
    /// This method will fail if any of the following fields are not set:
    /// - [`platform`](PlatformCommentRuleBuilder::platform)
    /// - [`private_reply`](PlatformCommentRuleBuilder::private_reply)
    /// - [`reply`](PlatformCommentRuleBuilder::reply)
    pub fn build(self) -> Result<PlatformCommentRule, BuildError> {
        Ok(PlatformCommentRule {
            platform: self
                .platform
                .ok_or_else(|| BuildError::missing_field("platform"))?,
            private_reply: self
                .private_reply
                .ok_or_else(|| BuildError::missing_field("private_reply"))?,
            reply: self
                .reply
                .ok_or_else(|| BuildError::missing_field("reply"))?,
        })
    }
}
