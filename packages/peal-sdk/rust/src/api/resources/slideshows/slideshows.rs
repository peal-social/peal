use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, QueryBuilder, RequestOptions};
use reqwest::Method;

pub struct SlideshowsClient {
    pub http_client: HttpClient,
}

impl SlideshowsClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Lists the slide videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs assistant:use.
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
    ///         .slideshows
    ///         .list(
    ///             &SlideshowsListQueryRequest {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn list(
        &self,
        request: &SlideshowsListQueryRequest,
        options: Option<RequestOptions>,
    ) -> Result<Slideshows, ApiError> {
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
                "api/v1/media/slideshows",
                None,
                QueryBuilder::new()
                    .serialize("status", request.status.clone())
                    .build(),
                options,
            )
            .await
    }

    /// Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to compose 2 to 10 images of its library, in order, each with an optional caption and motion, optionally over a voice-over of its library, in the aspect asked, and answers 202 with the job, `queued`. Each slide lasts `secondsPerSlide`, or the voice-over's length shared between them, 90 seconds at most in all. Follow it with `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`, MP4 at 1080p), marked `aiGenerated` when a file it is made of was, and the member who asked is told in the app. The service receives each file through a link that works for an hour, and renders with the workspace's own key, under its terms and at its prices: Peal bills nothing for it. Its sandbox, when the connection names it, is free and watermarks every video. On a server that bills, it needs a payment method on the workspace's billing account (CompositionNeedsPayment). One slide video at a time a workspace (CompositionBusy), 20 a UTC day (CompositionAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is composed fails it (`interrupted`). Neither the captions nor the video are logged, and the captions are kept only while the video is composed. Needs assistant:use and media:upload.
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
    ///         .slideshows
    ///         .create(
    ///             &SlideshowRequest {
    ///                 aspect: ImageAspect::Square,
    ///                 slides: vec![Slide {
    ///                     media_id: "mediaId".to_string(),
    ///                     ..Default::default()
    ///                 }],
    ///                 seconds_per_slide: None,
    ///                 transition: None,
    ///                 voiceover_media_id: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn create(
        &self,
        request: &SlideshowRequest,
        options: Option<RequestOptions>,
    ) -> Result<Slideshow, ApiError> {
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
                "api/v1/media/slideshows",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to render a whole [Shotstack Edit](https://shotstack.io/docs/api/#tocs_edit), as a video editor writes it, with the workspace's own Shotstack connection, and answers 202 with the job, `queued`, as a slide video's. A file of the workspace's library is named `peal:media/<mediaId>`: a ready file whose kind its asset takes (images for image assets, videos for video assets, audio for audio assets and the soundtrack, audio or video for captions, an image or a video for a luma matte); a font may also come from `https://fonts.gstatic.com/`; an asset Shotstack generates from a `prompt` needs no file; any other address is refused, and so are merge fields. Peal renders an MP4 (`format` `mp4` or none), at `preview`, `mobile`, `sd`, `hd` or `1080` (none: 1080p), in 16:9, 9:16 or 1:1 (none: 16:9, which gives the job's `aspect`), at 30 frames a second at most, without `size`, `range`, `scaleTo`, `repeat`, `poster` or `thumbnail`; it replaces the destinations, so Shotstack hosts no copy, turns the timeline's cache off and drops `callback` and `disk`. At most 20 tracks and 200 clips, and every clip whose start and length are numbers ends by 300 seconds (`durationSeconds` is the latest such end). The job lists every library file the edit names in `imageMediaIds`, images or not. Follow it with `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library. The service receives each file through a link that works for an hour and renders with the workspace's own key, under its terms and at its prices: Peal bills nothing for it. On a server that bills, it needs a payment method on the workspace's billing account (CompositionNeedsPayment). One job at a time a workspace (CompositionBusy) and 20 a UTC day (CompositionAllowanceReached), shared with slide videos, whatever each ends with. The edit is never logged, and is kept only while the video is rendered. Needs assistant:use and media:upload.
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
    ///         .slideshows
    ///         .create_from_edit(
    ///             &EditRenderRequest {
    ///                 edit: HashMap::from([("key".to_string(), serde_json::json!("value"))]),
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn create_from_edit(
        &self,
        request: &EditRenderRequest,
        options: Option<RequestOptions>,
    ) -> Result<Slideshow, ApiError> {
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
                "api/v1/media/slideshows/edits",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Reads where a slide video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.
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
    ///         .slideshows
    ///         .get(&"slideshowId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn get(
        &self,
        slideshow_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Slideshow, ApiError> {
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
                &format!("api/v1/media/slideshows/{}", slideshow_id),
                None,
                None,
                options,
            )
            .await
    }
}
