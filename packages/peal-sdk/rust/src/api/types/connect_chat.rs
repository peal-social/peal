pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "platform")]
#[non_exhaustive]
pub enum ConnectChat {
    #[serde(rename = "discord")]
    #[non_exhaustive]
    Discord {
        #[serde(rename = "channelId")]
        #[serde(skip_serializing_if = "Option::is_none")]
        channel_id: Option<String>,
        #[serde(rename = "webhookUrl")]
        #[serde(default)]
        webhook_url: String,
    },

    #[serde(rename = "telegram")]
    #[non_exhaustive]
    Telegram {
        #[serde(rename = "botToken")]
        #[serde(default)]
        bot_token: String,
        #[serde(default)]
        chat: String,
        #[serde(rename = "channelId")]
        #[serde(skip_serializing_if = "Option::is_none")]
        channel_id: Option<String>,
    },

    /// Catch-all variant for unrecognized discriminant values.
    /// If the server sends a discriminant not recognized by the current SDK
    /// version, the raw payload is captured here so callers can still inspect it.
    #[serde(untagged)]
    __Unknown(serde_json::Value),
}

impl ConnectChat {
    pub fn discord(webhook_url: String) -> Self {
        Self::Discord {
            channel_id: None,
            webhook_url,
        }
    }

    pub fn telegram(bot_token: String, chat: String) -> Self {
        Self::Telegram {
            bot_token,
            chat,
            channel_id: None,
        }
    }

    pub fn discord_with_channel_id(channel_id: String, webhook_url: String) -> Self {
        Self::Discord {
            channel_id: Some(channel_id),
            webhook_url,
        }
    }

    pub fn telegram_with_channel_id(bot_token: String, chat: String, channel_id: String) -> Self {
        Self::Telegram {
            bot_token,
            chat,
            channel_id: Some(channel_id),
        }
    }

    pub fn unknown(value: serde_json::Value) -> Self {
        Self::__Unknown(value)
    }
}
