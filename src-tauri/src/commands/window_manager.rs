use serde::Serialize;
use std::time::Duration;
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
    pub is_primary: bool,
    pub is_portrait: bool,
    /// Tamanho fisico da area util, em milimetros. `None` quando o driver nao
    /// informa (monitor virtual, RDP, alguns adaptadores).
    pub physical_width_mm: Option<u32>,
    pub physical_height_mm: Option<u32>,
    /// Densidade real em pontos por polegada, derivada do tamanho fisico.
    pub dpi_x: Option<f64>,
    pub dpi_y: Option<f64>,
}

/// Le o tamanho fisico do monitor pelo GDI. Diferente do EDID bruto, o
/// `GetDeviceCaps` ja devolve as medidas na orientacao atual: um ultrawide
/// girado para retrato reporta 334x798mm, nao 798x334mm.
#[cfg(windows)]
fn physical_size_mm(device_name: &str) -> Option<(u32, u32)> {
    use std::iter::once;
    use windows_sys::Win32::Graphics::Gdi::{CreateDCW, DeleteDC, GetDeviceCaps, HORZSIZE, VERTSIZE};

    if !device_name.starts_with(r"\\.\") {
        return None;
    }

    let driver: Vec<u16> = "DISPLAY".encode_utf16().chain(once(0)).collect();
    let device: Vec<u16> = device_name.encode_utf16().chain(once(0)).collect();

    unsafe {
        let hdc = CreateDCW(
            driver.as_ptr(),
            device.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
        );
        if hdc.is_null() {
            return None;
        }
        let width = GetDeviceCaps(hdc, HORZSIZE as i32);
        let height = GetDeviceCaps(hdc, VERTSIZE as i32);
        DeleteDC(hdc);

        if width > 0 && height > 0 {
            Some((width as u32, height as u32))
        } else {
            None
        }
    }
}

#[cfg(not(windows))]
fn physical_size_mm(_device_name: &str) -> Option<(u32, u32)> {
    None
}

fn describe(index: usize, monitor: &tauri::window::Monitor, is_primary: bool) -> MonitorInfo {
    let size = monitor.size();
    let position = monitor.position();
    let name = monitor
        .name()
        .cloned()
        .unwrap_or_else(|| format!("Monitor {}", index + 1));

    let physical = physical_size_mm(&name);
    let dpi = physical.map(|(mm_w, mm_h)| {
        (
            f64::from(size.width) / (f64::from(mm_w) / 25.4),
            f64::from(size.height) / (f64::from(mm_h) / 25.4),
        )
    });

    MonitorInfo {
        index,
        name,
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
        scale_factor: monitor.scale_factor(),
        is_primary,
        is_portrait: size.height > size.width,
        physical_width_mm: physical.map(|(w, _)| w),
        physical_height_mm: physical.map(|(_, h)| h),
        dpi_x: dpi.map(|(x, _)| x),
        dpi_y: dpi.map(|(_, y)| y),
    }
}

/// Monitor onde a janela esta agora — e o que importa para dimensionar a imagem.
#[tauri::command]
pub fn get_current_monitor(window: WebviewWindow) -> Result<Option<MonitorInfo>, String> {
    let current = window.current_monitor().map_err(|e| e.to_string())?;
    let Some(current) = current else {
        return Ok(None);
    };
    let primary_position = window
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .map(|m| *m.position());

    let index = window
        .available_monitors()
        .map_err(|e| e.to_string())?
        .iter()
        .position(|m| m.position() == current.position())
        .unwrap_or(0);

    let is_primary = primary_position.as_ref() == Some(current.position());
    Ok(Some(describe(index, &current, is_primary)))
}

#[tauri::command]
pub fn get_system_monitors(window: WebviewWindow) -> Result<Vec<MonitorInfo>, String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let primary_position = window
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .map(|m| *m.position());

    let list = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let is_primary = primary_position.as_ref() == Some(monitor.position());
            describe(index, monitor, is_primary)
        })
        .collect();

    Ok(list)
}

/// Reposiciona a janela sobre o monitor escolhido e, opcionalmente, entra em
/// fullscreen nativo nele. A saida do fullscreen antes do reposicionamento e
/// obrigatoria: no Windows a janela ficaria presa ao monitor anterior.
#[tauri::command]
pub async fn move_to_monitor(
    window: WebviewWindow,
    monitor_index: usize,
    fullscreen: bool,
) -> Result<(), String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let monitor = monitors
        .get(monitor_index)
        .ok_or_else(|| format!("Monitor {} nao encontrado.", monitor_index))?;

    let position = *monitor.position();
    let size = *monitor.size();

    window.set_fullscreen(false).map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(position.x, position.y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(size.width, size.height))
        .map_err(|e| e.to_string())?;

    if fullscreen {
        // Deixa o gerenciador de janelas assentar a nova posicao antes de
        // promover a janela a fullscreen, senao ele usa o monitor antigo.
        std::thread::sleep(Duration::from_millis(150));
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }

    let _ = window.set_focus();
    Ok(())
}

/// Alterna o fullscreen, ou o força para um estado quando `force` vem
/// definido (o Esc, por exemplo, só deve sair — nunca entrar).
#[tauri::command]
pub fn toggle_fullscreen(window: WebviewWindow, force: Option<bool>) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    let target = force.unwrap_or(!is_fullscreen);
    window.set_fullscreen(target).map_err(|e| e.to_string())?;
    Ok(target)
}
