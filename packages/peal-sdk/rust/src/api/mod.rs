//! API client and types for the Peal API
//!
//! This module contains all the API definitions including request/response types
//! and client implementations for interacting with the API.
//!
//! ## Modules
//!
//! - [`resources`] - Service clients and endpoints
//! - [`types`] - Request, response, and model types

pub mod resources;
pub mod types;

pub use resources::{
    AdsClient, AnalyticsClient, ApprovalsClient, ArticlesClient, AssistantClient,
    AutomationsClient, ChannelsClient, CredentialClient, InboxClient, LinksClient, MediaClient,
    PartnerClient, PealClient, PostsClient, SystemClient, WebhooksClient, WorkspaceClient,
};
pub use types::*;
