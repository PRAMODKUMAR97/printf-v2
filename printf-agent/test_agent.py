#!/usr/bin/env python3
"""Unit tests for the PrintF v2 printer agent API contract."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parent))
from agent import PrintFAgent
import fitz


class TestPrintFAgent(unittest.TestCase):
    def setUp(self):
        self.config_path = Path(__file__).parent / "test_config.json"
        self.test_config = {
            "printf_id": "550e8400-e29b-41d4-a716-446655440000",
            "api_key": "unit-test-station-key",
            "supabase_url": "https://example.supabase.co",
            "supabase_anon_key": "sb_publishable_test_key",
            "printer_name": "Test Printer",
            "poll_interval": 1,
            "download_path": "./test_downloads",
            "log_level": "DEBUG",
        }
        self.config_path.write_text(json.dumps(self.test_config), encoding="utf-8")
        self.client_patcher = patch("agent.create_client", return_value=Mock())
        self.client_patcher.start()
        self.addCleanup(self.client_patcher.stop)

    def tearDown(self):
        self.config_path.unlink(missing_ok=True)
        test_downloads = Path("./test_downloads")
        if test_downloads.exists():
            import shutil
            shutil.rmtree(test_downloads)

    def test_agent_initialization(self):
        agent = PrintFAgent("test_config.json")
        self.assertEqual(agent.printf_id, self.test_config["printf_id"])
        self.assertEqual(agent.api_key, self.test_config["api_key"])
        self.assertEqual(agent.printer_name, "Test Printer")
        self.assertEqual(agent.poll_interval, 1)

    def test_authentication_success_uses_edge_function(self):
        agent = PrintFAgent("test_config.json")
        expected = {
            "success": True,
            "station": {"id": self.test_config["printf_id"], "name": "Test PrintF", "status": "online"},
        }
        with patch.object(agent, "_edge_call", return_value=expected) as edge_call:
            self.assertTrue(agent.authenticate())
            edge_call.assert_called_once_with("authenticate")

    def test_authentication_rejects_wrong_station(self):
        agent = PrintFAgent("test_config.json")
        response = {"success": True, "station": {"id": "different-station", "name": "Other", "status": "online"}}
        with patch.object(agent, "_edge_call", return_value=response):
            self.assertFalse(agent.authenticate())

    def test_poll_jobs_returns_jobs_from_edge_function(self):
        agent = PrintFAgent("test_config.json")
        jobs = [{
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "printf_id": self.test_config["printf_id"],
            "file_path": "jobs/550e8400-e29b-41d4-a716-446655440002.pdf",
            "file_name": "test.pdf",
            "status": "ready",
            "locked": False,
            "settings_json": {"copies": 1, "color": False, "duplex": False, "layout": 1},
        }]
        with patch.object(agent, "_edge_call", return_value={"jobs": jobs}) as edge_call:
            self.assertEqual(agent.poll_jobs(), jobs)
            edge_call.assert_called_once_with("poll")

    def test_poll_jobs_handles_invalid_response(self):
        agent = PrintFAgent("test_config.json")
        with patch.object(agent, "_edge_call", return_value={"jobs": "not-a-list"}):
            self.assertEqual(agent.poll_jobs(), [])

    def test_lock_job(self):
        agent = PrintFAgent("test_config.json")
        with patch.object(agent, "_edge_call", return_value={"locked": True}) as edge_call:
            self.assertTrue(agent.lock_job("550e8400-e29b-41d4-a716-446655440001"))
            edge_call.assert_called_once_with("lock", job_id="550e8400-e29b-41d4-a716-446655440001")

    def test_update_job_status(self):
        agent = PrintFAgent("test_config.json")
        with patch.object(agent, "_edge_call", return_value={"success": True}) as edge_call:
            agent.update_job_status("550e8400-e29b-41d4-a716-446655440001", "completed")
            edge_call.assert_called_once_with(
                "update_job",
                job_id="550e8400-e29b-41d4-a716-446655440001",
                status="completed",
            )

    def test_pdf_page_range_is_applied(self):
        agent = PrintFAgent("test_config.json")
        source = Path(agent.download_path) / "four-pages.pdf"
        document = fitz.open()
        for number in range(1, 5):
            page = document.new_page()
            page.insert_text((72, 72), "page-" + str(number))
        document.save(source)
        document.close()
        prepared = agent._prepare_pdf_for_print(source, {"page_range": "2,4", "layout": 1})
        try:
            with fitz.open(prepared) as output:
                self.assertEqual(output.page_count, 2)
                self.assertIn("page-2", output[0].get_text())
                self.assertIn("page-4", output[1].get_text())
        finally:
            prepared.unlink(missing_ok=True)
            source.unlink(missing_ok=True)

    def test_two_up_layout_uses_landscape_a4(self):
        agent = PrintFAgent("test_config.json")
        source = Path(agent.download_path) / "four-pages.pdf"
        document = fitz.open()
        for number in range(1, 5):
            page = document.new_page()
            page.insert_text((72, 72), "page-" + str(number))
        document.save(source)
        document.close()
        prepared = agent._prepare_pdf_for_print(source, {"page_range": "1-3", "layout": 2})
        try:
            with fitz.open(prepared) as output:
                self.assertEqual(output.page_count, 2)
                self.assertGreater(output[0].rect.width, output[0].rect.height)
                self.assertIn("page-1", output[0].get_text())
                self.assertIn("page-2", output[0].get_text())
        finally:
            prepared.unlink(missing_ok=True)
            source.unlink(missing_ok=True)

    def test_four_up_layout_places_four_pages_on_one_sheet(self):
        agent = PrintFAgent("test_config.json")
        source = Path(agent.download_path) / "four-pages.pdf"
        document = fitz.open()
        for number in range(1, 5):
            page = document.new_page()
            page.insert_text((72, 72), "page-" + str(number))
        document.save(source)
        document.close()
        prepared = agent._prepare_pdf_for_print(source, {"page_range": "", "layout": 4})
        try:
            with fitz.open(prepared) as output:
                self.assertEqual(output.page_count, 1)
                page_text = output[0].get_text()
                for number in range(1, 5):
                    self.assertIn("page-" + str(number), page_text)
                self.assertGreater(output[0].rect.height, output[0].rect.width)
        finally:
            prepared.unlink(missing_ok=True)
            source.unlink(missing_ok=True)

    def test_config_not_found(self):
        with self.assertRaises(FileNotFoundError):
            PrintFAgent("missing-config.json")


if __name__ == "__main__":
    unittest.main(verbosity=2)
