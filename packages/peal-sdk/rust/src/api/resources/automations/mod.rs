use crate::{ApiError, ClientConfig, HttpClient};

pub mod comment_rules;
pub use comment_rules::CommentRulesClient;
pub mod queues;
pub use queues::QueuesClient;
pub mod recycling;
pub use recycling::RecyclingClient;
pub mod follow_ups;
pub use follow_ups::FollowUpsClient;
pub mod feeds;
pub use feeds::FeedsClient;
pub struct AutomationsClient {
    pub http_client: HttpClient,
    pub comment_rules: CommentRulesClient,
    pub queues: QueuesClient,
    pub recycling: RecyclingClient,
    pub follow_ups: FollowUpsClient,
    pub feeds: FeedsClient,
}

impl AutomationsClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
            comment_rules: CommentRulesClient::new(config.clone())?,
            queues: QueuesClient::new(config.clone())?,
            recycling: RecyclingClient::new(config.clone())?,
            follow_ups: FollowUpsClient::new(config.clone())?,
            feeds: FeedsClient::new(config.clone())?,
        })
    }
}
