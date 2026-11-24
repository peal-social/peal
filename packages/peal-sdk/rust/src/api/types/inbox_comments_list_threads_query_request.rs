pub use crate::prelude::*;

/// Query parameters for listThreads
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct InboxCommentsListThreadsQueryRequest {
    #[serde(rename = "channelId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<String>,
    #[serde(rename = "postId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unanswered: Option<ListThreadsCommentsRequestUnanswered>,
}

impl InboxCommentsListThreadsQueryRequest {
    pub fn builder() -> InboxCommentsListThreadsQueryRequestBuilder {
        <InboxCommentsListThreadsQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct InboxCommentsListThreadsQueryRequestBuilder {
    channel_id: Option<String>,
    cursor: Option<String>,
    limit: Option<String>,
    post_id: Option<String>,
    unanswered: Option<ListThreadsCommentsRequestUnanswered>,
}

impl InboxCommentsListThreadsQueryRequestBuilder {
    pub fn channel_id(mut self, value: impl Into<String>) -> Self {
        self.channel_id = Some(value.into());
        self
    }

    pub fn cursor(mut self, value: impl Into<String>) -> Self {
        self.cursor = Some(value.into());
        self
    }

    pub fn limit(mut self, value: impl Into<String>) -> Self {
        self.limit = Some(value.into());
        self
    }

    pub fn post_id(mut self, value: impl Into<String>) -> Self {
        self.post_id = Some(value.into());
        self
    }

    pub fn unanswered(mut self, value: ListThreadsCommentsRequestUnanswered) -> Self {
        self.unanswered = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`InboxCommentsListThreadsQueryRequest`].
    pub fn build(self) -> Result<InboxCommentsListThreadsQueryRequest, BuildError> {
        Ok(InboxCommentsListThreadsQueryRequest {
            channel_id: self.channel_id,
            cursor: self.cursor,
            limit: self.limit,
            post_id: self.post_id,
            unanswered: self.unanswered,
        })
    }
}
