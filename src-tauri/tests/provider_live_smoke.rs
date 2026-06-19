use serde::Deserialize;
use tokenmaxxer_lib::provider::registry;

#[derive(Debug, Deserialize)]
struct ProviderSmokeCase {
    kind: String,
    credentials: serde_json::Value,
    #[serde(default)]
    fetch: bool,
}

#[tokio::test]
#[ignore = "requires live provider credentials; set TOKENMAXXER_PROVIDER_SMOKE_JSON"]
async fn live_provider_credentials_validate_and_optionally_fetch() {
    let path = std::env::var("TOKENMAXXER_PROVIDER_SMOKE_JSON")
        .expect("set TOKENMAXXER_PROVIDER_SMOKE_JSON to a provider smoke JSON file");
    let text = std::fs::read_to_string(&path).expect("read provider smoke JSON");
    let cases: Vec<ProviderSmokeCase> =
        serde_json::from_str(&text).expect("provider smoke JSON is an array");

    assert!(
        !cases.is_empty(),
        "provider smoke JSON must contain at least one case"
    );

    for case in cases {
        let kind = registry::parse_kind(&case.kind)
            .unwrap_or_else(|| panic!("unknown provider kind {}", case.kind));
        let provider = registry::make(kind);
        provider
            .validate(&case.credentials)
            .await
            .unwrap_or_else(|err| panic!("{} validate failed: {err}", case.kind));

        if case.fetch {
            let result = provider
                .fetch(&format!("smoke-{}", case.kind), &case.credentials)
                .await
                .unwrap_or_else(|err| panic!("{} fetch failed: {err}", case.kind));
            assert_eq!(
                result.snapshot.provider_kind.as_deref(),
                Some(kind.as_str()),
                "{} returned the wrong provider kind",
                case.kind
            );
            assert!(
                !result.snapshot.is_stale && result.snapshot.error.is_none(),
                "{} returned a stale/error snapshot",
                case.kind
            );
        }
    }
}
