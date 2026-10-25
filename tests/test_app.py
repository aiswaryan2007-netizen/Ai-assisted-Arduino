import os
import tempfile
import unittest
from unittest.mock import patch

import app as application


class AppApiTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.app = application.create_app({
            "TESTING": True,
            "DATABASE": os.path.join(self.directory.name, "projects.sqlite3"),
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.directory.cleanup()

    def valid_sketch(self):
        return "void setup() { pinMode(LED_BUILTIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_BUILTIN, HIGH); }"

    def test_home_serves_dashboard(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="pageContent"', response.data)
        script = self.client.get("/static/js/app.js")
        self.assertIn(b"Build Smarter IoT Projects with AI", script.data)
        script.close()

    def test_static_only_review_never_claims_compilation(self):
        with patch.object(application.shutil, "which", return_value=None):
            response = self.client.post("/api/verify", json={
                "code": self.valid_sketch(), "board": "Arduino Uno", "compile": False,
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "NOT VERIFIED")
        self.assertFalse(response.json["compiled"])
        self.assertFalse(response.json["compiler_available"])

    def test_compiler_pass_is_only_reported_for_successful_cli_result(self):
        compiler_result = {
            "status": "PASS", "summary": "Compiled", "compiled": True,
            "compiler_available": True, "compiler_output": "Build complete",
        }
        with patch.object(application.shutil, "which", return_value="arduino-cli.exe"), patch.object(application, "compile_sketch", return_value=compiler_result) as compile_mock:
            response = self.client.post("/api/verify", json={
                "code": self.valid_sketch(), "board": "Arduino Uno", "compile": True,
            })
        compile_mock.assert_called_once()
        self.assertEqual(response.json["status"], "PASS")
        self.assertTrue(response.json["compiled"])

    def test_static_review_warns_for_invalid_board_pin(self):
        code = "void setup() { pinMode(25, OUTPUT); }\nvoid loop() {}"
        response = self.client.post("/api/verify", json={
            "code": code, "board": "Arduino Uno", "compile": False,
        })
        self.assertEqual(response.json["status"], "WARNING")
        self.assertTrue(any("GPIO 25" in issue["message"] for issue in response.json["issues"]))

    def test_unsupported_board_is_rejected(self):
        response = self.client.post("/api/verify", json={
            "code": self.valid_sketch(), "board": "Raspberry Pi", "compile": False,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("supported board", response.json["error"])

    def test_non_text_board_is_rejected(self):
        response = self.client.post("/api/verify", json={
            "code": self.valid_sketch(), "board": ["Arduino Uno"], "compile": False,
        })
        self.assertEqual(response.status_code, 400)

    def test_missing_ai_configuration_is_clear(self):
        with patch.dict(os.environ, {"AI_API_KEY": ""}):
            response = self.client.post("/api/generate", json={
                "board": "Arduino Uno", "prompt": "Blink the built-in LED",
                "components": [],
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn("AI is not configured", response.json["error"])

    def test_ai_review_is_labeled_separately_from_compilation(self):
        with patch.dict(os.environ, {"AI_API_KEY": "test-key"}), patch.object(application, "request_ai", return_value={
            "review": "Check the sensor's startup delay.",
            "issues": [{"line": 4, "message": "Sensor result is not checked."}],
        }):
            response = self.client.post("/api/verify", json={
                "code": self.valid_sketch(), "board": "Arduino Uno", "compile": False,
            })
        self.assertEqual(response.json["status"], "NOT VERIFIED")
        self.assertFalse(response.json["compiled"])
        self.assertIn("ai_review", response.json)
        self.assertEqual(response.json["ai_issues"][0]["line"], 4)

    def test_projects_can_be_saved_listed_and_deleted(self):
        saved = self.client.post("/api/projects", json={
            "id": "test-project", "name": "Test sketch", "board": "Arduino Uno",
            "prompt": "Blink", "code": self.valid_sketch(),
        })
        self.assertEqual(saved.status_code, 201)
        self.assertTrue(saved.json["saved"])
        listed = self.client.get("/api/projects")
        self.assertEqual(listed.json["projects"][0]["name"], "Test sketch")
        deleted = self.client.delete("/api/projects/test-project")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get("/api/projects").json["projects"], [])


if __name__ == "__main__":
    unittest.main()