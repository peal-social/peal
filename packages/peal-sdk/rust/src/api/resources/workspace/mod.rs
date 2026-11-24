use crate::{ApiError, ClientConfig, HttpClient};

pub mod activity;
pub use activity::ActivityClient;
pub mod api_keys;
pub use api_keys::ApiKeysClient;
pub mod members;
pub use members::MembersClient;
pub mod invitations;
pub use invitations::InvitationsClient;
pub mod billing;
pub use billing::BillingClient;
pub mod usage;
pub use usage::UsageClient;
pub struct WorkspaceClient {
    pub http_client: HttpClient,
    pub activity: ActivityClient,
    pub api_keys: ApiKeysClient,
    pub members: MembersClient,
    pub invitations: InvitationsClient,
    pub billing: BillingClient,
    pub usage: UsageClient,
}

impl WorkspaceClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
            activity: ActivityClient::new(config.clone())?,
            api_keys: ApiKeysClient::new(config.clone())?,
            members: MembersClient::new(config.clone())?,
            invitations: InvitationsClient::new(config.clone())?,
            billing: BillingClient::new(config.clone())?,
            usage: UsageClient::new(config.clone())?,
        })
    }
}
