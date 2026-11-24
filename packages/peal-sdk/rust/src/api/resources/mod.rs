//! Service clients and API endpoints
//!
//! This module contains client implementations for:
//!
//! - **posts**
//! - **approvals**
//! - **channels**
//! - **media**
//! - **analytics**
//! - **ads**
//! - **articles**
//! - **links**
//! - **webhooks**
//! - **assistant**
//! - **partner**
//! - **me**
//! - **credential**
//! - **system**
//! - **Automations**
//! - **Inbox**
//! - **Workspace**

use crate::{ApiError, ClientConfig};

pub mod ads;
pub mod analytics;
pub mod approvals;
pub mod articles;
pub mod assistant;
pub mod automations;
pub mod channels;
pub mod credential;
pub mod inbox;
pub mod links;
pub mod me;
pub mod media;
pub mod partner;
pub mod posts;
pub mod system;
pub mod webhooks;
pub mod workspace;
pub struct PealClient {
    pub config: ClientConfig,
    pub posts: PostsClient,
    pub approvals: ApprovalsClient,
    pub channels: ChannelsClient,
    pub media: MediaClient,
    pub analytics: AnalyticsClient,
    pub ads: AdsClient,
    pub articles: ArticlesClient,
    pub links: LinksClient,
    pub webhooks: WebhooksClient,
    pub assistant: AssistantClient,
    pub partner: PartnerClient,
    pub me: MeClient,
    pub credential: CredentialClient,
    pub system: SystemClient,
    pub automations: AutomationsClient,
    pub inbox: InboxClient,
    pub workspace: WorkspaceClient,
}

impl PealClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            config: config.clone(),
            posts: PostsClient::new(config.clone())?,
            approvals: ApprovalsClient::new(config.clone())?,
            channels: ChannelsClient::new(config.clone())?,
            media: MediaClient::new(config.clone())?,
            analytics: AnalyticsClient::new(config.clone())?,
            ads: AdsClient::new(config.clone())?,
            articles: ArticlesClient::new(config.clone())?,
            links: LinksClient::new(config.clone())?,
            webhooks: WebhooksClient::new(config.clone())?,
            assistant: AssistantClient::new(config.clone())?,
            partner: PartnerClient::new(config.clone())?,
            me: MeClient::new(config.clone())?,
            credential: CredentialClient::new(config.clone())?,
            system: SystemClient::new(config.clone())?,
            automations: AutomationsClient::new(config.clone())?,
            inbox: InboxClient::new(config.clone())?,
            workspace: WorkspaceClient::new(config.clone())?,
        })
    }
}

pub use ads::AdsClient;
pub use analytics::AnalyticsClient;
pub use approvals::ApprovalsClient;
pub use articles::ArticlesClient;
pub use assistant::AssistantClient;
pub use automations::AutomationsClient;
pub use channels::ChannelsClient;
pub use credential::CredentialClient;
pub use inbox::InboxClient;
pub use links::LinksClient;
pub use me::MeClient;
pub use media::MediaClient;
pub use partner::PartnerClient;
pub use posts::PostsClient;
pub use system::SystemClient;
pub use webhooks::WebhooksClient;
pub use workspace::WorkspaceClient;
