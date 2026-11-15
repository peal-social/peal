pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MovedChannel {
    pub channel: Channel,
    #[serde(rename = "postsLeft")]
    #[serde(default)]
    pub posts_left: i64,
}

impl MovedChannel {
    pub fn builder() -> MovedChannelBuilder {
        <MovedChannelBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct MovedChannelBuilder {
    channel: Option<Channel>,
    posts_left: Option<i64>,
}

impl MovedChannelBuilder {
    pub fn channel(mut self, value: Channel) -> Self {
        self.channel = Some(value);
        self
    }

    pub fn posts_left(mut self, value: i64) -> Self {
        self.posts_left = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`MovedChannel`].
    /// This method will fail if any of the following fields are not set:
    /// - [`channel`](MovedChannelBuilder::channel)
    /// - [`posts_left`](MovedChannelBuilder::posts_left)
    pub fn build(self) -> Result<MovedChannel, BuildError> {
        Ok(MovedChannel {
            channel: self
                .channel
                .ok_or_else(|| BuildError::missing_field("channel"))?,
            posts_left: self
                .posts_left
                .ok_or_else(|| BuildError::missing_field("posts_left"))?,
        })
    }
}
