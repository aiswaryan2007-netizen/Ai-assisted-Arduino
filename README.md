# AI CodeGen & Verify

A local Flask workspace for generating, reviewing, debugging, and explaining Arduino and ESP32 sketches. The browser includes eight sample projects and static checks without an AI key. AI requests are sent from Flask, never directly from frontend JavaScript.

## Requirements

- Windows 10/11 and Python 3.10 or newer
- Optional: an API key for a compatible OpenAI chat-completions endpoint
- Optional: Arduino CLI and the board cores/libraries you want to compile against

## Run in Windows / VS Code

Open this project folder in VS Code, then open **Terminal > New Terminal** and run:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
Copy-Item .env.example .env
py app.py
```

Open `http://127.0.0.1:5000`. If PowerShell blocks virtual-environment activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then activate again. The app binds to `127.0.0.1` by default; set `HOST` only when you intentionally need another interface.

## Configure AI (optional)

Edit `.env` and set `AI_API_KEY`. `AI_API_URL` defaults to the OpenAI-compatible `https://api.openai.com/v1/chat/completions`; set `AI_MODEL` for your provider/model. The key is read only by the Flask process and is not exposed by any frontend endpoint. Restart Flask after editing `.env`.

The app loads the root `.env` file at startup. Existing process environment variables take precedence. Restart Flask after editing the file.

Do not commit `.env` or put real credentials into sketches, prompts, or sample code. The generation/debug/explain endpoints send submitted text and code to the configured AI service.

## Arduino CLI compilation (optional)

Install Arduino CLI from the official Arduino CLI documentation and ensure `arduino-cli.exe` is on `PATH`, or set `ARDUINO_CLI` to its full executable path in the Flask environment. Open a new terminal after changing `PATH`, then install/update cores:

```powershell
arduino-cli version
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli core install esp32:esp32
arduino-cli core list
```

Some ESP32 core versions may ask for additional board-manager configuration; follow the Espressif Arduino core installation guide. The included DHT, Servo, and MQTT samples need their respective libraries installed in your Arduino CLI environment before they compile, for example:

```powershell
arduino-cli lib install "DHT sensor library"
arduino-cli lib install "Adafruit Unified Sensor"
arduino-cli lib install Servo
arduino-cli lib install PubSubClient
```

The verifier maps Arduino Uno/Nano to `arduino:avr:uno` / `arduino:avr:nano` (Nano uses the default processor option), and ESP32/ESP32 DevKit to `esp32:esp32:esp32`. It compiles in a temporary sketch directory with a 45-second timeout and no shell. It never uploads or executes a sketch. Compiler output can still contain code and local paths; keep this development server local. A hardened, multi-user deployment needs OS-level isolation, resource limits, and a separate build worker before accepting untrusted sketches.

## Feature checks

Run the automated API tests:

```powershell
py -m unittest discover -s tests -v
```

With the app running, check these workflows:

1. Open Project library, search `DHT`, filter by Arduino, and open Temperature & humidity. It loads the sample sketch and wiring notes without an AI key.
2. Generate code without `AI_API_KEY`; the UI reports that AI is not configured. Set the key, restart Flask, then try a generation prompt and inspect the returned sketch and safety notes.
3. In Code verifier, load the LED example and run checks. Without Arduino CLI, the result must say `NOT VERIFIED` / `Compilation unavailable`; it must not say PASS.
4. Install CLI and the matching core, then compile the blink example. Only a real zero-exit CLI compile returns PASS. Compiler errors include the CLI output.
5. In Debug assistant, load a sketch file or paste code and provide the compiler output; review the side-by-side correction before applying it. Debug and explanation require AI configuration.
6. Save a generated/sample project. Dashboard recents use browser local storage; the `/api/projects` endpoints additionally provide SQLite storage for API clients.
7. Toggle light/dark mode and test the sidebar menu at a narrow viewport.

## API overview

- `POST /api/generate`: AI sketch generation
- `POST /api/verify`: static review, optional Arduino CLI compile
- `POST /api/debug`: AI-assisted correction
- `POST /api/explain`: beginner-friendly line explanations
- `GET|POST /api/projects`, `DELETE /api/projects/<id>`: SQLite project storage
- `GET /api/health`: reports whether AI configuration and Arduino CLI are present (never returns the key)

The API validates payload types/lengths, caps request size, applies in-process per-IP rate limits, and sets timeouts for AI and compiler calls. Rate limits are intended for a single-user local demo, not a horizontally scaled production service. Static analysis is intentionally best-effort, not a C++ parser. Compilation verifies the selected board core and installed libraries only; it does not test real hardware, wiring, power, or runtime behavior.