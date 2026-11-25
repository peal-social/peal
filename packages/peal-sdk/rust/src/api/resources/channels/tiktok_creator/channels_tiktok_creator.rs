use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, RequestOptions};
use reqwest::Method;

pub struct TiktokCreatorClient {
    pub http_client: HttpClient,
}

impl TiktokCreatorClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Reads a TikTok channel's creator from TikTok: their nickname, the audiences the account offers, the interactions they turned off and the longest video they may post, or why they cannot post now. A channel the workspace does not have, or that is not TikTok's, is ChannelNotFound; a channel turned off, or whose account must be reconnected (TikTok refused its credential, or it lacks a permission), ChannelCannotPost; TikTok not answering, or refusing the read, PlatformUnreachable; TikTok asking to slow down, PlatformRateLimited. Needs post:create.
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
    ///     client
    ///         .channels
    ///         .tiktok_creator
    ///         .get(&"channelId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn get(
        &self,
        channel_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<TikTokAccount, ApiError> {
        let options = {
            let mut o = options.unwrap_or_default();
            o.additional_headers
                .entry("Peal-Version".to_string())
                .or_insert_with(|| "2026-11-09".to_string());
            Some(o)
        };
        self.http_client
            .execute_request(
                Method::GET,
                &format!("api/v1/channels/{}/tiktok-creator", channel_id),
                None,
                None,
                options,
            )
            .await
    }
}
