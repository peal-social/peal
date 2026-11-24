use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, RequestOptions};
use reqwest::Method;

pub mod notices;
pub use notices::NoticesClient;
pub mod notification_preferences;
pub use notification_preferences::NotificationPreferencesClient;
pub struct MeClient {
    pub http_client: HttpClient,
    pub notices: NoticesClient,
    pub notification_preferences: NotificationPreferencesClient,
}

impl MeClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
            notices: NoticesClient::new(config.clone())?,
            notification_preferences: NotificationPreferencesClient::new(config.clone())?,
        })
    }

    /// Answers with the signed-in user and every workspace they belong to, with their role and permissions in each, whether the account has two-step verification on and a password, and whether each workspace requires it (a workspace that requires it refuses the user while it is off). Where the server measures the web app's use, it also says how, with the person's choice about it. API keys belong to a workspace, not a user, and get 403.
    ///
    /// # Arguments
    ///
    /// * `options` - Additional request options such as headers, timeout, etc.
    ///
    /// # Returns
    ///
    /// JSON response from the API
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use peal_sdk::prelude::*;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let config = ClientConfig {
    ///         token: Some("<token>".to_string()),
    ///         ..Default::default()
    ///     };
    ///     let client = PealClient::new(config).expect("Failed to build client");
    ///     client.me.get(None).await;
    /// }
    /// ```
    pub async fn get(&self, options: Option<RequestOptions>) -> Result<Me, ApiError> {
        let options = {
            let mut o = options.unwrap_or_default();
            o.additional_headers
                .entry("Peal-Version".to_string())
                .or_insert_with(|| "2026-11-09".to_string());
            Some(o)
        };
        self.http_client
            .execute_request(Method::GET, "api/me", None, None, options)
            .await
    }
}
