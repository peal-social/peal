pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ConnectSiteWithKey {
    #[serde(rename = "apiKey")]
    #[serde(default)]
    pub api_key: String,
    pub platform: KeySitePlatform,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publication: Option<String>,
}

impl ConnectSiteWithKey {
    pub fn builder() -> ConnectSiteWithKeyBuilder {
        <ConnectSiteWithKeyBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ConnectSiteWithKeyBuilder {
    api_key: Option<String>,
    platform: Option<KeySitePlatform>,
    publication: Option<String>,
}

impl ConnectSiteWithKeyBuilder {
    pub fn api_key(mut self, value: impl Into<String>) -> Self {
        self.api_key = Some(value.into());
        self
    }

    pub fn platform(mut self, value: KeySitePlatform) -> Self {
        self.platform = Some(value);
        self
    }

    pub fn publication(mut self, value: impl Into<String>) -> Self {
        self.publication = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`ConnectSiteWithKey`].
    /// This method will fail if any of the following fields are not set:
    /// - [`api_key`](ConnectSiteWithKeyBuilder::api_key)
    /// - [`platform`](ConnectSiteWithKeyBuilder::platform)
    pub fn build(self) -> Result<ConnectSiteWithKey, BuildError> {
        Ok(ConnectSiteWithKey {
            api_key: self
                .api_key
                .ok_or_else(|| BuildError::missing_field("api_key"))?,
            platform: self
                .platform
                .ok_or_else(|| BuildError::missing_field("platform"))?,
            publication: self.publication,
        })
    }
}
