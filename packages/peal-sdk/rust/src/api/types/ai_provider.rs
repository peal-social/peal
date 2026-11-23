pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum AiProvider {
    Anthropic,
    Openai,
    Google,
    Mistral,
    Xai,
    Groq,
    Togetherai,
    Deepseek,
    Openrouter,
    Cerebras,
    Fireworks,
    OpenaiCompatible,
    Elevenlabs,
    Fal,
    Shotstack,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for AiProvider {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Anthropic => serializer.serialize_str("anthropic"),
            Self::Openai => serializer.serialize_str("openai"),
            Self::Google => serializer.serialize_str("google"),
            Self::Mistral => serializer.serialize_str("mistral"),
            Self::Xai => serializer.serialize_str("xai"),
            Self::Groq => serializer.serialize_str("groq"),
            Self::Togetherai => serializer.serialize_str("togetherai"),
            Self::Deepseek => serializer.serialize_str("deepseek"),
            Self::Openrouter => serializer.serialize_str("openrouter"),
            Self::Cerebras => serializer.serialize_str("cerebras"),
            Self::Fireworks => serializer.serialize_str("fireworks"),
            Self::OpenaiCompatible => serializer.serialize_str("openai-compatible"),
            Self::Elevenlabs => serializer.serialize_str("elevenlabs"),
            Self::Fal => serializer.serialize_str("fal"),
            Self::Shotstack => serializer.serialize_str("shotstack"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for AiProvider {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "anthropic" => Ok(Self::Anthropic),
            "openai" => Ok(Self::Openai),
            "google" => Ok(Self::Google),
            "mistral" => Ok(Self::Mistral),
            "xai" => Ok(Self::Xai),
            "groq" => Ok(Self::Groq),
            "togetherai" => Ok(Self::Togetherai),
            "deepseek" => Ok(Self::Deepseek),
            "openrouter" => Ok(Self::Openrouter),
            "cerebras" => Ok(Self::Cerebras),
            "fireworks" => Ok(Self::Fireworks),
            "openai-compatible" => Ok(Self::OpenaiCompatible),
            "elevenlabs" => Ok(Self::Elevenlabs),
            "fal" => Ok(Self::Fal),
            "shotstack" => Ok(Self::Shotstack),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for AiProvider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Anthropic => write!(f, "anthropic"),
            Self::Openai => write!(f, "openai"),
            Self::Google => write!(f, "google"),
            Self::Mistral => write!(f, "mistral"),
            Self::Xai => write!(f, "xai"),
            Self::Groq => write!(f, "groq"),
            Self::Togetherai => write!(f, "togetherai"),
            Self::Deepseek => write!(f, "deepseek"),
            Self::Openrouter => write!(f, "openrouter"),
            Self::Cerebras => write!(f, "cerebras"),
            Self::Fireworks => write!(f, "fireworks"),
            Self::OpenaiCompatible => write!(f, "openai-compatible"),
            Self::Elevenlabs => write!(f, "elevenlabs"),
            Self::Fal => write!(f, "fal"),
            Self::Shotstack => write!(f, "shotstack"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
