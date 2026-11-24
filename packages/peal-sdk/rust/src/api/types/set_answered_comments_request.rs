pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SetAnsweredCommentsRequest {
    #[serde(default)]
    pub answered: bool,
}

impl SetAnsweredCommentsRequest {
    pub fn builder() -> SetAnsweredCommentsRequestBuilder {
        <SetAnsweredCommentsRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SetAnsweredCommentsRequestBuilder {
    answered: Option<bool>,
}

impl SetAnsweredCommentsRequestBuilder {
    pub fn answered(mut self, value: bool) -> Self {
        self.answered = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`SetAnsweredCommentsRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`answered`](SetAnsweredCommentsRequestBuilder::answered)
    pub fn build(self) -> Result<SetAnsweredCommentsRequest, BuildError> {
        Ok(SetAnsweredCommentsRequest {
            answered: self
                .answered
                .ok_or_else(|| BuildError::missing_field("answered"))?,
        })
    }
}
