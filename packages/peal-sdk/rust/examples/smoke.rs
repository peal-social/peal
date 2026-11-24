//! The smoke test, which scripts/test.ts runs against a stand-in API: the
//! health check, the credential check with a bearer token, and the error a
//! refused token raises.
use peal_sdk::prelude::*;

fn client(base_url: &str, token: &str) -> PealClient {
    PealClient::new(ClientConfig {
        base_url: base_url.to_string(),
        token: Some(token.to_string()),
        ..Default::default()
    })
    .expect("the client builds")
}

#[tokio::main]
async fn main() {
    let base_url = std::env::var("PEAL_API_URL").expect("scripts/test.ts sets PEAL_API_URL");
    let peal = client(&base_url, "peal_test");

    peal.system.health(None).await.expect("the health check answers");
    let credential = peal
        .credential
        .get(None)
        .await
        .expect("GET /api/v1/credential answers");

    match &credential {
        Credential::ApiKey {
            expires_at,
            permissions,
            start,
            workspace,
            ..
        } => {
            assert_eq!(workspace.name, "Studio");
            assert!(expires_at.is_none() && start.is_none());
            assert!(permissions.contains(&Permission::PostSchedule));
        }
        other => panic!("unexpected answer: {other:?}"),
    }

    let refused = client(&base_url, "refused").credential.get(None).await;
    assert!(
        matches!(refused, Err(ApiError::UnauthorizedError { .. })),
        "a refused token: {refused:?}"
    );

    println!("ok");
}
