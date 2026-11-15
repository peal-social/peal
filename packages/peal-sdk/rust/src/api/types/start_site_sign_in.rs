pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct StartSiteSignIn {
    #[serde(rename = "channelId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<String>,
}

impl StartSiteSignIn {
    pub fn builder() -> StartSiteSignInBuilder {
        <StartSiteSignInBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct StartSiteSignInBuilder {
    channel_id: Option<String>,
}

impl StartSiteSignInBuilder {
    pub fn channel_id(mut self, value: impl Into<String>) -> Self {
        self.channel_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`StartSiteSignIn`].
    pub fn build(self) -> Result<StartSiteSignIn, BuildError> {
        Ok(StartSiteSignIn {
            channel_id: self.channel_id,
        })
    }
}
