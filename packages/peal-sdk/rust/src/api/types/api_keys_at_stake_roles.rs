pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct ApiKeysAtStakeRoles {
    #[serde(default)]
    pub admin: i64,
    #[serde(default)]
    pub contributor: i64,
    #[serde(default)]
    pub editor: i64,
    #[serde(default)]
    pub owner: i64,
    #[serde(default)]
    pub viewer: i64,
}

impl ApiKeysAtStakeRoles {
    pub fn builder() -> ApiKeysAtStakeRolesBuilder {
        <ApiKeysAtStakeRolesBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct ApiKeysAtStakeRolesBuilder {
    admin: Option<i64>,
    contributor: Option<i64>,
    editor: Option<i64>,
    owner: Option<i64>,
    viewer: Option<i64>,
}

impl ApiKeysAtStakeRolesBuilder {
    pub fn admin(mut self, value: i64) -> Self {
        self.admin = Some(value);
        self
    }

    pub fn contributor(mut self, value: i64) -> Self {
        self.contributor = Some(value);
        self
    }

    pub fn editor(mut self, value: i64) -> Self {
        self.editor = Some(value);
        self
    }

    pub fn owner(mut self, value: i64) -> Self {
        self.owner = Some(value);
        self
    }

    pub fn viewer(mut self, value: i64) -> Self {
        self.viewer = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`ApiKeysAtStakeRoles`].
    /// This method will fail if any of the following fields are not set:
    /// - [`admin`](ApiKeysAtStakeRolesBuilder::admin)
    /// - [`contributor`](ApiKeysAtStakeRolesBuilder::contributor)
    /// - [`editor`](ApiKeysAtStakeRolesBuilder::editor)
    /// - [`owner`](ApiKeysAtStakeRolesBuilder::owner)
    /// - [`viewer`](ApiKeysAtStakeRolesBuilder::viewer)
    pub fn build(self) -> Result<ApiKeysAtStakeRoles, BuildError> {
        Ok(ApiKeysAtStakeRoles {
            admin: self
                .admin
                .ok_or_else(|| BuildError::missing_field("admin"))?,
            contributor: self
                .contributor
                .ok_or_else(|| BuildError::missing_field("contributor"))?,
            editor: self
                .editor
                .ok_or_else(|| BuildError::missing_field("editor"))?,
            owner: self
                .owner
                .ok_or_else(|| BuildError::missing_field("owner"))?,
            viewer: self
                .viewer
                .ok_or_else(|| BuildError::missing_field("viewer"))?,
        })
    }
}
