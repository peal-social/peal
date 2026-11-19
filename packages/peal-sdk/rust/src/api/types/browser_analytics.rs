pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct BrowserAnalytics {
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub environment: String,
    pub consent: BrowserAnalyticsConsent,
    #[serde(rename = "decidedAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decided_at: Option<String>,
    #[serde(rename = "excludedWorkspaceIds")]
    #[serde(default)]
    pub excluded_workspace_ids: Vec<String>,
}

impl BrowserAnalytics {
    pub fn builder() -> BrowserAnalyticsBuilder {
        <BrowserAnalyticsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct BrowserAnalyticsBuilder {
    token: Option<String>,
    environment: Option<String>,
    consent: Option<BrowserAnalyticsConsent>,
    decided_at: Option<String>,
    excluded_workspace_ids: Option<Vec<String>>,
}

impl BrowserAnalyticsBuilder {
    pub fn token(mut self, value: impl Into<String>) -> Self {
        self.token = Some(value.into());
        self
    }

    pub fn environment(mut self, value: impl Into<String>) -> Self {
        self.environment = Some(value.into());
        self
    }

    pub fn consent(mut self, value: BrowserAnalyticsConsent) -> Self {
        self.consent = Some(value);
        self
    }

    pub fn decided_at(mut self, value: impl Into<String>) -> Self {
        self.decided_at = Some(value.into());
        self
    }

    pub fn excluded_workspace_ids(mut self, value: Vec<String>) -> Self {
        self.excluded_workspace_ids = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`BrowserAnalytics`].
    /// This method will fail if any of the following fields are not set:
    /// - [`token`](BrowserAnalyticsBuilder::token)
    /// - [`environment`](BrowserAnalyticsBuilder::environment)
    /// - [`consent`](BrowserAnalyticsBuilder::consent)
    /// - [`excluded_workspace_ids`](BrowserAnalyticsBuilder::excluded_workspace_ids)
    pub fn build(self) -> Result<BrowserAnalytics, BuildError> {
        Ok(BrowserAnalytics {
            token: self
                .token
                .ok_or_else(|| BuildError::missing_field("token"))?,
            environment: self
                .environment
                .ok_or_else(|| BuildError::missing_field("environment"))?,
            consent: self
                .consent
                .ok_or_else(|| BuildError::missing_field("consent"))?,
            decided_at: self.decided_at,
            excluded_workspace_ids: self
                .excluded_workspace_ids
                .ok_or_else(|| BuildError::missing_field("excluded_workspace_ids"))?,
        })
    }
}
