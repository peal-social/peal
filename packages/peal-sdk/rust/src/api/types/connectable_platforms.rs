pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ConnectablePlatforms {
    #[serde(rename = "instagramConnections")]
    #[serde(default)]
    pub instagram_connections: Vec<InstagramConnection>,
    #[serde(rename = "linkedinConnections")]
    #[serde(default)]
    pub linkedin_connections: Vec<LinkedInConnection>,
    #[serde(default)]
    pub platforms: Vec<Platform>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chats: Option<Vec<ChatPlatform>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sites: Option<Vec<SitePlatform>>,
}

impl ConnectablePlatforms {
    pub fn builder() -> ConnectablePlatformsBuilder {
        <ConnectablePlatformsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ConnectablePlatformsBuilder {
    instagram_connections: Option<Vec<InstagramConnection>>,
    linkedin_connections: Option<Vec<LinkedInConnection>>,
    platforms: Option<Vec<Platform>>,
    chats: Option<Vec<ChatPlatform>>,
    sites: Option<Vec<SitePlatform>>,
}

impl ConnectablePlatformsBuilder {
    pub fn instagram_connections(mut self, value: Vec<InstagramConnection>) -> Self {
        self.instagram_connections = Some(value);
        self
    }

    pub fn linkedin_connections(mut self, value: Vec<LinkedInConnection>) -> Self {
        self.linkedin_connections = Some(value);
        self
    }

    pub fn platforms(mut self, value: Vec<Platform>) -> Self {
        self.platforms = Some(value);
        self
    }

    pub fn chats(mut self, value: Vec<ChatPlatform>) -> Self {
        self.chats = Some(value);
        self
    }

    pub fn sites(mut self, value: Vec<SitePlatform>) -> Self {
        self.sites = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ConnectablePlatforms`].
    /// This method will fail if any of the following fields are not set:
    /// - [`instagram_connections`](ConnectablePlatformsBuilder::instagram_connections)
    /// - [`linkedin_connections`](ConnectablePlatformsBuilder::linkedin_connections)
    /// - [`platforms`](ConnectablePlatformsBuilder::platforms)
    pub fn build(self) -> Result<ConnectablePlatforms, BuildError> {
        Ok(ConnectablePlatforms {
            instagram_connections: self
                .instagram_connections
                .ok_or_else(|| BuildError::missing_field("instagram_connections"))?,
            linkedin_connections: self
                .linkedin_connections
                .ok_or_else(|| BuildError::missing_field("linkedin_connections"))?,
            platforms: self
                .platforms
                .ok_or_else(|| BuildError::missing_field("platforms"))?,
            chats: self.chats,
            sites: self.sites,
        })
    }
}
