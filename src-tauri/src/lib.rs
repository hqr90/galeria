mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs_scanner::scan_art_directory,
            commands::window_manager::get_system_monitors,
            commands::window_manager::get_current_monitor,
            commands::window_manager::move_to_monitor,
            commands::window_manager::toggle_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o FrameCast");
}
