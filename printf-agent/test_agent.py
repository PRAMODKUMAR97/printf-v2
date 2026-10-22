#!/usr/bin/env python3
"""
PrintF Agent Test Suite

Tests for validating agent functionality without actual printing.
"""

import os
import sys
import json
import unittest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestPrintFAgent(unittest.TestCase):
    """Test cases for PrintF Agent."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_config = {
            "printf_id": "test-printf-id",
            "api_key": "test-api-key",
            "supabase_url": "https://test.supabase.co",
            "supabase_anon_key": "test-anon-key",
            "printer_name": "Test Printer",
            "poll_interval": 1,
            "download_path": "./test_downloads",
            "log_level": "DEBUG"
        }
        
        # Create test config file
        self.config_path = Path("test_config.json")
        with open(self.config_path, 'w') as f:
            json.dump(self.test_config, f)
    
    def tearDown(self):
        """Clean up test fixtures."""
        if self.config_path.exists():
            self.config_path.unlink()
        
        # Clean up test downloads
        test_downloads = Path("./test_downloads")
        if test_downloads.exists():
            import shutil
            shutil.rmtree(test_downloads)
    
    @patch('agent.create_client')
    def test_agent_initialization(self, mock_create_client):
        """Test agent initializes correctly."""
        from agent import PrintFAgent
        
        mock_create_client.return_value = Mock()
        
        agent = PrintFAgent("test_config.json")
        
        self.assertEqual(agent.printf_id, "test-printf-id")
        self.assertEqual(agent.api_key, "test-api-key")
        self.assertEqual(agent.printer_name, "Test Printer")
        self.assertEqual(agent.poll_interval, 1)
    
    @patch('agent.create_client')
    def test_authentication_success(self, mock_create_client):
        """Test successful authentication."""
        from agent import PrintFAgent
        
        mock_supabase = Mock()
        mock_response = Mock()
        mock_response.data = {
            "id": "test-printf-id",
            "name": "Test PrintF",
            "api_key": "test-api-key"
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_supabase
        
        agent = PrintFAgent("test_config.json")
        result = agent.authenticate()
        
        self.assertTrue(result)
    
    @patch('agent.create_client')
    def test_authentication_failure_wrong_key(self, mock_create_client):
        """Test authentication fails with wrong API key."""
        from agent import PrintFAgent
        
        mock_supabase = Mock()
        mock_response = Mock()
        mock_response.data = {
            "id": "test-printf-id",
            "name": "Test PrintF",
            "api_key": "wrong-api-key"
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_supabase
        
        agent = PrintFAgent("test_config.json")
        result = agent.authenticate()
        
        self.assertFalse(result)
    
    @patch('agent.create_client')
    def test_poll_jobs(self, mock_create_client):
        """Test job polling returns jobs."""
        from agent import PrintFAgent
        
        mock_supabase = Mock()
        mock_response = Mock()
        mock_response.data = [
            {
                "id": "job-1",
                "printf_id": "test-printf-id",
                "file_path": "print-files/test.pdf",
                "file_name": "test.pdf",
                "status": "ready",
                "locked": False,
                "settings_json": {"copies": 1}
            }
        ]
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_supabase
        
        agent = PrintFAgent("test_config.json")
        jobs = agent.poll_jobs()
        
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["id"], "job-1")
    
    @patch('agent.create_client')
    def test_lock_job(self, mock_create_client):
        """Test job locking."""
        from agent import PrintFAgent
        
        mock_supabase = Mock()
        mock_response = Mock()
        mock_response.data = [{"id": "job-1", "locked": True}]
        mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_response
        mock_create_client.return_value = mock_supabase
        
        agent = PrintFAgent("test_config.json")
        result = agent.lock_job("job-1")
        
        self.assertTrue(result)
    
    def test_config_not_found(self):
        """Test error when config file not found."""
        from agent import PrintFAgent
        
        with self.assertRaises(FileNotFoundError):
            PrintFAgent("nonexistent_config.json")


class TestPrinterIntegration(unittest.TestCase):
    """Integration tests for printer functionality (Windows only)."""
    
    @unittest.skipUnless(sys.platform == 'win32', "Windows only test")
    def test_list_printers(self):
        """Test listing available printers."""
        import win32print
        
        printers = win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        )
        
        # Should have at least one printer or be empty
        self.assertIsInstance(printers, tuple)
    
    @unittest.skipUnless(sys.platform == 'win32', "Windows only test")
    def test_get_default_printer(self):
        """Test getting default printer."""
        import win32print
        
        try:
            default = win32print.GetDefaultPrinter()
            self.assertIsInstance(default, str)
        except:
            # No default printer is OK
            pass


if __name__ == '__main__':
    unittest.main(verbosity=2)
