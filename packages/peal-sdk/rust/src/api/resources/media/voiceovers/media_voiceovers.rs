use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, RequestOptions};
use reqwest::Method;

pub struct VoiceoversClient {
    pub http_client: HttpClient,
}

impl VoiceoversClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Asks the provider the workspace chose for voice-overs (`PUT .../assistant/models/speech`) to speak the text, in `voice` when given, and answers with the audio as a new file of the media library, marked `aiGenerated`, without a description. Only the workspace's own provider speaks, with its key, under its terms and at its prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest voice-over before anything is asked. Neither the text nor the audio is logged. Needs assistant:use and media:upload.
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
    ///         .media
    ///         .voiceovers
    ///         .create(
    ///             &VoiceoverRequest {
    ///                 text: "text".to_string(),
    ///                 voice: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn create(
        &self,
        request: &VoiceoverRequest,
        options: Option<RequestOptions>,
    ) -> Result<Media, ApiError> {
        let options = {
            let mut o = options.unwrap_or_default();
            o.additional_headers
                .entry("Peal-Version".to_string())
                .or_insert_with(|| "2026-11-09".to_string());
            o.max_retries = Some(0);
            Some(o)
        };
        self.http_client
            .execute_request(
                Method::POST,
                "api/v1/media/voiceovers",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }
}
