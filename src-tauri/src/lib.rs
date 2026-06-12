use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, RunEvent, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const LOG_CAPACITY: usize = 1000;
/// gocoon-runner control plane (see gocoon client-config.json `http_port`).
const RUNNER_URL: &str = "http://127.0.0.1:10000";

#[derive(Default)]
struct RunnerState {
    child: Mutex<Option<CommandChild>>,
    logs: Mutex<VecDeque<String>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RunnerStatus {
    running: bool,
    runner_url: String,
    data_dir: String,
    config_path: String,
    config_exists: bool,
}

/// Same default as gocoon's `defaultUIDataDir`: <user config dir>/Cocoon,
/// so the CLI (`gocoon ui`) and the desktop app share one wallet/config.
fn cocoon_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().config_dir().map_err(|e| e.to_string())?;
    Ok(base.join("Cocoon"))
}

fn push_log(app: &AppHandle, line: String) {
    let state: State<RunnerState> = app.state();
    {
        let mut logs = state.logs.lock().unwrap();
        if logs.len() >= LOG_CAPACITY {
            logs.pop_front();
        }
        logs.push_back(line.clone());
    }
    let _ = app.emit("runner-log", line);
}

#[tauri::command]
fn runner_status(app: AppHandle, state: State<RunnerState>) -> Result<RunnerStatus, String> {
    let dir = cocoon_data_dir(&app)?;
    let config_path = dir.join("client-config.json");
    Ok(RunnerStatus {
        running: state.child.lock().unwrap().is_some(),
        runner_url: RUNNER_URL.to_string(),
        data_dir: dir.to_string_lossy().into_owned(),
        config_path: config_path.to_string_lossy().into_owned(),
        config_exists: config_path.exists(),
    })
}

// spawn_runner launches the gocoon-runner sidecar in --data-dir mode: its
// HTTP API serves wallet onboarding even before a config exists, and it
// starts the inference engine itself once onboarding completes.
fn spawn_runner(app: &AppHandle) -> Result<(), String> {
    let state: State<RunnerState> = app.state();
    {
        let child = state.child.lock().unwrap();
        if child.is_some() {
            return Ok(());
        }
    }

    let dir = cocoon_data_dir(app)?;
    let command = app
        .shell()
        .sidecar("gocoon-runner")
        .map_err(|e| e.to_string())?
        .args(["--data-dir", &dir.to_string_lossy(), "-v2"]);

    let (mut rx, child) = command.spawn().map_err(|e| e.to_string())?;
    *state.child.lock().unwrap() = Some(child);
    push_log(app, "[app] gocoon-runner started".into());

    let app_for_events = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim_end().to_string();
                    if !line.is_empty() {
                        push_log(&app_for_events, line);
                    }
                }
                CommandEvent::Error(err) => {
                    push_log(&app_for_events, format!("[app] runner error: {err}"));
                }
                CommandEvent::Terminated(payload) => {
                    let state: State<RunnerState> = app_for_events.state();
                    *state.child.lock().unwrap() = None;
                    push_log(
                        &app_for_events,
                        format!("[app] gocoon-runner exited (code {:?})", payload.code),
                    );
                    let _ = app_for_events.emit("runner-exit", payload.code);
                }
                _ => {}
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn runner_start(app: AppHandle) -> Result<RunnerStatus, String> {
    spawn_runner(&app)?;
    runner_status(app.clone(), app.state())
}

#[tauri::command]
fn runner_stop(app: AppHandle, state: State<RunnerState>) -> Result<RunnerStatus, String> {
    if let Some(child) = state.child.lock().unwrap().take() {
        child.kill().map_err(|e| e.to_string())?;
        push_log(&app, "[app] gocoon-runner stopped".into());
    }
    runner_status(app.clone(), app.state())
}

#[tauri::command]
fn runner_logs(state: State<RunnerState>) -> Vec<String> {
    state.logs.lock().unwrap().iter().cloned().collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(RunnerState::default())
        .invoke_handler(tauri::generate_handler![
            runner_status,
            runner_start,
            runner_stop,
            runner_logs
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = spawn_runner(&handle) {
                push_log(&handle, format!("[app] runner autostart failed: {err}"));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                let state: State<RunnerState> = app.state();
                let child = state.child.lock().unwrap().take();
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        });
}
