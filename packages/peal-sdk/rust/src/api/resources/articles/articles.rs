use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, QueryBuilder, RequestOptions};
use reqwest::Method;

pub struct ArticlesClient {
    pub http_client: HttpClient,
}

impl ArticlesClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Lists the workspace's articles, newest first, 50 a page unless `limit` (at most 100) says otherwise, those in one `status` when it is given, and those scheduled from `from` (included) to `to` (excluded) when either is given, which leaves out drafts. Each article comes without its body: get reads it whole. Pass the page's `nextCursor` as `cursor`, with the same filters, for the next. Needs post:read.
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
    ///         .articles
    ///         .list(
    ///             &ArticlesListQueryRequest {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn list(
        &self,
        request: &ArticlesListQueryRequest,
        options: Option<RequestOptions>,
    ) -> Result<ArticlePage, ApiError> {
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
                "api/v1/articles",
                None,
                QueryBuilder::new()
                    .string("cursor", request.cursor.clone())
                    .string("from", request.from.clone())
                    .string("limit", request.limit.clone())
                    .serialize("status", request.status.clone())
                    .string("to", request.to.clone())
                    .build(),
                options,
            )
            .await
    }

    /// Writes an article for one of the workspace's websites (a channel connected with connectSite): a draft, or scheduled at once with `schedule`. A scheduled article is checked as the site would take it (ArticleRejected lists every violation); its images are files of the workspace's library, ready (UnknownMedia otherwise), the cover an image. Refused (ArticleRejected `approvalRequired`) while your posts need an approval, which articles cannot have yet, and (PlanLimitReached) while the workspace holds more channels or members than its plan allows. Needs post:create, and post:schedule with `schedule`.
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
    ///         .articles
    ///         .create(
    ///             &NewArticle {
    ///                 body: ArticleBody {
    ///                     content: vec![],
    ///                     r#type: ArticleBodyType::Doc,
    ///                 },
    ///                 title: "title".to_string(),
    ///                 channel_id: "channelId".to_string(),
    ///                 categories: None,
    ///                 cover_media_id: None,
    ///                 excerpt: None,
    ///                 site_status: None,
    ///                 tags: None,
    ///                 schedule: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn create(
        &self,
        request: &NewArticle,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                "api/v1/articles",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Reads an article. Needs post:read.
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
    ///     client.articles.get(&"articleId".to_string(), None).await;
    /// }
    /// ```
    pub async fn get(
        &self,
        article_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                &format!("api/v1/articles/{}", article_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Deletes the article from Peal, and its job when it waits to go out; never while it is being sent. A post already on the site stays there: unpublish it first. Needs post:delete.
    ///
    /// # Arguments
    ///
    /// * `options` - Additional request options such as headers, timeout, etc.
    ///
    /// # Returns
    ///
    /// Empty response
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
    ///     client.articles.delete(&"articleId".to_string(), None).await;
    /// }
    /// ```
    pub async fn delete(
        &self,
        article_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<(), ApiError> {
        let options = {
            let mut o = options.unwrap_or_default();
            o.additional_headers
                .entry("Peal-Version".to_string())
                .or_insert_with(|| "2026-11-09".to_string());
            Some(o)
        };
        self.http_client
            .execute_request(
                Method::DELETE,
                &format!("api/v1/articles/{}", article_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Replaces what a draft, a scheduled article or one that failed says. A scheduled article is checked again and keeps its time; it is refused (ArticleRejected `approvalRequired`) while your posts need an approval. Once on the site, use updateOnSite. Needs post:update.
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
    ///         .articles
    ///         .update(
    ///             &"articleId".to_string(),
    ///             &ArticleInput {
    ///                 body: ArticleBody {
    ///                     content: vec![],
    ///                     r#type: ArticleBodyType::Doc,
    ///                 },
    ///                 categories: None,
    ///                 cover_media_id: None,
    ///                 excerpt: None,
    ///                 site_status: None,
    ///                 tags: None,
    ///                 title: "title".to_string(),
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn update(
        &self,
        article_id: &str,
        request: &ArticleInput,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                Method::PATCH,
                &format!("api/v1/articles/{}", article_id),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Schedules a draft, moves a scheduled article, or schedules one that failed again: Peal sends it at `at`, or now without it, and the site makes it what `siteStatus` says. With `future`, the site publishes it at `at`, which must be ahead, and Peal sends it at once. Everything is checked as the site would take it. What goes out is public, and cannot be taken back from Peal but by unpublishing it. Refused (ArticleRejected `approvalRequired`) while your posts need an approval, which articles cannot have yet, and (PlanLimitReached) while the workspace holds more channels or members than its plan allows. Needs post:schedule.
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
    ///         .articles
    ///         .schedule(
    ///             &"articleId".to_string(),
    ///             &ArticleTime {
    ///                 time_zone: "timeZone".to_string(),
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn schedule(
        &self,
        article_id: &str,
        request: &ArticleTime,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                &format!("api/v1/articles/{}/schedule", article_id),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Takes a scheduled article back to draft: nothing is sent. Needs post:schedule.
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
    ///         .articles
    ///         .unschedule(&"articleId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn unschedule(
        &self,
        article_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                &format!("api/v1/articles/{}/unschedule", article_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Sends a failed article again now, or one that was unconfirmed once a member checked it is not on the site: Peal never sends an unconfirmed article again on its own. Refused (ArticleRejected `approvalRequired`) while your posts need an approval, which articles cannot have yet, and (PlanLimitReached) while the workspace holds more channels or members than its plan allows. Needs post:schedule.
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
    ///     client.articles.retry(&"articleId".to_string(), None).await;
    /// }
    /// ```
    pub async fn retry(
        &self,
        article_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                &format!("api/v1/articles/{}/retry", article_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Moves the article's post to the site's trash, where the site keeps it for a while (30 days by default on WordPress) before deleting it; it stays published in Peal, with `removedAt`. Needs post:publish; an OAuth client needs the scope workspace:publish.
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
    ///         .articles
    ///         .unpublish(&"articleId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn unpublish(
        &self,
        article_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                &format!("api/v1/articles/{}/unpublish", article_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Replaces what the article's post says on the site (title, body, excerpt, tags, categories, cover), at once: the site keeps its status and its date, and files it has already are not sent again; a cover or an excerpt removed is removed there. Refused (ArticleRejected `approvalRequired`) while your posts need an approval, which articles cannot have yet, and (PlanLimitReached) while the workspace holds more channels or members than its plan allows. Needs post:publish; an OAuth client needs the scope workspace:publish.
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
    ///         .articles
    ///         .update_on_site(
    ///             &"articleId".to_string(),
    ///             &ArticleInput {
    ///                 body: ArticleBody {
    ///                     content: vec![],
    ///                     r#type: ArticleBodyType::Doc,
    ///                 },
    ///                 categories: None,
    ///                 cover_media_id: None,
    ///                 excerpt: None,
    ///                 site_status: None,
    ///                 tags: None,
    ///                 title: "title".to_string(),
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn update_on_site(
        &self,
        article_id: &str,
        request: &ArticleInput,
        options: Option<RequestOptions>,
    ) -> Result<Article, ApiError> {
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
                &format!("api/v1/articles/{}/site", article_id),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }
}
