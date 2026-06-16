//! Best-effort usage-to-cost estimation in GBP (£).
//!
//! To produce a useful "£ spent" figure, we assume a per-window token budget 
//! (typically 1M tokens) and apply blended per-vendor token rates in GBP.
//!
//! Blended USD per 1M tokens multiplied by USD-to-GBP exchange rate (0.79).

use super::{CostEstimate, ModelVendor, Snapshot, UsageWindow};

const TOKEN_BUDGET_PER_WINDOW: f64 = 1_000_000.0;
const USD_TO_GBP: f64 = 0.79;

impl ModelVendor {
    pub fn rate_per_mtu_gbp(self) -> f64 {
        let usd_rate = match self {
            ModelVendor::Gemini => 1.25,
            ModelVendor::Claude => 3.00,
            ModelVendor::Gpt => 5.00,
            ModelVendor::Other => 2.00,
        };
        usd_rate * USD_TO_GBP
    }
}

/// Compute a cost estimate for a Codex-style snapshot: one headline window
/// (the most-constrained) drives the figure, billed at the GPT rate.
pub fn for_codex(windows: &[UsageWindow]) -> CostEstimate {
    let headline = windows
        .iter()
        .min_by_key(|w| (w.used_percent * 1000.0) as i64)
        .or_else(|| windows.iter().max_by_key(|w| w.used_percent as i64))
        .or_else(|| windows.first());
    
    let used_fraction = headline
        .map(|w| w.used_percent.clamp(0.0, 100.0) / 100.0)
        .unwrap_or(0.0);
    let rate = ModelVendor::Gpt.rate_per_mtu_gbp();
    let tokens_used = used_fraction * TOKEN_BUDGET_PER_WINDOW;
    CostEstimate {
        estimated_gbp: tokens_used * rate / 1_000_000.0,
        tokens_used,
        token_budget: TOKEN_BUDGET_PER_WINDOW,
        rate_per_mtu_gbp: rate,
    }
}

/// Compute a cost estimate for an Antigravity-style snapshot: sum each model's
/// own used fraction × budget × that model's vendor rate.
pub fn for_antigravity(windows: &[UsageWindow]) -> CostEstimate {
    let mut total_gbp = 0.0;
    let mut total_tokens = 0.0;
    let mut total_budget = 0.0;
    let mut weighted_rate = 0.0;

    let mut contributing_models = 0;
    for w in windows {
        for m in &w.models {
            let Some(used_pct) = m.used_percent else { continue };
            let frac = (used_pct.clamp(0.0, 100.0) / 100.0).max(0.0);
            let rate = m.vendor.rate_per_mtu_gbp();
            let tokens = frac * TOKEN_BUDGET_PER_WINDOW;
            total_gbp += tokens * rate / 1_000_000.0;
            total_tokens += tokens;
            total_budget += TOKEN_BUDGET_PER_WINDOW;
            weighted_rate += rate;
            contributing_models += 1;
        }
    }

    if contributing_models == 0 {
        let headline = windows
            .iter()
            .map(|w| w.used_percent)
            .fold(0.0_f64, f64::max);
        let frac = headline.clamp(0.0, 100.0) / 100.0;
        let rate = ModelVendor::Gemini.rate_per_mtu_gbp();
        let tokens = frac * TOKEN_BUDGET_PER_WINDOW;
        return CostEstimate {
            estimated_gbp: tokens * rate / 1_000_000.0,
            tokens_used: tokens,
            token_budget: TOKEN_BUDGET_PER_WINDOW,
            rate_per_mtu_gbp: rate,
        };
    }

    CostEstimate {
        estimated_gbp: total_gbp,
        tokens_used: total_tokens,
        token_budget: total_budget,
        rate_per_mtu_gbp: weighted_rate / contributing_models as f64,
    }
}

/// Sum a set of snapshots into an overall cost estimate.
pub fn aggregate(snapshots: &[&Snapshot]) -> CostEstimate {
    let (gbp, tokens, budget, n) = snapshots.iter().fold(
        (0.0_f64, 0.0_f64, 0.0_f64, 0_usize),
        |(gbp, tok, bud, n), s| {
            (
                gbp + s.cost.estimated_gbp,
                tok + s.cost.tokens_used,
                bud + s.cost.token_budget,
                n + 1,
            )
        },
    );
    CostEstimate {
        estimated_gbp: gbp,
        tokens_used: tokens,
        token_budget: budget,
        rate_per_mtu_gbp: if n > 0 { gbp * 1_000_000.0 / tokens.max(1.0) } else { 0.0 },
    }
}
