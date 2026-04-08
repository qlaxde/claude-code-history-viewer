use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

/// Cross-platform atomic rename.
///
/// On Unix, `fs::rename` atomically replaces the target.
/// On Windows, `fs::rename` fails if the target already exists,
/// so we remove the target first.
pub fn atomic_rename(from: &Path, to: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if to.exists() {
            fs::remove_file(to)
                .map_err(|e| format!("Failed to remove existing file {}: {e}", to.display()))?;
        }
    }

    fs::rename(from, to).map_err(|e| {
        // Clean up temp file on failure
        let _ = fs::remove_file(from);
        format!(
            "Failed to rename {} to {}: {e}",
            from.display(),
            to.display()
        )
    })
}

/// Resolves a path that may use `~/` against the current home directory.
pub fn resolve_home_path(path: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    Ok(if let Some(stripped) = path.strip_prefix("~/") {
        home.join(stripped)
    } else {
        PathBuf::from(path)
    })
}

/// Returns Claude's configured plans directory, defaulting to `~/.claude/plans`.
pub fn get_plans_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let default_dir = home.join(".claude").join("plans");
    let settings_path = home.join(".claude").join("settings.json");

    if let Ok(content) = fs::read_to_string(settings_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(path) = json
                .get("plansDirectory")
                .and_then(serde_json::Value::as_str)
            {
                return resolve_home_path(path);
            }
        }
    }

    Ok(default_dir)
}

/// Acquires a simple cross-process lock via a lock file, runs `operation`, then releases it.
pub fn with_lock_file<T>(
    lock_path: &Path,
    operation: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    const LOCK_TIMEOUT: Duration = Duration::from_secs(5);
    const LOCK_RETRY_DELAY: Duration = Duration::from_millis(50);
    const STALE_LOCK_AGE: Duration = Duration::from_secs(30);

    if let Some(parent) = lock_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create lock directory '{}': {e}",
                parent.display()
            )
        })?;
    }

    let deadline = Instant::now() + LOCK_TIMEOUT;
    loop {
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(lock_path)
        {
            Ok(_lock_file) => break,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let is_stale = fs::metadata(lock_path)
                    .and_then(|metadata| metadata.modified())
                    .ok()
                    .and_then(|modified| modified.elapsed().ok())
                    .map(|elapsed| elapsed >= STALE_LOCK_AGE)
                    .unwrap_or(false);

                if is_stale {
                    let _ = fs::remove_file(lock_path);
                    continue;
                }

                if Instant::now() >= deadline {
                    return Err(format!(
                        "Timed out waiting for file lock '{}': {error}",
                        lock_path.display()
                    ));
                }

                thread::sleep(LOCK_RETRY_DELAY);
            }
            Err(error) => {
                return Err(format!(
                    "Failed to acquire file lock '{}': {error}",
                    lock_path.display()
                ));
            }
        }
    }

    let result = operation();
    let _ = fs::remove_file(lock_path);
    result
}
