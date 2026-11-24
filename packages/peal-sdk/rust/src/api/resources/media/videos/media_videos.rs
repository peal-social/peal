use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, QueryBuilder, RequestOptions};
use reqwest::Method;

pub struct VideosClient {
    pub http_client: HttpClient,
}

impl VideosClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Lists the videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs assistant:use.
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
    ///         .videos
    ///         .list(
    ///             &MediaVideosListQueryRequest {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn list(
        &self,
        request: &MediaVideosListQueryRequest,
        options: Option<RequestOptions>,
    ) -> Result<VideoGenerations, ApiError> {
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
                "api/v1/media/videos/generations",
                None,
                QueryBuilder::new()
                    .serialize("status", request.status.clone())
                    .build(),
                options,
            )
            .await
    }

    /// Asks the provider the workspace chose for videos (`PUT .../assistant/models/video`) for one video from the prompt, in the aspect asked, optionally of a length and from a first frame, and answers 202 with the job, `queued`: making a video takes minutes. Follow it with `GET .../media/videos/generations/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`), ready to attach, marked `aiGenerated`, and the member who asked is told in the app. Only the workspace's own provider makes videos, with its key, under its terms and at its prices: Peal bills nothing for them. One video at a time a workspace (VideoBusy), 20 a UTC day (VideoAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is made fails it (`interrupted`), as the provider may have made and billed it. Neither the prompt nor the video is logged, and the prompt is kept only while the video is made. Needs assistant:use and media:upload.
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
    ///         .videos
    ///         .create(
    ///             &VideoGenerationRequest {
    ///                 aspect: ImageAspect::Square,
    ///                 prompt: "prompt".to_string(),
    ///                 duration_seconds: None,
    ///                 image_media_id: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn create(
        &self,
        request: &VideoGenerationRequest,
        options: Option<RequestOptions>,
    ) -> Result<VideoGeneration, ApiError> {
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
                "api/v1/media/videos/generations",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Reads where a video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.
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
    ///         .videos
    ///         .get(&"generationId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn get(
        &self,
        generation_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<VideoGeneration, ApiError> {
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
                &format!("api/v1/media/videos/generations/{}", generation_id),
                None,
                None,
                options,
            )
            .await
    }
}
