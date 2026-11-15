pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SiteSignInCallback {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default)]
    pub state: String,
}

impl SiteSignInCallback {
    pub fn builder() -> SiteSignInCallbackBuilder {
        <SiteSignInCallbackBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SiteSignInCallbackBuilder {
    code: Option<String>,
    error: Option<String>,
    state: Option<String>,
}

impl SiteSignInCallbackBuilder {
    pub fn code(mut self, value: impl Into<String>) -> Self {
        self.code = Some(value.into());
        self
    }

    pub fn error(mut self, value: impl Into<String>) -> Self {
        self.error = Some(value.into());
        self
    }

    pub fn state(mut self, value: impl Into<String>) -> Self {
        self.state = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`SiteSignInCallback`].
    /// This method will fail if any of the following fields are not set:
    /// - [`state`](SiteSignInCallbackBuilder::state)
    pub fn build(self) -> Result<SiteSignInCallback, BuildError> {
        Ok(SiteSignInCallback {
            code: self.code,
            error: self.error,
            state: self
                .state
                .ok_or_else(|| BuildError::missing_field("state"))?,
        })
    }
}
