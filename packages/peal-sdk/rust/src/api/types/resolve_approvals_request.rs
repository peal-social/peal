pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ResolveApprovalsRequest {
    #[serde(default)]
    pub resolved: bool,
}

impl ResolveApprovalsRequest {
    pub fn builder() -> ResolveApprovalsRequestBuilder {
        <ResolveApprovalsRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ResolveApprovalsRequestBuilder {
    resolved: Option<bool>,
}

impl ResolveApprovalsRequestBuilder {
    pub fn resolved(mut self, value: bool) -> Self {
        self.resolved = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ResolveApprovalsRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`resolved`](ResolveApprovalsRequestBuilder::resolved)
    pub fn build(self) -> Result<ResolveApprovalsRequest, BuildError> {
        Ok(ResolveApprovalsRequest {
            resolved: self
                .resolved
                .ok_or_else(|| BuildError::missing_field("resolved"))?,
        })
    }
}
