pub use crate::prelude::*;

/// What Peal reads and does on an ad account, as its network allows: a client hides what is false (the ads list, boosting and spending, reach, results).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AdAccountCapabilities {
    #[serde(default)]
    pub ads: bool,
    #[serde(default)]
    pub boosts: bool,
    #[serde(default)]
    pub reach: bool,
    #[serde(default)]
    pub results: bool,
}

impl AdAccountCapabilities {
    pub fn builder() -> AdAccountCapabilitiesBuilder {
        <AdAccountCapabilitiesBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AdAccountCapabilitiesBuilder {
    ads: Option<bool>,
    boosts: Option<bool>,
    reach: Option<bool>,
    results: Option<bool>,
}

impl AdAccountCapabilitiesBuilder {
    pub fn ads(mut self, value: bool) -> Self {
        self.ads = Some(value);
        self
    }

    pub fn boosts(mut self, value: bool) -> Self {
        self.boosts = Some(value);
        self
    }

    pub fn reach(mut self, value: bool) -> Self {
        self.reach = Some(value);
        self
    }

    pub fn results(mut self, value: bool) -> Self {
        self.results = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AdAccountCapabilities`].
    /// This method will fail if any of the following fields are not set:
    /// - [`ads`](AdAccountCapabilitiesBuilder::ads)
    /// - [`boosts`](AdAccountCapabilitiesBuilder::boosts)
    /// - [`reach`](AdAccountCapabilitiesBuilder::reach)
    /// - [`results`](AdAccountCapabilitiesBuilder::results)
    pub fn build(self) -> Result<AdAccountCapabilities, BuildError> {
        Ok(AdAccountCapabilities {
            ads: self.ads.ok_or_else(|| BuildError::missing_field("ads"))?,
            boosts: self
                .boosts
                .ok_or_else(|| BuildError::missing_field("boosts"))?,
            reach: self
                .reach
                .ok_or_else(|| BuildError::missing_field("reach"))?,
            results: self
                .results
                .ok_or_else(|| BuildError::missing_field("results"))?,
        })
    }
}
