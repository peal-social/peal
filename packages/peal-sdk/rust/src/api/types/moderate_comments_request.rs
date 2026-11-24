pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ModerateCommentsRequest {
    pub action: InboxModerationAction,
}

impl ModerateCommentsRequest {
    pub fn builder() -> ModerateCommentsRequestBuilder {
        <ModerateCommentsRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ModerateCommentsRequestBuilder {
    action: Option<InboxModerationAction>,
}

impl ModerateCommentsRequestBuilder {
    pub fn action(mut self, value: InboxModerationAction) -> Self {
        self.action = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ModerateCommentsRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`action`](ModerateCommentsRequestBuilder::action)
    pub fn build(self) -> Result<ModerateCommentsRequest, BuildError> {
        Ok(ModerateCommentsRequest {
            action: self
                .action
                .ok_or_else(|| BuildError::missing_field("action"))?,
        })
    }
}
