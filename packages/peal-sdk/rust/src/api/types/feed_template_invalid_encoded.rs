pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct FeedTemplateInvalidEncoded {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    pub reason: FeedTemplateInvalidEncodedReason,
}

impl FeedTemplateInvalidEncoded {
    pub fn builder() -> FeedTemplateInvalidEncodedBuilder {
        <FeedTemplateInvalidEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct FeedTemplateInvalidEncodedBuilder {
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    placeholder: Option<String>,
    reason: Option<FeedTemplateInvalidEncodedReason>,
}

impl FeedTemplateInvalidEncodedBuilder {
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

    pub fn placeholder(mut self, value: impl Into<String>) -> Self {
        self.placeholder = Some(value.into());
        self
    }

    pub fn reason(mut self, value: FeedTemplateInvalidEncodedReason) -> Self {
        self.reason = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`FeedTemplateInvalidEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`reason`](FeedTemplateInvalidEncodedBuilder::reason)
    pub fn build(self) -> Result<FeedTemplateInvalidEncoded, BuildError> {
        Ok(FeedTemplateInvalidEncoded {
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            placeholder: self.placeholder,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
        })
    }
}
