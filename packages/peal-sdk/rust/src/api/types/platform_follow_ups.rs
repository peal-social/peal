pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PlatformFollowUps {
    pub comment: PlatformFollowUpComment,
    pub platform: Platform,
    pub repost: PlatformFollowUpRepost,
}

impl PlatformFollowUps {
    pub fn builder() -> PlatformFollowUpsBuilder {
        <PlatformFollowUpsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct PlatformFollowUpsBuilder {
    comment: Option<PlatformFollowUpComment>,
    platform: Option<Platform>,
    repost: Option<PlatformFollowUpRepost>,
}

impl PlatformFollowUpsBuilder {
    pub fn comment(mut self, value: PlatformFollowUpComment) -> Self {
        self.comment = Some(value);
        self
    }

    pub fn platform(mut self, value: Platform) -> Self {
        self.platform = Some(value);
        self
    }

    pub fn repost(mut self, value: PlatformFollowUpRepost) -> Self {
        self.repost = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`PlatformFollowUps`].
    /// This method will fail if any of the following fields are not set:
    /// - [`comment`](PlatformFollowUpsBuilder::comment)
    /// - [`platform`](PlatformFollowUpsBuilder::platform)
    /// - [`repost`](PlatformFollowUpsBuilder::repost)
    pub fn build(self) -> Result<PlatformFollowUps, BuildError> {
        Ok(PlatformFollowUps {
            comment: self
                .comment
                .ok_or_else(|| BuildError::missing_field("comment"))?,
            platform: self
                .platform
                .ok_or_else(|| BuildError::missing_field("platform"))?,
            repost: self
                .repost
                .ok_or_else(|| BuildError::missing_field("repost"))?,
        })
    }
}
