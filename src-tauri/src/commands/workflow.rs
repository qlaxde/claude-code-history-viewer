use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningSessionInfo {
    pub session_id: String,
    pub pid: i32,
    pub cpu_percent: f32,
    pub memory_rss_kb: u64,
    pub uptime_seconds: u64,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookInstallResult {
    pub installed: bool,
    pub hook_script_path: String,
    pub settings_path: String,
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create parent directory '{}': {e}",
                parent.display()
            )
        })?;
    }
    let tmp_path = path.with_extension("tmp");
    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file '{}': {e}", tmp_path.display()))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp file '{}': {e}", tmp_path.display()))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync temp file '{}': {e}", tmp_path.display()))?;
    super::fs_utils::atomic_rename(&tmp_path, path)
}

fn metadata_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    Ok(home.join(".claude-history-viewer"))
}

fn hook_script_contents() -> &'static str {
    r"#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLock(lockPath, operation) {
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        return await operation();
      } finally {
        fs.closeSync(fd);
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // ignore cleanup failures
        }
      }
    } catch (error) {
      if (error && error.code === 'EEXIST') {
        try {
          const stats = fs.statSync(lockPath);
          if (Date.now() - stats.mtimeMs > 30000) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch {
          // ignore race while checking stale lock
        }

        if (Date.now() >= deadline) {
          throw new Error(`Timed out waiting for metadata lock: ${lockPath}`);
        }

        await sleep(50);
        continue;
      }

      throw error;
    }
  }
}

function writeJsonAtomically(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  if (process.platform === 'win32' && fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
  fs.renameSync(tempPath, filePath);
}

async function updateMetadata(sessionId) {
  if (!sessionId) return;
  const baseDir = path.join(os.homedir(), '.claude-history-viewer');
  const metadataPath = path.join(baseDir, 'user-data.json');
  const lockPath = `${metadataPath}.lock`;
  ensureDir(baseDir);

  await withLock(lockPath, async () => {
    let metadata = { version: 1, sessions: {}, projects: {}, settings: {} };
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch {
        // keep defaults
      }
    }

    metadata.sessions ||= {};
    const session = metadata.sessions[sessionId] || {};
    const nextStatus = session.status && session.status !== 'active'
      ? session.status
      : 'completed';

    metadata.sessions[sessionId] = {
      ...session,
      status: nextStatus,
      lastClosedAt: new Date().toISOString(),
    };

    writeJsonAtomically(metadataPath, metadata);
  });
}

(async () => {
  try {
    const hookName = process.argv[2] || 'session-end';
    if (hookName !== 'session-end') {
      process.exit(0);
    }

    const raw = (await readStdin()).trim();
    if (!raw) process.exit(0);
    const event = JSON.parse(raw);
    const sessionId = event.sessionId || event.session_id || event.id || event?.session?.id || event?.session?.sessionId;
    await updateMetadata(sessionId);
  } catch (error) {
    console.error('[cchv-hook] failed:', error && error.message ? error.message : String(error));
    process.exit(1);
  }
})();
"
}

fn extract_session_id(command: &str) -> Option<String> {
    let parts: Vec<&str> = command.split_whitespace().collect();
    let mut idx = 0usize;
    while idx < parts.len() {
        match parts[idx] {
            "--session-id" | "--resume" => {
                if let Some(value) = parts.get(idx + 1) {
                    return Some(value.trim_matches('"').to_string());
                }
            }
            part if part.starts_with("--session-id=") => {
                return Some(
                    part.trim_start_matches("--session-id=")
                        .trim_matches('"')
                        .to_string(),
                );
            }
            part if part.starts_with("--resume=") => {
                return Some(
                    part.trim_start_matches("--resume=")
                        .trim_matches('"')
                        .to_string(),
                );
            }
            _ => {}
        }
        idx += 1;
    }
    None
}

fn command_looks_like_claude_process(command: &str) -> bool {
    let normalized = command.trim().trim_matches('"').to_ascii_lowercase();
    if normalized.is_empty() {
        return false;
    }

    let executable = normalized
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default();

    matches!(
        executable,
        "claude" | "claude.exe" | "claude-code" | "claude-code.exe"
    ) || normalized.contains("@anthropic-ai/claude-code")
        || normalized.contains("/claude-code")
        || normalized.contains("\\claude-code")
}

#[cfg(unix)]
fn inspect_pid_command(pid: i32) -> Result<String, String> {
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .map_err(|e| format!("Failed to inspect process {pid}: {e}"))?;

    if !output.status.success() {
        return Err(format!("Failed to inspect process {pid}"));
    }

    let command = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if command.is_empty() {
        return Err(format!("Process {pid} is not running"));
    }

    Ok(command)
}

#[tauri::command]
pub async fn get_running_sessions() -> Result<Vec<RunningSessionInfo>, String> {
    #[cfg(unix)]
    {
        tauri::async_runtime::spawn_blocking(|| {
            let output = Command::new("ps")
                .args(["-axo", "pid=,etimes=,%cpu=,rss=,command="])
                .output()
                .map_err(|e| format!("Failed to execute ps: {e}"))?;

            if !output.status.success() {
                return Err("Failed to inspect running processes".to_string());
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut sessions = Vec::new();

            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let mut parts = trimmed.split_whitespace();
                let Some(pid_str) = parts.next() else {
                    continue;
                };
                let Some(uptime_str) = parts.next() else {
                    continue;
                };
                let Some(cpu_str) = parts.next() else {
                    continue;
                };
                let Some(rss_str) = parts.next() else {
                    continue;
                };
                let command = parts.collect::<Vec<_>>().join(" ");

                if !command_looks_like_claude_process(&command) {
                    continue;
                }

                let Some(session_id) = extract_session_id(&command) else {
                    continue;
                };

                let pid = pid_str.parse::<i32>().unwrap_or_default();
                let uptime_seconds = uptime_str.parse::<u64>().unwrap_or_default();
                let cpu_percent = cpu_str.parse::<f32>().unwrap_or_default();
                let memory_rss_kb = rss_str.parse::<u64>().unwrap_or_default();

                sessions.push(RunningSessionInfo {
                    session_id,
                    pid,
                    cpu_percent,
                    memory_rss_kb,
                    uptime_seconds,
                    command,
                });
            }

            sessions.sort_by(|a, b| b.memory_rss_kb.cmp(&a.memory_rss_kb));
            Ok(sessions)
        })
        .await
        .map_err(|e| format!("Task join error: {e}"))?
    }

    #[cfg(not(unix))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn kill_session(pid: i32) -> Result<(), String> {
    #[cfg(unix)]
    {
        tauri::async_runtime::spawn_blocking(move || {
            if pid <= 0 {
                return Err(format!("Invalid PID: {pid}"));
            }

            let command = inspect_pid_command(pid)?;
            if !command_looks_like_claude_process(&command)
                || extract_session_id(&command).is_none()
            {
                return Err(format!(
                    "Refusing to terminate PID {pid} because it is not a Claude session process"
                ));
            }

            Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .status()
                .map_err(|e| format!("Failed to send SIGTERM: {e}"))?;

            thread::sleep(Duration::from_millis(1200));

            let still_running = Command::new("kill")
                .args(["-0", &pid.to_string()])
                .status()
                .map(|status| status.success())
                .unwrap_or(false);

            if still_running {
                Command::new("kill")
                    .args(["-KILL", &pid.to_string()])
                    .status()
                    .map_err(|e| format!("Failed to send SIGKILL: {e}"))?;
            }

            Ok(())
        })
        .await
        .map_err(|e| format!("Task join error: {e}"))?
    }

    #[cfg(not(unix))]
    {
        let _ = pid;
        Err("Killing Claude sessions is not supported on this platform yet".to_string())
    }
}

#[tauri::command]
pub async fn install_hooks() -> Result<HookInstallResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        let claude_dir = home.join(".claude");
        let settings_path = claude_dir.join("settings.json");
        let bin_dir = metadata_dir()?.join("bin");
        let hook_script_path = bin_dir.join("cchv-hook.mjs");

        fs::create_dir_all(&bin_dir).map_err(|e| {
            format!(
                "Failed to create hook bin directory '{}': {e}",
                bin_dir.display()
            )
        })?;
        atomic_write(&hook_script_path, hook_script_contents())?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = fs::Permissions::from_mode(0o755);
            fs::set_permissions(&hook_script_path, permissions)
                .map_err(|e| format!("Failed to mark hook script executable: {e}"))?;
        }

        let mut settings_json = if settings_path.exists() {
            let mut content = String::new();
            fs::File::open(&settings_path)
                .and_then(|mut file| file.read_to_string(&mut content).map(|_| file))
                .map_err(|e| {
                    format!(
                        "Failed to read Claude settings '{}': {e}",
                        settings_path.display()
                    )
                })?;
            serde_json::from_str::<serde_json::Value>(&content)
                .unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        let command = format!(
            "node \"{}\" session-end",
            hook_script_path.to_string_lossy()
        );
        let hook_entry = serde_json::json!({
            "type": "command",
            "command": command,
            "timeout": 5
        });
        let matcher_entry = serde_json::json!({
            "matcher": "",
            "hooks": [hook_entry]
        });

        if settings_json.get("hooks").is_none() {
            settings_json["hooks"] = serde_json::json!({});
        }
        if settings_json["hooks"].get("SessionEnd").is_none() {
            settings_json["hooks"]["SessionEnd"] = serde_json::json!([]);
        }

        let session_end_hooks = settings_json["hooks"]["SessionEnd"]
            .as_array_mut()
            .ok_or("Claude settings hooks.SessionEnd must be an array")?;

        let already_installed = session_end_hooks.iter().any(|entry| {
            entry
                .get("hooks")
                .and_then(|hooks| hooks.as_array())
                .map(|hooks| {
                    hooks.iter().any(|hook| {
                        hook.get("command")
                            .and_then(|value| value.as_str())
                            .map(|value| value.contains("cchv-hook.mjs"))
                            .unwrap_or(false)
                    })
                })
                .unwrap_or(false)
        });

        if !already_installed {
            session_end_hooks.push(matcher_entry);
        }

        let content = serde_json::to_string_pretty(&settings_json)
            .map_err(|e| format!("Failed to serialize Claude settings: {e}"))?;
        atomic_write(&settings_path, &content)?;

        Ok(HookInstallResult {
            installed: true,
            hook_script_path: hook_script_path.to_string_lossy().to_string(),
            settings_path: settings_path.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
