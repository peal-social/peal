use crate::api::*;
use crate::{ApiError, ClientConfig, HttpClient, QueryBuilder, RequestOptions};
use reqwest::Method;

pub struct ChannelsClient {
    pub http_client: HttpClient,
}

impl ChannelsClient {
    pub fn new(config: ClientConfig) -> Result<Self, ApiError> {
        Ok(Self {
            http_client: HttpClient::new(config.clone())?,
        })
    }

    /// Lists the channels connected to the workspace, oldest first. Their tokens are never shown. Needs channel:read.
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
    ///     client.channels.list(None).await;
    /// }
    /// ```
    pub async fn list(&self, options: Option<RequestOptions>) -> Result<Vec<Channel>, ApiError> {
        let options = {
            let mut o = options.unwrap_or_default();
            o.additional_headers
                .entry("Peal-Version".to_string())
                .or_insert_with(|| "2026-11-09".to_string());
            Some(o)
        };
        self.http_client
            .execute_request(Method::GET, "api/v1/channels", None, None, options)
            .await
    }

    /// Lists the workspace's channels a page at a time, oldest first: 50 unless `limit` (at most 100) says otherwise. Every filter given must hold: `platform`, `status` (`active`, `refreshNeeded` or `disabled`) and `q`, text the channel's handle, the name its platform shows or the name the workspace gave it holds, whatever its case. `counts` says how many channels the platform and text match in each status, whatever the status asked for. Pass the page's `nextCursor` as `cursor`, with the same filters, for the next page; a cursor no page gave is a bad request. Needs channel:read.
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
    ///         .find(
    ///             &FindQueryRequest {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn find(
        &self,
        request: &FindQueryRequest,
        options: Option<RequestOptions>,
    ) -> Result<ChannelPage, ApiError> {
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
                "api/v1/channels/search",
                None,
                QueryBuilder::new()
                    .string("cursor", request.cursor.clone())
                    .string("limit", request.limit.clone())
                    .serialize("platform", request.platform.clone())
                    .string("q", request.q.clone())
                    .serialize("status", request.status.clone())
                    .build(),
                options,
            )
            .await
    }

    /// Lists the platforms this server can connect accounts of, in Peal's order. A platform that needs a setting the server lacks, such as an app registered on LinkedIn, X or Meta or a Google OAuth client, is left out. `platforms` are those with a sign-in page; the chats, which connect with a secret (connectChat), are in `chats`, and the websites in `sites`. Needs channel:connect.
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
    ///     client.channels.platforms(None).await;
    /// }
    /// ```
    pub async fn platforms(
        &self,
        options: Option<RequestOptions>,
    ) -> Result<ConnectablePlatforms, ApiError> {
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
                "api/v1/channels/platforms",
                None,
                None,
                options,
            )
            .await
    }

    /// Connects a website, to publish articles to it: a WordPress site, by its address, the login name of the user Peal publishes as and an application password made for Peal on that user's profile page. Peal finds the site's REST API, checks the user may publish posts and upload files, and keeps the password encrypted. The site must be on HTTPS at a public address (SiteNotConnected `addressNotAllowed`); one that has no WordPress REST API is `notWordPress`, a refused password `credentialsRefused`, a user who may not publish `cannotPublish`. A site that does not answer, or fails on its side, is PlatformUnreachable. The REST API must be on the same site as the home page (`addressNotAllowed`). A site the workspace has already, at the same home page, is reconnected with the new password, even where its API's address changed. A site counts as one channel: a new one needs room in the workspace's plan (PlanLimitReached), checked before the site is called. A workspace tries 30 times an hour at most (SiteConnectLimited). Needs channel:connect.
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
    ///         .connect_site(
    ///             &ConnectSite {
    ///                 address: "address".to_string(),
    ///                 application_password: "applicationPassword".to_string(),
    ///                 platform: SitePlatform::Wordpress,
    ///                 user_name: "userName".to_string(),
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn connect_site(
        &self,
        request: &ConnectSite,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                "api/v1/channels/websites",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Connects an account on a publishing platform, to publish articles to it, with a key the member made there for Peal: on DEV (`devto`), an API key from the account's settings (Extensions); on Hashnode (`hashnode`), a personal access token from the account's settings (Developer) and the publication's address in `publication`, which may be left out when the member has only one. Peal checks the key on the platform and keeps it encrypted; the channel is the account the key belongs to, on Hashnode the publication. A key the platform refuses is SiteNotConnected `credentialsRefused`; a Hashnode publication that is not found is `publicationNotFound`, one of a team that lists the member as a contributor `cannotPublish` (a member the publication keeps private is connected, and the first article says whether they may publish), one to name among several `publicationRequired`, and one without Hashnode's Pro plan, which its API needs for every request, `planRequired`; a platform that does not answer, or fails on its side, is PlatformUnreachable. An account the workspace has already is reconnected with the new key. An account counts as one channel: a new one needs room in the workspace's plan (PlanLimitReached), checked before the platform is called when the workspace has no channel of it. A workspace tries 30 times an hour at most, all ways of connecting a website together (SiteConnectLimited). Needs channel:connect.
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
    ///         .connect_site_with_key(
    ///             &ConnectSiteWithKey {
    ///                 api_key: "apiKey".to_string(),
    ///                 platform: KeySitePlatform::Devto,
    ///                 publication: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn connect_site_with_key(
        &self,
        request: &ConnectSiteWithKey,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                "api/v1/channels/websites/keys",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Connects a chat, to post to it, with a secret its member pastes, no sign-in page: a Discord channel (`discord`) by its webhook's address, from the channel's settings (Integrations, Webhooks); a Telegram channel or group (`telegram`) by the token of the member's own bot and the chat, its public name (`@name`) or its id. Peal checks on the platform that the secret posts there, and keeps it encrypted: both platforms carry it in their addresses, which Peal never logs. An address that is not a Discord webhook's is ChatNotConnected `addressNotAWebhook`, before any call; a webhook Discord does not have `webhookNotFound`, one that does not post messages `webhookKindNotSupported`; a bot's token Telegram refuses `credentialsRefused`, a chat it does not know or the bot is not in `chatNotFound`, a private chat `chatKindNotSupported`, and a chat the bot may not post in `cannotPost` (in a channel, the bot must be an administrator who may post messages). A platform that does not answer, or fails on its side, is PlatformUnreachable. One channel per chat: the same chat again (another webhook of the same Discord channel, say) reconnects its channel with the new secret. With `channelId`, it reconnects that channel, and the secret must reach its chat again (ConnectFailed `accountMismatch`). A chat counts as one channel: a new one needs room in the workspace's plan (PlanLimitReached), checked before the platform is called when the workspace has no chat of that platform. A workspace tries 30 times an hour at most (ChatConnectLimited). A server without its token keyring answers ConnectFailed `notConfigured`. Needs channel:connect.
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
    ///         .connect_chat(
    ///             &ConnectChat::Discord {
    ///                 data: ConnectDiscordChat {
    ///                     webhook_url: "webhookUrl".to_string(),
    ///                     ..Default::default()
    ///                 },
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn connect_chat(
        &self,
        request: &ConnectChat,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                "api/v1/channels/chats",
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Starts connecting a website by signing in on its platform: on WordPress.com (`wordpressCom`), a site there or a Jetpack site the member reaches there, which the member picks on WordPress.com's page. Answers with that page, where the browser goes next; the connection is tied to the caller and the workspace, and must be completed within 15 minutes. With `channelId`, it reconnects that channel, and the sign-in must reach its site again. A server without the platform's app answers ConnectFailed `notConfigured`. A new site needs room in the workspace's plan (PlanLimitReached), checked now when the workspace has no site of that platform. A workspace tries 30 times an hour at most, all ways of connecting a website together (SiteConnectLimited). Needs channel:connect.
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
    ///         .start_site_sign_in(
    ///             &OAuthSitePlatform::WordpressCom,
    ///             &StartSiteSignIn {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn start_site_sign_in(
        &self,
        platform: &OAuthSitePlatform,
        request: &StartSiteSignIn,
        options: Option<RequestOptions>,
    ) -> Result<Authorization, ApiError> {
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
                &format!("api/v1/channels/websites/sign-in/{}", platform),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Completes a website sign-in with what the platform sent back: the site becomes a channel of the workspace, or the channel it reconnects takes its new token. Only the member who started it can complete it, once. A member who may not publish posts and upload files on the site is SiteNotConnected `cannotPublish`; a reconnect that reached another site ConnectFailed `accountMismatch`. A new site needs room in the workspace's plan (PlanLimitReached). Needs channel:connect.
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
    ///         .complete_site_sign_in(
    ///             &OAuthSitePlatform::WordpressCom,
    ///             &SiteSignInCallback {
    ///                 state: "state".to_string(),
    ///                 code: None,
    ///                 error: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn complete_site_sign_in(
        &self,
        platform: &OAuthSitePlatform,
        request: &SiteSignInCallback,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                &format!("api/v1/channels/websites/sign-in/{}/callback", platform),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Starts connecting an account of the platform: answers with the platform's sign-in page, where the browser goes next. For Instagram, `connection` picks Instagram Login (the professional account itself, no Facebook Page needed), Facebook Login (the accounts linked to the caller's Pages) or Unified login (`unifiedLogin`: the accounts a business portfolio shares, signing in with Instagram or Facebook, no Facebook Page needed); without it, the server's preferred way. The connection is tied to the caller and the workspace, and must be completed within 15 minutes. On a server that bills, a workspace whose plan allows no more channels gets PlanLimitReached, and an X account needs a payment method on per-account pricing, as X's calls are billed at X's rates (UsageAllowanceReached `xApi`, `paymentMethodRequired` without one). Needs channel:connect.
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
    ///         .connect(
    ///             &Platform::X,
    ///             &ConnectChannel {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn connect(
        &self,
        platform: &Platform,
        request: &ConnectChannel,
        options: Option<RequestOptions>,
    ) -> Result<Authorization, ApiError> {
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
                &format!("api/v1/channels/connect/{}", platform),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Completes a connection with what the platform sent back: the account becomes a channel of the workspace, or the channel it reconnects takes its new tokens. When the sign-in reached several accounts, as the Pages a Facebook user manages, the answer lists them instead, to choose with chooseAccounts. Only the member who started the connection can complete it, once. A new account needs room in the workspace's plan (PlanLimitReached), and, on a server that bills, an X account a payment method (UsageAllowanceReached `xApi`). Needs channel:connect.
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
    ///         .complete_connect(
    ///             &Platform::X,
    ///             &ConnectCallback {
    ///                 state: "state".to_string(),
    ///                 code: None,
    ///                 error: None,
    ///                 iss: None,
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn complete_connect(
        &self,
        platform: &Platform,
        request: &ConnectCallback,
        options: Option<RequestOptions>,
    ) -> Result<ConnectOutcome, ApiError> {
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
                &format!("api/v1/channels/connect/{}/callback", platform),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Connects the accounts the member chose among those a completed sign-in listed: each becomes a channel of the workspace, or reconnects the one it has. The new accounts chosen need room in the workspace's plan, all of them: otherwise none is connected (PlanLimitReached), and the choice can be made again with fewer. Only the member who completed the sign-in can choose, within 15 minutes, and once an account is connected: a choice that failed before connecting any can be made again. Needs channel:connect.
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
    ///         .choose_accounts(
    ///             &Platform::X,
    ///             &ChooseAccounts {
    ///                 account_ids: vec!["accountIds".to_string()],
    ///                 selection: "selection".to_string(),
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn choose_accounts(
        &self,
        platform: &Platform,
        request: &ChooseAccounts,
        options: Option<RequestOptions>,
    ) -> Result<Vec<Channel>, ApiError> {
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
                &format!("api/v1/channels/connect/{}/accounts", platform),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Starts reconnecting a channel whose token stopped working or is about to: answers with the platform's sign-in page. Completing it must sign in to the same account. A channel the workspace has takes no room in its plan, so no plan limit refuses it. With `messages=true`, the sign-in also asks for the account's direct messages where the platform asks for them apart: on Bluesky, the chat methods' permissions; on a Facebook Page or an Instagram account, Meta's messaging permissions, where the server reads their messages. Turning a channel's messages on needs them (`setChannelMessages` answers 409 `InboxActionUnavailable`, `reconnect`, until they are granted). A reconnect of a Bluesky channel that granted them asks them again, so its messages stay readable. With `reposts=true`, a Bluesky sign-in also asks to repost the account's own posts, which a follow-up rule that reposts there needs (its channel shows `reconnect` until it is granted); a reconnect of a channel that granted it asks it again. Needs channel:connect.
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
    ///         .reconnect(
    ///             &"channelId".to_string(),
    ///             &ReconnectQueryRequest {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn reconnect(
        &self,
        channel_id: &str,
        request: &ReconnectQueryRequest,
        options: Option<RequestOptions>,
    ) -> Result<Authorization, ApiError> {
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
                &format!("api/v1/channels/{}/reconnect", channel_id),
                None,
                QueryBuilder::new()
                    .serialize("messages", request.messages.clone())
                    .serialize("reposts", request.reposts.clone())
                    .build(),
                options,
            )
            .await
    }

    /// Disconnects a channel from the workspace: the channel and the tokens Peal holds for it are deleted, and nothing more is posted on it. Needs channel:disconnect.
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
    ///         .channels
    ///         .disconnect(&"channelId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn disconnect(
        &self,
        channel_id: &str,
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
                &format!("api/v1/channels/{}", channel_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Gives the channel the name the workspace calls it by (`label`, 60 characters at most, on one line), or takes it back with null. The name is Peal's own: it is shown beside the handle and name the platform gives the account, which stay, and is sent to no platform. Needs channel:connect.
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
    ///         .update(
    ///             &"channelId".to_string(),
    ///             &ChannelUpdate {
    ///                 ..Default::default()
    ///             },
    ///             None,
    ///         )
    ///         .await;
    /// }
    /// ```
    pub async fn update(
        &self,
        channel_id: &str,
        request: &ChannelUpdate,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                &format!("api/v1/channels/{}", channel_id),
                Some(serde_json::to_value(request).map_err(ApiError::Serialization)?),
                None,
                options,
            )
            .await
    }

    /// Turns the channel off: nothing goes out on it until it is turned back on. It keeps its connection, its history, its name and its place in the plan's count, and no reconnect reminder is sent meanwhile. A post that reaches its time while the channel is off fails on that channel (`channelDisabled`) and goes out on its others; it is not sent later. A channel already off stays as it is. Needs channel:connect.
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
    ///         .disable(&"channelId".to_string(), None)
    ///         .await;
    /// }
    /// ```
    pub async fn disable(
        &self,
        channel_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                &format!("api/v1/channels/{}/disable", channel_id),
                None,
                None,
                options,
            )
            .await
    }

    /// Turns a channel back on. It posts again at once, or has the status `refreshNeeded` when its token stopped working or ran out while it was off: reconnect the account then. A channel that is on stays as it is. Needs channel:connect.
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
    ///     client.channels.enable(&"channelId".to_string(), None).await;
    /// }
    /// ```
    pub async fn enable(
        &self,
        channel_id: &str,
        options: Option<RequestOptions>,
    ) -> Result<Channel, ApiError> {
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
                &format!("api/v1/channels/{}/enable", channel_id),
                None,
                None,
                options,
            )
            .await
    }
}
