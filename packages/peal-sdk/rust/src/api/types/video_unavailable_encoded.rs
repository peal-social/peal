pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct VideoUnavailableEncoded {
    #[serde(rename = "_tag")]
    pub tag: VideoUnavailableEncodedTag,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub reason: VideoUnavailableEncodedReason,
}

impl VideoUnavailableEncoded {
    pub fn builder() -> VideoUnavailableEncodedBuilder {
        <VideoUnavailableEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VideoUnavailableEncodedBuilder {
    tag: Option<VideoUnavailableEncodedTag>,
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    reason: Option<VideoUnavailableEncodedReason>,
}

impl VideoUnavailableEncodedBuilder {
    pub fn tag(mut self, value: VideoUnavailableEncodedTag) -> Self {
        self.tag = Some(value);
        self
    }

    pub fn code(mut self, value: impl Into<String>) -> Self {
        self.code = Some(value.into());
        self
    }

    pub fn message(mut self, value: impl Into<String>) -> Self {
        self.message = Some(value.into());
        self
    }

    pub fn request_id(mut self, value: impl Into<String>) -> Self {
        self.request_id = Some(value.into());
        self
    }

    pub fn reason(mut self, value: VideoUnavailableEncodedReason) -> Self {
        self.reason = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`VideoUnavailableEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`tag`](VideoUnavailableEncodedBuilder::tag)
    /// - [`reason`](VideoUnavailableEncodedBuilder::reason)
    pub fn build(self) -> Result<VideoUnavailableEncoded, BuildError> {
        Ok(VideoUnavailableEncoded {
            tag: self.tag.ok_or_else(|| BuildError::missing_field("tag"))?,
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
        })
    }
}
