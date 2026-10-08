"""Dependency-free runtime smoke tests for the local .NET telemetry bridge.

Run while the bridge is started on http://127.0.0.1:8765.
"""
import base64
import hashlib
import json
import os
import socket
import struct
import time
import unittest
import urllib.error
import urllib.request
from datetime import datetime

BASE = "http://127.0.0.1:8765"


def get_json(path):
    with urllib.request.urlopen(BASE + path, timeout=3) as response:
        assert response.status == 200
        return json.load(response)


def read_exact(stream, count):
    data = stream.read(count)
    if len(data) != count:
        raise AssertionError("WebSocket frame truncated")
    return data


def read_text_frame(stream):
    header = read_exact(stream, 2)
    opcode = header[0] & 0x0F
    if opcode != 1:
        raise AssertionError(f"Expected a text frame; got opcode {opcode}")
    if header[1] & 0x80:
        raise AssertionError("Server frames must not be masked")
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", read_exact(stream, 2))[0]
    elif length == 127:
        length = struct.unpack("!Q", read_exact(stream, 8))[0]
    if length > 8192:
        raise AssertionError("Telemetry frame exceeded 8 KiB")
    return json.loads(read_exact(stream, length).decode("utf-8"))


class BridgeSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                payload = get_json("/api/status")
                if payload.get("connected") is True:
                    return
            except (OSError, ValueError, AssertionError):
                pass
            time.sleep(0.2)
        raise AssertionError("Bridge did not become ready within 30 seconds")

    def test_status_is_mock_and_connected(self):
        status = get_json("/api/status")
        self.assertEqual(status["status"], "ok")
        self.assertEqual(status["mode"], "mock")
        self.assertEqual(status["simulator"], "mock")
        self.assertTrue(status["connected"])
        self.assertEqual(status["connectionState"], "connected")
        self.assertGreater(status["sampleRateHz"], 0)
        self.assertGreater(status["samplesReceived"], 0)
        self.assertIsNone(status["lastError"])
        self.assertLess(status["sampleAgeMs"], 5000)
        self.assertGreater(status["incomingRateHz"], 0)
        self.assertGreater(status["samplesPublished"], 0)
        self.assertGreaterEqual(status["samplesReceived"], status["samplesPublished"])
        self.assertEqual(status["framesSkipped"], 0)
        self.assertIsNotNone(status["publicationLagMs"])
        self.assertGreaterEqual(status["publicationLagMs"], 0)

    def test_telemetry_is_plausible_and_updates(self):
        first = get_json("/api/telemetry")
        time.sleep(0.18)
        second = get_json("/api/telemetry")
        self.assertEqual(second["aircraft"], "Cessna 172 (mock)")
        self.assertNotEqual(first["timestampUtc"], second["timestampUtc"])
        datetime.fromisoformat(second["timestampUtc"].replace("Z", "+00:00"))
        for value in (
            "latitude", "longitude", "airspeedKnots", "altitudeFeet",
            "verticalSpeedFeetPerMinute", "headingDegrees", "pitchDegrees", "bankDegrees"
        ):
            self.assertIsInstance(second[value], (int, float), value)
        self.assertTrue(-90 <= second["latitude"] <= 90)
        self.assertTrue(-180 <= second["longitude"] <= 180)
        self.assertTrue(0 <= second["headingDegrees"] < 360)
        self.assertTrue(0 <= second["airspeedKnots"] < 250)

    def test_websocket_handshake_and_telemetry_frames(self):
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        with socket.create_connection(("127.0.0.1", 8765), timeout=5) as conn:
            conn.settimeout(5)
            stream = conn.makefile("rb")
            request = (
                "GET /ws HTTP/1.1\r\n"
                "Host: 127.0.0.1:8765\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\n"
                "Sec-WebSocket-Version: 13\r\n"
                "\r\n"
            )
            conn.sendall(request.encode("ascii"))
            response = stream.readline().decode("ascii")
            self.assertIn("101", response)
            headers = {}
            while True:
                line = stream.readline()
                if line == b"\r\n":
                    break
                self.assertTrue(line, "Server closed during handshake")
                name, value = line.decode("ascii").split(":", 1)
                headers[name.lower()] = value.strip()
            expected = base64.b64encode(
                hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
                             .encode("ascii")).digest()
            ).decode("ascii")
            self.assertEqual(headers["sec-websocket-accept"], expected)
            first = read_text_frame(stream)
            second = read_text_frame(stream)
            self.assertIn("airspeedKnots", first)
            self.assertNotEqual(first["timestampUtc"], second["timestampUtc"])

    def test_websocket_requires_upgrade(self):
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(BASE + "/ws", timeout=3)
        self.assertEqual(error.exception.code, 400)

    def test_host_header_does_not_allow_dns_rebinding(self):
        request = urllib.request.Request(
            BASE + "/api/status", headers={"Host": "cizi-web.example"})
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(error.exception.code, 403)

    def test_admin_update_endpoints_are_unavailable_without_windows_host(self):
        # Samostatně spuštěný bridge nesmí zpřístupnit vzdálenou správu.
        for method, path in [
            ("GET", "/api/admin/updates/status"),
            ("POST", "/api/admin/updates/check"),
        ]:
            request = urllib.request.Request(BASE + path, method=method)
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request, timeout=3)
            self.assertEqual(error.exception.code, 404)

    def test_read_only_aircraft_systems_are_marked_mock_in_ci(self):
        response = get_json("/api/aircraft/systems")
        self.assertTrue(response["connected"])
        self.assertEqual(response["systems"]["mode"], "mock")
        self.assertEqual(response["systems"]["engineRpm"], 2300)
        self.assertEqual(response["systems"]["fuelGallons"], 40)
        self.assertFalse(response["systems"]["autopilotMaster"])
        req = urllib.request.Request(
            BASE + "/api/aircraft/systems", data=b'{"autopilotMaster":true}',
            method="POST", headers={"Content-Type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(req, timeout=3)
        self.assertIn(error.exception.code, (404, 405))

    def test_simbrief_rejects_invalid_pilot_id_without_network(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            get_json("/api/flightplans/simbrief/invalid")
        self.assertEqual(failure.exception.code, 400)

    def test_aviation_map_is_self_contained(self):
        # Dotaz se vrátí okamžitě, i když se na pozadí poprvé stahují CSV.
        info = get_json("/api/map/aviation?lat=50.1&lon=14.26&radiusKm=60")
        self.assertEqual(info["source"], "OurAirports")
        self.assertIn("loading", info)
        self.assertIn("features", info)
        self.assertIsInstance(info["features"], list)
        self.assertLessEqual(len(info["features"]), 240)

    def test_aviation_map_rejects_invalid_radius(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            get_json("/api/map/aviation?lat=50&lon=14&radiusKm=20000")
        self.assertEqual(failure.exception.code, 400)

    def test_noaa_weather_validates_icao_before_network(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            get_json("/api/weather/123")
        self.assertEqual(failure.exception.code, 400)

    def test_aviation_map_rejects_invalid_coordinates(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            get_json("/api/map/aviation?lat=999&lon=0")
        self.assertEqual(failure.exception.code, 400)

    def test_landing_stats_are_not_faked_in_mock(self):
        last = get_json("/api/landings/latest")
        self.assertFalse(last["connected"])
        self.assertIsNone(last["landing"])

    def test_gps_navigation_not_faked_in_mock(self):
        navigation = get_json("/api/navigation/current")
        self.assertFalse(navigation["connected"])
        self.assertIsNone(navigation["navigation"])

    def test_recorder_is_read_only_and_persists_mock_sample(self):
        # Mock se používá jen v CI, nikoliv jako falešná produkční telemetrie.
        time.sleep(1.3)
        flights = get_json("/api/flights")
        self.assertIsInstance(flights, list)
        self.assertGreaterEqual(len(flights), 1)
        self.assertEqual(flights[0]["mode"], "mock")
        self.assertGreater(flights[0]["samples"], 0)
        flight = get_json("/api/flights/" + flights[0]["id"])
        self.assertEqual(flight["summary"]["id"], flights[0]["id"])
        self.assertGreater(len(flight["samples"]), 0)
        self.assertEqual(flight["samples"][0]["aircraft"], "Cessna 172 (mock)")
        with self.assertRaises(urllib.error.HTTPError) as bad:
            urllib.request.urlopen(BASE + "/api/flights/neexistujici", timeout=3)
        self.assertEqual(bad.exception.code, 404)

    def test_no_unauthenticated_command_api(self):
        payload = b'{"command":"autopilot.heading.set","value":90}'
        request = urllib.request.Request(
            BASE + "/api/commands", data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(error.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
