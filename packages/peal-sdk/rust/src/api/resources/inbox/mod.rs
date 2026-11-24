use crate::{ApiError, ClientConfig, HttpClient};

pub mod comments;
pub use comments::CommentsClient;
pub mod messages;
pub use messages::MessagesClient;
pub mod reviews;
pub use reviews::ReviewsClient;
pub struct InboxClient {
    pub http_client: HttpClient,
    pub comments: CommentsClient,
    pub messages: MessagesClient,
    pub reviews: ReviewsClient,
}

impl InboxClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
            comments: CommentsClient::new(config.clone())?,
            messages: MessagesClient::new(config.clone())?,
            reviews: ReviewsClient::new(config.clone())?,
        })
    }
}
