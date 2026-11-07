"""Smoke ochrany ovládání na mock bridge. Neodesílá žádné události do MSFS."""
import json
import urllib.error
import urllib.request
import unittest

BASE = "http://127.0.0.1:8765"
ORIGIN = BASE


def request(method, path, data=None, headers=None):
    encoded = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, data=encoded, method=method,
                                 headers={"Origin": ORIGIN, "Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, None


class ControlsSmoke(unittest.TestCase):
    def test_security_and_mock_isolation(self):
        status, state = request("GET", "/api/controls/status")
        self.assertEqual(status, 200)
        self.assertFalse(state["enabled"])
        self.assertTrue(state["canControl"])  # výchozí důvěryhodná LAN bez párování
        self.assertFalse(state["autopilotSupported"])  # mock cannot enable Airbus AP
        status, _ = request("POST", "/api/controls/command", {"command": "autopilot.on"})
        self.assertEqual(status, 409)  # mock nikdy nepoužívá SimConnect k zápisu

        status, data = request("POST", "/api/controls/local", {"enabled": True},
                               {"X-MSFS-Companion-Action": "control-local"})
        self.assertEqual(status, 200)
        self.assertEqual(len(data["pairCode"]), 6)
        try:
            status, _ = request("POST", "/api/controls/command", {"command": "autopilot.on"})
            self.assertEqual(status, 401)  # ochrana zapnuta bez tokenu
            status, _ = request("POST", "/api/controls/pair", {"code": "invalid"})
            self.assertEqual(status, 401)
            status, token_data = request("POST", "/api/controls/pair", {"code": data["pairCode"]})
            self.assertEqual(status, 200)
            token = token_data["token"]
            self.assertEqual(len(token), 64)
            auth = {"X-MSFS-Control-Token": token}
            status, _ = request("POST", "/api/controls/command", {"command": "unknown.event", "value": 1}, auth)
            self.assertEqual(status, 400)
            status, _ = request("POST", "/api/controls/command", {"command": "autopilot.on"}, auth)
            self.assertEqual(status, 409, "Mock nesmí nikdy odesílat kokpitní příkazy")
            status, _ = request("POST", "/api/controls/command", {"command": "autopilot.heading.set", "value": 999}, auth)
            self.assertEqual(status, 400)
            status, ap_modes = request("GET", "/api/autopilot/modes")
            self.assertEqual(status, 200)
            self.assertFalse(ap_modes["connected"])
            self.assertIsNone(ap_modes["modes"])
            # Retired Garmin endpoints must always fail closed; even a paired
            # client may not send the old Input Events after migration.
            for path in ("/api/avionics/g1000", "/api/avionics/advanced"):
                status, _ = request("GET", path)
                self.assertEqual(status, 410)
            for path in ("/api/avionics/g1000/command",
                         "/api/avionics/advanced/command"):
                status, _ = request("POST", path, {"id": "arbitrary-event", "value": 1}, auth)
                self.assertEqual(status, 410)
            status, capabilities = request("GET", "/api/aircraft/capabilities")
            self.assertEqual(status, 200)
            self.assertFalse(capabilities["connected"])
            self.assertFalse(capabilities["assessment"]["commandsConfirmed"])
            self.assertFalse(capabilities["assessment"]["fmsVerified"])
            status, cockpit = request("GET", "/api/cockpit/systems")
            self.assertEqual(status, 200)
            self.assertFalse(cockpit["connected"])
            status, _ = request("POST", "/api/controls/command",
                                {"command": "brakes.parking.set", "value": 2}, auth)
            self.assertEqual(status, 400)
            status, radios = request("GET", "/api/radios")
            self.assertEqual(status, 200)
            self.assertFalse(radios["connected"])
            self.assertIsNone(radios["radios"])
        finally:
            status, _ = request("POST", "/api/controls/local", {"enabled": False},
                                {"X-MSFS-Companion-Action": "control-local"})
            self.assertEqual(status, 200)
        status, state = request("GET", "/api/controls/status", headers=auth)
        self.assertEqual(status, 200)
        self.assertFalse(state["enabled"])
        self.assertTrue(state["canControl"])
