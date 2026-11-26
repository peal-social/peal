pub use crate::prelude::*;

/// The rich-text editor's document: blocks of paragraphs, headings, lists, quotes, rules, code (with its language) and images.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RichText {
    #[serde(default)]
    pub content: Vec<serde_json::Value>,
    pub r#type: RichTextType,
}

impl RichText {
    pub fn builder() -> RichTextBuilder {
        <RichTextBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct RichTextBuilder {
    content: Option<Vec<serde_json::Value>>,
    r#type: Option<RichTextType>,
}

impl RichTextBuilder {
    pub fn content(mut self, value: Vec<serde_json::Value>) -> Self {
        self.content = Some(value);
        self
    }

    pub fn r#type(mut self, value: RichTextType) -> Self {
        self.r#type = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`RichText`].
    /// This method will fail if any of the following fields are not set:
    /// - [`content`](RichTextBuilder::content)
    /// - [`r#type`](RichTextBuilder::r#type)
    pub fn build(self) -> Result<RichText, BuildError> {
        Ok(RichText {
            content: self
                .content
                .ok_or_else(|| BuildError::missing_field("content"))?,
            r#type: self
                .r#type
                .ok_or_else(|| BuildError::missing_field("r#type"))?,
        })
    }
}
