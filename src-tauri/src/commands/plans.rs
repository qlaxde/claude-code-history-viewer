use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSummary {
    pub slug: String,
    pub title: String,
    pub last_modified: String,
    pub file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_slug: Option<String>,
    #[serde(default)]
    pub is_subagent: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_until_expiry: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanContent {
    pub slug: String,
    pub title: String,
    pub content: String,
    pub last_modified: String,
    pub file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_slug: Option<String>,
    #[serde(default)]
    pub is_subagent: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_until_expiry: Option<i64>,
}

const PLAN_EXPIRY_TTL_DAYS: i64 = 30;

fn plan_slug_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX
        .get_or_init(|| Regex::new(r"^[A-Za-z0-9][A-Za-z0-9._-]*$").expect("valid plan slug regex"))
}

fn parse_plan_title(content: &str, slug: &str) -> String {
    content
        .lines()
        .find_map(|line| line.strip_prefix("# ").map(str::trim))
        .filter(|line| !line.is_empty())
        .unwrap_or(slug)
        .to_string()
}

fn derive_parent_slug(slug: &str) -> (bool, Option<String>) {
    if let Some((parent, _)) = slug.rsplit_once("-agent-") {
        if !parent.is_empty() {
            return (true, Some(parent.to_string()));
        }
    }
    (false, None)
}

fn days_until_expiry_for_modified(modified: std::time::SystemTime) -> i64 {
    let age_days = Utc::now()
        .signed_duration_since(DateTime::<Utc>::from(modified))
        .num_days();
    (PLAN_EXPIRY_TTL_DAYS - age_days).max(0)
}

fn validate_slug(slug: &str) -> Result<(), String> {
    if plan_slug_regex().is_match(slug) {
        Ok(())
    } else {
        Err(format!("Invalid plan slug: {slug}"))
    }
}

fn build_summary(path: &Path) -> Result<PlanSummary, String> {
    let slug = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| format!("Invalid plan file name: {}", path.display()))?
        .to_string();
    validate_slug(&slug)?;

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read plan '{}': {e}", path.display()))?;
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata '{}': {e}", path.display()))?;
    let modified = metadata.modified().unwrap_or(std::time::SystemTime::now());
    let last_modified = DateTime::<Utc>::from(modified).to_rfc3339();
    let (is_subagent, parent_slug) = derive_parent_slug(&slug);

    Ok(PlanSummary {
        slug: slug.clone(),
        title: parse_plan_title(&content, &slug),
        last_modified,
        file_path: path.to_string_lossy().to_string(),
        parent_slug,
        is_subagent,
        days_until_expiry: Some(days_until_expiry_for_modified(modified)),
    })
}

#[tauri::command]
pub async fn scan_plans() -> Result<Vec<PlanSummary>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let plans_dir = super::fs_utils::get_plans_dir()?;
        if !plans_dir.exists() {
            return Ok(Vec::new());
        }

        let mut plans = Vec::new();
        let entries = fs::read_dir(&plans_dir).map_err(|e| {
            format!(
                "Failed to read plans directory '{}': {e}",
                plans_dir.display()
            )
        })?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
                continue;
            }

            if let Ok(summary) = build_summary(&path) {
                plans.push(summary);
            }
        }

        plans.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        Ok(plans)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn load_plan(slug: String) -> Result<PlanContent, String> {
    tauri::async_runtime::spawn_blocking(move || {
        validate_slug(&slug)?;
        let plans_dir = super::fs_utils::get_plans_dir()?;
        let path = plans_dir.join(format!("{slug}.md"));
        if !path.exists() {
            return Err(format!("Plan not found: {slug}"));
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read plan '{}': {e}", path.display()))?;
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to read plan metadata '{}': {e}", path.display()))?;
        let modified = metadata.modified().unwrap_or(std::time::SystemTime::now());
        let last_modified = DateTime::<Utc>::from(modified).to_rfc3339();
        let (is_subagent, parent_slug) = derive_parent_slug(&slug);

        Ok(PlanContent {
            slug: slug.clone(),
            title: parse_plan_title(&content, &slug),
            content,
            last_modified,
            file_path: path.to_string_lossy().to_string(),
            parent_slug,
            is_subagent,
            days_until_expiry: Some(days_until_expiry_for_modified(modified)),
        })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
