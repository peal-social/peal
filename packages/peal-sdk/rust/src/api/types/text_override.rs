pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct TextOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<RichText>,
    #[serde(rename = "bodyMarkdown")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_markdown: Option<String>,
    #[serde(rename = "channelId")]
    #[serde(default)]
    pub channel_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<Vec<MediaAttachment>>,
    #[serde(default)]
    pub text: String,
}

impl TextOverride {
    pub fn builder() -> TextOverrideBuilder {
        <TextOverrideBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct TextOverrideBuilder {
    body: Option<RichText>,
    body_markdown: Option<String>,
    channel_id: Option<String>,
    media: Option<Vec<MediaAttachment>>,
    text: Option<String>,
}

impl TextOverrideBuilder {
    pub fn body(mut self, value: RichText) -> Self {
        self.body = Some(value);
        self
    }

    pub fn body_markdown(mut self, value: impl Into<String>) -> Self {
        self.body_markdown = Some(value.into());
        self
    }

    pub fn channel_id(mut self, value: impl Into<String>) -> Self {
        self.channel_id = Some(value.into());
        self
    }

    pub fn media(mut self, value: Vec<MediaAttachment>) -> Self {
        self.media = Some(value);
        self
    }

    pub fn text(mut self, value: impl Into<String>) -> Self {
        self.text = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`TextOverride`].
    /// This method will fail if any of the following fields are not set:
    /// - [`channel_id`](TextOverrideBuilder::channel_id)
    /// - [`text`](TextOverrideBuilder::text)
    pub fn build(self) -> Result<TextOverride, BuildError> {
        Ok(TextOverride {
            body: self.body,
            body_markdown: self.body_markdown,
            channel_id: self
                .channel_id
                .ok_or_else(|| BuildError::missing_field("channel_id"))?,
            media: self.media,
            text: self.text.ok_or_else(|| BuildError::missing_field("text"))?,
        })
    }
}
