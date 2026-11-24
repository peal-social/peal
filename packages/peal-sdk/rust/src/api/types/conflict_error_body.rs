pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "_tag")]
#[non_exhaustive]
pub enum ConflictErrorBody {
    #[non_exhaustive]
    ChannelAccountTaken {
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        #[serde(rename = "requestId")]
        #[serde(skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        #[serde(rename = "channelId")]
        #[serde(default)]
        channel_id: String,
    },

    #[non_exhaustive]
    IdempotencyKeyReused {
        #[serde(flatten)]
        data: IdempotencyKeyReusedEncoded,
    },

    #[non_exhaustive]
    WorkspaceBusy {
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        #[serde(rename = "requestId")]
        #[serde(skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        #[serde(rename = "workspaceId")]
        #[serde(default)]
        workspace_id: String,
    },

    /// Catch-all variant for unrecognized discriminant values.
    /// If the server sends a discriminant not recognized by the current SDK
    /// version, the raw payload is captured here so callers can still inspect it.
    #[serde(untagged)]
    __Unknown(serde_json::Value),
}

impl ConflictErrorBody {
    pub fn channel_account_taken(channel_id: String) -> Self {
        Self::ChannelAccountTaken {
            code: None,
            message: None,
            request_id: None,
            channel_id,
        }
    }

    pub fn idempotency_key_reused(data: IdempotencyKeyReusedEncoded) -> Self {
        Self::IdempotencyKeyReused { data }
    }

    pub fn workspace_busy(workspace_id: String) -> Self {
        Self::WorkspaceBusy {
            code: None,
            message: None,
            request_id: None,
            workspace_id,
        }
    }

    pub fn channel_account_taken_with_code(
        code: String,
        message: Option<String>,
        request_id: Option<String>,
        channel_id: String,
    ) -> Self {
        Self::ChannelAccountTaken {
            code: Some(code),
            message,
            request_id,
            channel_id,
        }
    }

    pub fn channel_account_taken_with_message(
        code: Option<String>,
        message: String,
        request_id: Option<String>,
        channel_id: String,
    ) -> Self {
        Self::ChannelAccountTaken {
            code,
            message: Some(message),
            request_id,
            channel_id,
        }
    }

    pub fn channel_account_taken_with_request_id(
        code: Option<String>,
        message: Option<String>,
        request_id: String,
        channel_id: String,
    ) -> Self {
        Self::ChannelAccountTaken {
            code,
            message,
            request_id: Some(request_id),
            channel_id,
        }
    }

    pub fn workspace_busy_with_code(
        code: String,
        message: Option<String>,
        request_id: Option<String>,
        workspace_id: String,
    ) -> Self {
        Self::WorkspaceBusy {
            code: Some(code),
            message,
            request_id,
            workspace_id,
        }
    }

    pub fn workspace_busy_with_message(
        code: Option<String>,
        message: String,
        request_id: Option<String>,
        workspace_id: String,
    ) -> Self {
        Self::WorkspaceBusy {
            code,
            message: Some(message),
            request_id,
            workspace_id,
        }
    }

    pub fn workspace_busy_with_request_id(
        code: Option<String>,
        message: Option<String>,
        request_id: String,
        workspace_id: String,
    ) -> Self {
        Self::WorkspaceBusy {
            code,
            message,
            request_id: Some(request_id),
            workspace_id,
        }
    }

    pub fn unknown(value: serde_json::Value) -> Self {
        Self::__Unknown(value)
    }
}
