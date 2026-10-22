#!/usr/bin/env python3
"""
PrintF Agent Windows Service

Runs the PrintF Agent as a Windows service for automatic startup.
"""

import sys
import os
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager
    import socket
except ImportError:
    print("Error: pywin32 is required to run as a Windows service")
    print("Install with: pip install pywin32")
    sys.exit(1)

from agent import PrintFAgent


class PrintFService(win32serviceutil.ServiceFramework):
    """Windows Service wrapper for PrintF Agent."""
    
    _svc_name_ = "PrintFAgent"
    _svc_display_name_ = "PrintF Print Agent"
    _svc_description_ = "Polls for print jobs and executes printing on this machine."
    
    def __init__(self, args):
        """Initialize service."""
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.agent = None
        socket.setdefaulttimeout(60)
    
    def SvcStop(self):
        """Handle stop request."""
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        
        if self.agent:
            self.agent.stop()
    
    def SvcDoRun(self):
        """Main service run method."""
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )
        
        try:
            # Change to service directory
            service_dir = os.path.dirname(os.path.abspath(__file__))
            os.chdir(service_dir)
            
            # Create and run agent
            self.agent = PrintFAgent()
            self.agent.run()
            
        except Exception as e:
            servicemanager.LogErrorMsg(f"PrintF Agent error: {e}")
        
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STOPPED,
            (self._svc_name_, '')
        )


def main():
    """Main entry point for service installation/control."""
    if len(sys.argv) == 1:
        # Running as service
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(PrintFService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        # Handle command line (install, start, stop, remove, etc.)
        win32serviceutil.HandleCommandLine(PrintFService)


if __name__ == '__main__':
    main()
