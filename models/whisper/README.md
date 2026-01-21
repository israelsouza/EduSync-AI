# Whisper Models Directory

This directory stores Whisper models for local/offline speech-to-text.

## Available Models

| Model | Size | Accuracy | Download URL |
|-------|------|----------|--------------|
| whisper-tiny | ~75MB | 70% | [ggml-tiny.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin) |
| whisper-base | ~142MB | 80% | [ggml-base.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin) |
| whisper-small | ~466MB | 85% | [ggml-small.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin) |
| whisper-medium | ~1.5GB | 90% | [ggml-medium.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin) |

## Recommended Model

For EduSync-AI (offline-first on mobile), we recommend:
- **whisper-base** (~142MB) - Good balance of accuracy and size
- **whisper-tiny** (~75MB) - If storage is very limited

## How to Download

### Option 1: Using the API
The WhisperSTTService has a `downloadModel()` method that can download models automatically.

### Option 2: Manual Download
Download the model file and place it in this directory with the correct filename:
- `ggml-tiny.bin`
- `ggml-base.bin`
- `ggml-small.bin`
- `ggml-medium.bin`

### Option 3: Using curl
```bash
# Download whisper-base (recommended)
curl -L -o models/whisper/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

## Usage

Set `STT_PROVIDER=whisper` in your `.env` file to use local Whisper models.

## Note

These model files are not included in the git repository due to their size.
Add to .gitignore: `models/whisper/*.bin`
