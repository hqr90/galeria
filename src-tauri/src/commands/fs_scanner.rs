use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct ArtAsset {
    pub path: String,
    pub filename: String,
    pub extension: String,
}

const SUPPORTED_EXTS: [&str; 5] = ["jpg", "jpeg", "png", "webp", "avif"];

/// Varre o diretorio escolhido e devolve apenas os caminhos das imagens
/// suportadas. Nenhum binario e carregado em RAM aqui: o WebView le cada
/// arquivo sob demanda pelo protocolo `asset://`.
#[tauri::command]
pub async fn scan_art_directory(
    app: AppHandle,
    folder_path: String,
) -> Result<Vec<ArtAsset>, String> {
    let path = Path::new(&folder_path);

    if !path.exists() || !path.is_dir() {
        return Err("O diretorio informado nao existe ou e invalido.".into());
    }

    // Libera a pasta no escopo do protocolo de assets em tempo de execucao,
    // para que convertFileSrc() consiga servir os arquivos ao WebView.
    let _ = app.asset_protocol_scope().allow_directory(path, true);

    let mut assets = Vec::new();

    for entry in WalkDir::new(path)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) else {
            continue;
        };

        let ext_lower = ext.to_lowercase();
        if !SUPPORTED_EXTS.contains(&ext_lower.as_str()) {
            continue;
        }

        let file_stem = entry
            .path()
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        assets.push(ArtAsset {
            path: entry.path().to_string_lossy().to_string(),
            filename: file_stem,
            extension: ext_lower,
        });
    }

    if assets.is_empty() {
        return Err("Nenhuma imagem suportada foi encontrada nesta pasta.".into());
    }

    assets.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(assets)
}
