pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "_tag")]
#[non_exhaustive]
pub enum AssistantAction {
    #[serde(rename = "rewrite")]
    #[non_exhaustive]
    Rewrite { tone: AssistantTone },

    #[serde(rename = "shorten")]
    #[non_exhaustive]
    Shorten {
        #[serde(skip_serializing_if = "Option::is_none")]
        media: Option<bool>,
        platform: Platform,
    },

    #[serde(rename = "translate")]
    #[non_exhaustive]
    Translate { language: TranslationLanguage },

    #[serde(rename = "hashtags")]
    #[non_exhaustive]
    Hashtags {},

    #[serde(rename = "write")]
    #[non_exhaustive]
    Write {
        #[serde(skip_serializing_if = "Option::is_none")]
        language: Option<TranslationLanguage>,
        #[serde(skip_serializing_if = "Option::is_none")]
        media: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        platform: Option<Platform>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tone: Option<AssistantTone>,
    },

    /// Catch-all variant for unrecognized discriminant values.
    /// If the server sends a discriminant not recognized by the current SDK
    /// version, the raw payload is captured here so callers can still inspect it.
    #[serde(untagged)]
    __Unknown(serde_json::Value),
}

impl AssistantAction {
    pub fn rewrite(tone: AssistantTone) -> Self {
        Self::Rewrite { tone }
    }

    pub fn shorten(platform: Platform) -> Self {
        Self::Shorten {
            media: None,
            platform,
        }
    }

    pub fn translate(language: TranslationLanguage) -> Self {
        Self::Translate { language }
    }

    pub fn hashtags() -> Self {
        Self::Hashtags {}
    }

    pub fn write() -> Self {
        Self::Write {
            language: None,
            media: None,
            platform: None,
            tone: None,
        }
    }

    pub fn shorten_with_media(media: bool, platform: Platform) -> Self {
        Self::Shorten {
            media: Some(media),
            platform,
        }
    }

    pub fn write_with_language(
        language: TranslationLanguage,
        media: Option<bool>,
        platform: Option<Platform>,
        tone: Option<AssistantTone>,
    ) -> Self {
        Self::Write {
            language: Some(language),
            media,
            platform,
            tone,
        }
    }

    pub fn write_with_media(
        language: Option<TranslationLanguage>,
        media: bool,
        platform: Option<Platform>,
        tone: Option<AssistantTone>,
    ) -> Self {
        Self::Write {
            language,
            media: Some(media),
            platform,
            tone,
        }
    }

    pub fn write_with_platform(
        language: Option<TranslationLanguage>,
        media: Option<bool>,
        platform: Platform,
        tone: Option<AssistantTone>,
    ) -> Self {
        Self::Write {
            language,
            media,
            platform: Some(platform),
            tone,
        }
    }

    pub fn write_with_tone(
        language: Option<TranslationLanguage>,
        media: Option<bool>,
        platform: Option<Platform>,
        tone: AssistantTone,
    ) -> Self {
        Self::Write {
            language,
            media,
            platform,
            tone: Some(tone),
        }
    }

    pub fn unknown(value: serde_json::Value) -> Self {
        Self::__Unknown(value)
    }
}
