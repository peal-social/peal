use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, QueryBuilder, RequestOptions};
use reqwest::Method;

pub struct CommentRulesClient {
    pub http_client: HttpClient,
}

impl CommentRulesClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Lists the workspace's comment rules, oldest first, 50 a page unless `limit` (at most 100) says otherwise, those with `status` alone when given, each with what its channels can carry and the latest 20 comments it matched. A rule's `privateReply`, and each match's `privateCode`, `privateReplyId` and `privateStatus`, are null to a reader who may not read private replies: one without engagement:readMessages, or an application the owner did not let read the workspace's messages. Needs engagement:read.
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
    ///         .automations
    ///         .comment_rules
    ///         .list(
    ///             &AutomationsCommentRulesListQueryRequest {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn list(
        &self,
        request: &AutomationsCommentRulesListQueryRequest,
        options: Option<RequestOptions>,
    ) -> Result<CommentRulePage, ApiError> {
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
                "api/v1/automations/comment-rules",
                None,
                QueryBuilder::new()
                    .string("cursor", request.cursor.clone())
                    .string("limit", request.limit.clone())
                    .serialize("status", request.status.clone())
                    .build(),
                options,
            )
            .await
    }

    /// Starts a rule on the comments of a post that went out (`postId`) or of every post of a channel (`channelId`), exactly one of them, with 1 to 10 `keywords`, a `reply` and, optionally, a `privateReply`. A rule answers, by itself and in public, as the channel's account, a comment written after it started or was last set going again, under a post it answers on (a post's rule acts on the channels the post is for, scheduled or out), that holds one of its keywords as a word (whatever its case and accents): with its `reply`, once a comment and once a person, 25 replies a day at most, and 100 a day for every rule of a channel together, through the inbox's own replies (their journal, one reply a comment, each one of the billing account's outbound messages). It answers on Mastodon, and on Facebook Pages and Instagram where the server reads their comments; Bluesky's, X's, LinkedIn's and YouTube's rules forbid an app to answer by itself, and `channels` says so. It never likes or follows anyone. With a `privateReply`, it also sends the author of each comment it answered that one private message, once its public reply is out: only on Instagram and Facebook Pages, whose platforms let an account send a commenter one message within 7 days of the comment, only where the channel's messages are on (a channel that cannot carry it answers in public only, and the match's `privateCode` says why), never twice to a comment, whoever sent the first, and never to anyone who did not comment. It acts as whoever started it, with what they may do then: it ends when they can no longer answer comments, and when its channel is disconnected. It is refused when no channel it answers on can carry its reply, or its private reply when it has one (CommentRuleNotPossible, with each channel's reason). A workspace keeps 100 rules active or paused. Needs engagement:reply, and engagement:message with a private reply (an application, the owner's consent for messages too); never staff acting as a member.
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
    ///         .automations
    ///         .comment_rules
    ///         .create(
    ///             &NewCommentRule {
    ///                 keywords: vec!["keywords".to_string()],
    ///                 reply: "reply".to_string(),
    ///                 channel_id: None,
    ///                 post_id: None,
    ///                 private_reply: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn create(
        &self,
        request: &NewCommentRule,
        options: Option<RequestOptions>,
    ) -> Result<CommentRule, ApiError> {
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
                "api/v1/automations/comment-rules",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Says, for every platform in Peal's order, whether a comment rule can answer there on this server (`reply`) and send its private reply (`privateReply`): where a rule may be started, before any channel's own standing. A rule on a channel there is still refused when the channel must be connected again, or, for its private reply, when the channel's messages are off; `channels` on the refusal and on the rule says so. Needs engagement:read.
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
    ///     client.automations.comment_rules.platforms(None).await;
    /// }
    /// ```
    pub async fn platforms(
        &self,
        options: Option<RequestOptions>,
    ) -> Result<Vec<PlatformCommentRule>, ApiError> {
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
                "api/v1/automations/comment-rules/platforms",
                None,
                None,
                options,
            )
            .await
    }

    /// Answers a comment rule of the workspace, what its channels can carry and what it matched. A rule's `privateReply`, and each match's `privateCode`, `privateReplyId` and `privateStatus`, are null to a reader who may not read private replies: one without engagement:readMessages, or an application the owner did not let read the workspace's messages. Needs engagement:read.
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
    ///         .automations
    ///         .comment_rules
    ///         .get(&"ruleId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn get(
        &self,
        rule_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<CommentRule, ApiError> {
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
                &format!("api/v1/automations/comment-rules/{}", rule_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Stops a rule: it answers nothing more; the replies it sent stay, and the inbox withdraws one as any other. Needs engagement:reply.
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
    ///     client
    ///         .automations
    ///         .comment_rules
    ///         .delete(&"ruleId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn delete(
        &self,
        rule_id: &str,
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
                &format!("api/v1/automations/comment-rules/{}", rule_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Changes a rule's keywords, reply or private reply (`privateReply` null takes it off), or pauses it (`paused` true) or sets it going again (false); what it leaves out stays. A paused rule looks at nothing, answers no comment received while it was paused, and sends none of the private replies that waited for their public reply. An ended rule changes no more (CommentRuleEnded). Needs engagement:reply, and engagement:message to give a private reply, or to change the keywords or the reply of a rule that holds one or set it going again (an application, the owner's consent for messages too); pausing a rule, or taking its private reply off, needs engagement:reply alone.
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
    ///         .automations
    ///         .comment_rules
    ///         .update(
    ///             &"ruleId".to_string(),
    ///             &CommentRuleChange {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn update(
        &self,
        rule_id: &str,
        request: &CommentRuleChange,
        options: Option<RequestOptions>,
    ) -> Result<CommentRule, ApiError> {
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
                &format!("api/v1/automations/comment-rules/{}", rule_id),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }
}
