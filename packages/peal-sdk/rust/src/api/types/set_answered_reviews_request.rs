pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SetAnsweredReviewsRequest {
    #[serde(default)]
    pub answered: bool,
}

impl SetAnsweredReviewsRequest {
    pub fn builder() -> SetAnsweredReviewsRequestBuilder {
        <SetAnsweredReviewsRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SetAnsweredReviewsRequestBuilder {
    answered: Option<bool>,
}

impl SetAnsweredReviewsRequestBuilder {
    pub fn answered(mut self, value: bool) -> Self {
        self.answered = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`SetAnsweredReviewsRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`answered`](SetAnsweredReviewsRequestBuilder::answered)
    pub fn build(self) -> Result<SetAnsweredReviewsRequest, BuildError> {
        Ok(SetAnsweredReviewsRequest {
            answered: self
                .answered
                .ok_or_else(|| BuildError::missing_field("answered"))?,
        })
    }
}
