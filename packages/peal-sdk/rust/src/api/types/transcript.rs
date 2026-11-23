pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Transcript {
    #[serde(rename = "descriptionSaved")]
    #[serde(default)]
    pub description_saved: bool,
    #[serde(rename = "durationSeconds")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<TranscriptDurationSeconds>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(default)]
    pub text: String,
}

impl Transcript {
    pub fn builder() -> TranscriptBuilder {
        <TranscriptBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct TranscriptBuilder {
    description_saved: Option<bool>,
    duration_seconds: Option<TranscriptDurationSeconds>,
    language: Option<String>,
    text: Option<String>,
}

impl TranscriptBuilder {
    pub fn description_saved(mut self, value: bool) -> Self {
        self.description_saved = Some(value);
        self
    }

    pub fn duration_seconds(mut self, value: TranscriptDurationSeconds) -> Self {
        self.duration_seconds = Some(value);
        self
    }

    pub fn language(mut self, value: impl Into<String>) -> Self {
        self.language = Some(value.into());
        self
    }

    pub fn text(mut self, value: impl Into<String>) -> Self {
        self.text = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`Transcript`].
    /// This method will fail if any of the following fields are not set:
    /// - [`description_saved`](TranscriptBuilder::description_saved)
    /// - [`text`](TranscriptBuilder::text)
    pub fn build(self) -> Result<Transcript, BuildError> {
        Ok(Transcript {
            description_saved: self
                .description_saved
                .ok_or_else(|| BuildError::missing_field("description_saved"))?,
            duration_seconds: self.duration_seconds,
            language: self.language,
            text: self.text.ok_or_else(|| BuildError::missing_field("text"))?,
        })
    }
}
