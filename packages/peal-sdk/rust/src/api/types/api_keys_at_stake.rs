pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ApiKeysAtStake {
    #[serde(default)]
    pub removal: i64,
    #[serde(default)]
    pub roles: ApiKeysAtStakeRoles,
}

impl ApiKeysAtStake {
    pub fn builder() -> ApiKeysAtStakeBuilder {
        <ApiKeysAtStakeBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ApiKeysAtStakeBuilder {
    removal: Option<i64>,
    roles: Option<ApiKeysAtStakeRoles>,
}

impl ApiKeysAtStakeBuilder {
    pub fn removal(mut self, value: i64) -> Self {
        self.removal = Some(value);
        self
    }

    pub fn roles(mut self, value: ApiKeysAtStakeRoles) -> Self {
        self.roles = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ApiKeysAtStake`].
    /// This method will fail if any of the following fields are not set:
    /// - [`removal`](ApiKeysAtStakeBuilder::removal)
    /// - [`roles`](ApiKeysAtStakeBuilder::roles)
    pub fn build(self) -> Result<ApiKeysAtStake, BuildError> {
        Ok(ApiKeysAtStake {
            removal: self
                .removal
                .ok_or_else(|| BuildError::missing_field("removal"))?,
            roles: self
                .roles
                .ok_or_else(|| BuildError::missing_field("roles"))?,
        })
    }
}
