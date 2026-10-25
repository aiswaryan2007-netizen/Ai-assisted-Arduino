import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import time
from contextlib import contextmanager
from functools import wraps
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, current_app, jsonify, render_template, request
from werkzeug.exceptions import HTTPException


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
BOARD_FQBNS = {
    "Arduino Uno": "arduino:avr:uno",
    "Arduino Nano": "arduino:avr:nano",
    "ESP32": "esp32:esp32:esp32",
    "ESP32 DevKit": "esp32:esp32:esp32",
}
BOARD_PINS = {
    "Arduino Uno": set(range(20)) | {f"A{pin}" for pin in range(6)},
    "Arduino Nano": set(range(22)) | {f"A{pin}" for pin in range(8)},
    "ESP32": set(range(40)) - set(range(6, 12)) | {"LED_BUILTIN"},
    "ESP32 DevKit": set(range(40)) - set(range(6, 12)) | {"LED_BUILTIN"},
}
RATE_LOCK = threading.Lock()
RATE_HITS = {}


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        DATABASE=os.environ.get("PROJECT_DATABASE", str(BASE_DIR / "instance" / "projects.sqlite3")),
        MAX_CONTENT_LENGTH=300_000,
        JSON_SORT_KEYS=False,
    )
    if test_config:
        app.config.update(test_config)

    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    initialize_database(app.config["DATABASE"])

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify(error="Request too large. Keep sketches under 200 KB."), 413

    @app.errorhandler(400)
    def invalid_json(_error):
        return jsonify(error="Send a valid JSON request body."), 400

    @app.get("/")
    def home():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", ai_configured=bool(os.environ.get("AI_API_KEY")), arduino_cli=bool(shutil.which(os.environ.get("ARDUINO_CLI", "arduino-cli"))))

    @app.post("/api/generate")
    @rate_limit(limit=8)
    def generate():
        data = json_body()
        board = validate_board(data.get("board"))
        prompt = validate_text(data.get("prompt"), "prompt", 4000, required=True)
        components = validate_string_list(data.get("components", []), "components", 20, 80)
        pins = validate_text(data.get("pins", ""), "pins", 1000)
        requirements = validate_text(data.get("requirements", ""), "requirements", 2000)
        user_prompt = {
            "board": board,
            "language": "Arduino C++",
            "project_request": prompt,
            "components": components,
            "pin_assignments": pins,
            "additional_requirements": requirements,
            "response_format": {
                "code": "complete Arduino sketch as a string",
                "libraries": ["required library names"],
                "connections": "pin and wiring instructions",
                "explanation": "beginner-friendly explanation",
                "expected_output": "expected serial or device behavior",
                "hardware": ["required hardware"],
                "safety_warnings": ["relevant safety notes"],
            },
        }
        result = request_ai(
            "You are an embedded-systems teaching assistant. Return only valid JSON with the requested keys. "
            "Write a complete, conservative Arduino C++ sketch. Do not claim that code was compiled or hardware-tested. "
            "Never embed secrets. Include voltage/current safety warnings where relevant.",
            user_prompt,
        )
        code = validate_ai_code(result.get("code"))
        return jsonify(
            code=code,
            libraries=clean_ai_list(result.get("libraries")),
            connections=clean_ai_text(result.get("connections")),
            explanation=clean_ai_text(result.get("explanation")),
            expected_output=clean_ai_text(result.get("expected_output")),
            hardware=clean_ai_list(result.get("hardware")),
            safety_warnings=clean_ai_list(result.get("safety_warnings")),
            source="ai",
        )

    @app.post("/api/verify")
    @rate_limit(limit=20)
    def verify():
        data = json_body()
        code = validate_text(data.get("code"), "code", 200_000, required=True)
        board = validate_board(data.get("board"))
        compile_requested = data.get("compile", True) is not False
        issues = static_review(code, board)
        response = {
            "status": "WARNING" if issues else "NOT VERIFIED",
            "summary": "Static review found items to check." if issues else "Static review complete; no obvious issues found.",
            "compiled": False,
            "compiler_available": bool(shutil.which(os.environ.get("ARDUINO_CLI", "arduino-cli"))),
            "checks": {"static_analysis": True},
            "issues": issues,
            "compiler_output": "",
            "hardware_tested": False,
        }
        if not compile_requested:
            response["summary"] = "Static review only. Actual compilation was not requested."
            attach_ai_review(response, code, board)
            return jsonify(response)
        if not response["compiler_available"]:
            response["summary"] = "Arduino CLI is unavailable; this sketch was not compiled."
            attach_ai_review(response, code, board)
            return jsonify(response)

        result = compile_sketch(code, board)
        response.update(result)
        attach_ai_review(response, code, board)
        if result.get("status") == "FAIL" and os.environ.get("AI_API_KEY", "").strip():
            try:
                suggestion = request_ai(
                    "Review this Arduino compiler failure. Return only JSON with corrected_code and fix_suggestion. "
                    "Keep the user's intent, do not claim the correction compiles, and do not claim hardware testing.",
                    {"board": board, "code": code, "compiler_output": result.get("compiler_output", ""), "static_issues": issues},
                )
                response["suggested_code"] = validate_ai_code(suggestion.get("corrected_code"))
                response["fix_suggestion"] = clean_ai_text(suggestion.get("fix_suggestion"))
            except ApiError as error:
                current_app.logger.info("AI fix suggestion unavailable: %s", error.status)
        return jsonify(response)

    @app.post("/api/debug")
    @rate_limit(limit=8)
    def debug():
        data = json_body()
        code = validate_text(data.get("code"), "code", 200_000, required=True)
        problem = validate_text(data.get("problem", ""), "problem", 4000)
        board = validate_board(data.get("board", "Arduino Uno"))
        result = request_ai(
            "You are an Arduino and ESP32 debugging tutor. Return only valid JSON containing corrected_code, explanation, and solution. "
            "Preserve the user's intent, point out uncertainty, and do not claim to compile or test hardware.",
            {"board": board, "code": code, "reported_problem": problem},
        )
        corrected = validate_ai_code(result.get("corrected_code"))
        return jsonify(corrected_code=corrected, explanation=clean_ai_text(result.get("explanation")), solution=clean_ai_text(result.get("solution")))

    @app.post("/api/explain")
    @rate_limit(limit=10)
    def explain():
        data = json_body()
        code = validate_text(data.get("code"), "code", 200_000, required=True)
        result = request_ai(
            "Explain Arduino C++ to a beginner. Return only JSON with an explanation string and a lines array. "
            "Each lines item has line (integer), code (short source excerpt), and explanation. Do not claim to execute the code.",
            {"code": code},
        )
        lines = result.get("lines", [])
        if not isinstance(lines, list):
            lines = []
        clean_lines = []
        for item in lines[:300]:
            if isinstance(item, dict):
                clean_lines.append({"line": item.get("line", ""), "code": clean_ai_text(item.get("code")), "explanation": clean_ai_text(item.get("explanation"))})
        return jsonify(explanation=clean_ai_text(result.get("explanation")), lines=clean_lines)

    @app.get("/api/projects")
    def list_projects():
        with database() as connection:
            rows = connection.execute("SELECT id, name, board, prompt, code, updated_at FROM projects ORDER BY updated_at DESC LIMIT 100").fetchall()
        return jsonify(projects=[dict(row) for row in rows])

    @app.post("/api/projects")
    @rate_limit(limit=30)
    def save_project():
        data = json_body()
        project_id = validate_text(data.get("id", ""), "id", 80) or f"p-{int(time.time() * 1000)}"
        name = validate_text(data.get("name"), "name", 120, required=True)
        board = validate_board(data.get("board"))
        prompt = validate_text(data.get("prompt", ""), "prompt", 4000)
        code = validate_text(data.get("code"), "code", 200_000, required=True)
        with database() as connection:
            connection.execute(
                "INSERT INTO projects(id, name, board, prompt, code, updated_at) VALUES(?, ?, ?, ?, ?, CURRENT_TIMESTAMP) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, board=excluded.board, prompt=excluded.prompt, code=excluded.code, updated_at=CURRENT_TIMESTAMP",
                (project_id, name, board, prompt, code),
            )
        return jsonify(id=project_id, saved=True), 201

    @app.delete("/api/projects/<project_id>")
    @rate_limit(limit=30)
    def delete_project(project_id):
        with database() as connection:
            cursor = connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        if cursor.rowcount == 0:
            return jsonify(error="Project not found."), 404
        return jsonify(deleted=True)

    @app.errorhandler(sqlite3.Error)
    def database_error(_error):
        current_app.logger.exception("Project database error")
        return jsonify(error="Project storage is temporarily unavailable."), 500

    register_error_handlers(app)
    return app


def initialize_database(path):
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS projects ("
            "id TEXT PRIMARY KEY, name TEXT NOT NULL, board TEXT NOT NULL, prompt TEXT NOT NULL, "
            "code TEXT NOT NULL, updated_at TEXT NOT NULL)"
        )
        connection.commit()
    finally:
        connection.close()


@contextmanager
def database():
    connection = sqlite3.connect(current_app.config["DATABASE"])
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def rate_limit(limit, window_seconds=60):
    def decorate(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            now = time.monotonic()
            client = request.remote_addr or "unknown"
            key = (client, request.endpoint)
            with RATE_LOCK:
                hits = [stamp for stamp in RATE_HITS.get(key, []) if now - stamp < window_seconds]
                if len(hits) >= limit:
                    return jsonify(error="Too many requests. Please wait a minute and try again."), 429
                hits.append(now)
                RATE_HITS[key] = hits
                if len(RATE_HITS) > 5000:
                    for old_key in [key for key, stamps in RATE_HITS.items() if not stamps or now - stamps[-1] >= window_seconds]:
                        RATE_HITS.pop(old_key, None)
            return view(*args, **kwargs)
        return wrapped
    return decorate


def json_body():
    data = request.get_json(silent=False)
    if not isinstance(data, dict):
        raise ValueError("JSON object required")
    return data


def validate_text(value, name, max_length, required=False):
    if not isinstance(value, str):
        if required:
            raise ApiError(f"{name} must be text.", 400)
        return ""
    value = value.strip()
    if required and not value:
        raise ApiError(f"{name} is required.", 400)
    if len(value) > max_length:
        raise ApiError(f"{name} must be {max_length} characters or fewer.", 400)
    return value


def validate_string_list(value, name, max_items, max_item_length):
    if not isinstance(value, list) or len(value) > max_items:
        raise ApiError(f"{name} must be a list with no more than {max_items} items.", 400)
    if any(not isinstance(item, str) or len(item) > max_item_length for item in value):
        raise ApiError(f"Each {name} item must be text under {max_item_length} characters.", 400)
    return [item.strip() for item in value if item.strip()]


def validate_board(value):
    if not isinstance(value, str) or value not in BOARD_FQBNS:
        raise ApiError("Select a supported board: Arduino Uno, Arduino Nano, ESP32, or ESP32 DevKit.", 400)
    return value


def clean_ai_text(value, max_length=5000):
    return value.strip()[:max_length] if isinstance(value, str) else ""


def clean_ai_list(value):
    if not isinstance(value, list):
        return []
    return [clean_ai_text(item, 300) for item in value[:30] if isinstance(item, str)]


def validate_ai_code(value):
    code = clean_ai_text(value, 200_000)
    if not code:
        raise ApiError("The AI response did not include usable code. Try a more specific prompt.", 502)
    code = re.sub(r"\A```(?:cpp|c\+\+|arduino)?\s*", "", code, flags=re.IGNORECASE)
    code = re.sub(r"\s*```\Z", "", code)
    return code


class ApiError(Exception):
    def __init__(self, message, status=400):
        self.message = message
        self.status = status


def request_ai(system_prompt, user_payload):
    api_key = os.environ.get("AI_API_KEY", "").strip()
    if not api_key:
        raise ApiError("AI is not configured. Add AI_API_KEY to your environment; sample projects and static verification work without it.", 503)
    endpoint = os.environ.get("AI_API_URL", "https://api.openai.com/v1/chat/completions").strip()
    model = os.environ.get("AI_MODEL", "gpt-4o-mini").strip()
    try:
        response = requests.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=True)},
                ],
            },
            timeout=(8, 60),
        )
        if response.status_code == 429:
            raise ApiError("The AI provider rate limit was reached. Please try again shortly.", 429)
        response.raise_for_status()
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        result = json.loads(content)
        if not isinstance(result, dict):
            raise ValueError("Expected a JSON object")
        return result
    except ApiError:
        raise
    except requests.Timeout as error:
        current_app.logger.warning("AI request timed out: %s", type(error).__name__)
        raise ApiError("The AI request timed out. Please retry with a shorter prompt.", 504) from None
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as error:
        current_app.logger.warning("AI request failed: %s", type(error).__name__)
        raise ApiError("The AI provider request failed. Check the backend configuration and try again.", 502) from None


def static_review(code, board):
    issues = []
    depth = 0
    for line_number, line in enumerate(code.splitlines(), start=1):
        visible = re.sub(r"//.*|/\*.*?\*/|\"(?:\\.|[^\"])*\"|'(?:\\.|[^'])*'", "", line).strip()
        for char in visible:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth < 0:
                    issues.append({"line": line_number, "message": "Closing brace has no matching opening brace."})
                    depth = 0
        if visible.startswith("#include") and not re.match(r"#include\s*[<\"]", visible):
            issues.append({"line": line_number, "message": "Review this include directive; expected a header name in angle brackets or quotes."})
        pin_call = re.search(r"\b(?:pinMode|digitalWrite|digitalRead|analogRead|analogWrite)\s*\(\s*(\d+|A\d+|LED_BUILTIN)\s*(?:,|\))", visible)
        if pin_call:
            pin_text = pin_call.group(1)
            pin = int(pin_text) if pin_text.isdigit() else pin_text
            if board.startswith("Arduino") and pin != "LED_BUILTIN" and pin not in BOARD_PINS[board]:
                issues.append({"line": line_number, "message": f"GPIO {pin} is outside the common pin range for {board}; confirm the board pin mapping."})
            elif board.startswith("ESP32") and isinstance(pin, int) and (pin > 39 or 6 <= pin <= 11):
                issues.append({"line": line_number, "message": f"GPIO {pin} is unavailable or reserved on common ESP32 boards; check your module pinout."})
            elif board.startswith("ESP32") and pin in {34, 35, 36, 37, 38, 39} and re.search(r"\b(?:pinMode\s*\(\s*\d+\s*,\s*OUTPUT|digitalWrite\s*\(\s*\d+)", visible):
                issues.append({"line": line_number, "message": f"GPIO {pin} is input-only on common ESP32 modules."})
        if re.search(r"\b(?:digitalWrite|analogWrite)\s*\(\s*\d+\s*,", visible) and "pinMode" not in code:
            issues.append({"line": line_number, "message": "Output pin is written but no pinMode call was found; confirm the pin is configured as OUTPUT."})
        if re.match(r"^(?:int|long|float|double|bool|char|byte|String)\s+\w+\s*=.*[^;{}]$", visible) and not visible.startswith("#"):
            issues.append({"line": line_number, "message": "This variable declaration may be missing a semicolon."})
    if depth > 0:
        issues.append({"line": len(code.splitlines()) or 1, "message": "One or more opening braces are not closed."})
    if "void setup" not in code:
        issues.append({"line": 1, "message": "No setup() function found; confirm this is a complete Arduino sketch."})
    if "void loop" not in code:
        issues.append({"line": 1, "message": "No loop() function found; confirm this is a complete Arduino sketch."})
    if re.search(r"\bdelay\s*\(", code):
        delay_line = next((index for index, line in enumerate(code.splitlines(), 1) if re.search(r"\bdelay\s*\(", line)), 1)
        issues.append({"line": delay_line, "message": "delay() blocks other loop work; consider millis() for responsive projects."})
    unique = []
    seen = set()
    for issue in issues:
        key = (issue["line"], issue["message"])
        if key not in seen:
            seen.add(key)
            unique.append(issue)
    return unique[:100]


def compile_sketch(code, board):
    cli = os.environ.get("ARDUINO_CLI", "arduino-cli")
    fqbn = BOARD_FQBNS[board]
    with tempfile.TemporaryDirectory(prefix="makermind-") as temporary_directory:
        sketch_dir = Path(temporary_directory) / "CodeGenSketch"
        sketch_dir.mkdir()
        sketch_path = sketch_dir / "CodeGenSketch.ino"
        sketch_path.write_text(code, encoding="utf-8")
        try:
            process = subprocess.run(
                [cli, "compile", "--fqbn", fqbn, str(sketch_dir)],
                cwd=temporary_directory,
                capture_output=True,
                text=True,
                timeout=45,
                check=False,
                shell=False,
                env={key: value for key, value in os.environ.items() if key.upper() not in {"PYTHONPATH", "PYTHONHOME"}},
            )
        except subprocess.TimeoutExpired:
            return {"status": "NOT VERIFIED", "summary": "Arduino CLI compilation timed out; no result is claimed.", "compiled": False, "compiler_available": True, "compiler_output": "Compilation exceeded the 45-second time limit."}
        except OSError:
            return {"status": "NOT VERIFIED", "summary": "Arduino CLI could not be started; no result is claimed.", "compiled": False, "compiler_available": False, "compiler_output": ""}
        output = (process.stdout + "\n" + process.stderr).strip()[-12000:]
        if process.returncode == 0:
            return {"status": "PASS", "summary": f"Arduino CLI compiled successfully for {board} ({fqbn}).", "compiled": True, "compiler_available": True, "compiler_output": output}
        missing_board = re.search(r"platform .+ not found|FQBN .+ not found|unknown FQBN|no such file or directory.+platform", output, re.IGNORECASE)
        if missing_board:
            return {"status": "NOT VERIFIED", "summary": f"The Arduino CLI is installed, but the {board} board core is unavailable.", "compiled": False, "compiler_available": True, "compiler_output": output}
        return {"status": "FAIL", "summary": f"Arduino CLI reported a compilation failure for {board}.", "compiled": False, "compiler_available": True, "compiler_output": output}


def attach_ai_review(response, code, board):
    if not os.environ.get("AI_API_KEY", "").strip():
        return
    try:
        review = request_ai(
            "Review this Arduino sketch for likely logical mistakes and unsafe hardware assumptions. "
            "Return JSON with review (short text) and issues (array of objects with line and message). "
            "Treat this as advisory only; do not claim compilation or hardware testing.",
            {"board": board, "code": code, "compiler_output": response.get("compiler_output", "")},
        )
        response["ai_review"] = clean_ai_text(review.get("review"))
        ai_issues = review.get("issues", [])
        response["ai_issues"] = [
            {"line": item.get("line", ""), "message": clean_ai_text(item.get("message"))}
            for item in ai_issues[:30]
            if isinstance(item, dict)
        ] if isinstance(ai_issues, list) else []
    except ApiError as error:
        current_app.logger.info("AI code review unavailable: %s", error.status)


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def api_error(error):
        return jsonify(error=error.message), error.status

    @app.errorhandler(ValueError)
    def value_error(_error):
        return jsonify(error="Send a valid JSON object."), 400

    @app.errorhandler(Exception)
    def unexpected_error(error):
        if isinstance(error, HTTPException):
            return jsonify(error=error.description), error.code
        current_app.logger.exception("Unhandled application error: %s", type(error).__name__)
        return jsonify(error="Unexpected server error."), 500


app = create_app()
register_error_handlers(app)


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "5000")), debug=False)