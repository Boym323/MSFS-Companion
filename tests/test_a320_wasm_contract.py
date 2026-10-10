"""Static contract consistency in CI, not a substitute for SDK compilation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]

class WasmContractTests(unittest.TestCase):
    def test_only_known_h_events_exist(self):
        cpp=(ROOT/"apps/a320-wasm/KokpitA320Module.cpp").read_text()
        dotnet=(ROOT/"apps/bridge/Airbus/A320WasmProtocol.cs").read_text()
        names=["SPEED","SPEED","HEADING","HEADING","ALTITUDE","ALTITUDE"]
        modes=["SELECTED","MANAGED"]*3
        for index,(name,mode) in enumerate(zip(names,modes),1):
            api=f'a320.fcu.{name.lower()}.{mode.lower()}'
            event=f'A320_Neo_CDU_MODE_{mode}_{name}'
            self.assertIn(f'new("{api}",{index})',dotnet)
            self.assertIn(f'case {index}: return "(>H:{event})";',cpp)
        self.assertEqual(cpp.count('return "(>H:'),6)
        self.assertNotIn('execute_calculator_code(command',cpp)
        self.assertNotIn('a320.fcu.ap1.on',dotnet)
        for s in ["Kokpit.A320.Command.v1","Kokpit.A320.Response.v1"]:
            self.assertIn(s,cpp)
            self.assertIn(s,dotnet)

    def test_packager_validates_magic_and_layout(self):
        spec=importlib.util.spec_from_file_location("wasmpackage",ROOT/"scripts/package-a320-wasm.py")
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp)/"input.wasm"
            source.write_bytes(b"bad module")
            with self.assertRaises(ValueError):module.package(source,Path(tmp)/"out")
            source.write_bytes(b"\x00asm\x01\x00\x00\x00")
            root=module.package(source,Path(tmp)/"out")
            layout=json.loads((root/"layout.json").read_text())
            manifest=json.loads((root/"manifest.json").read_text())
            self.assertEqual(layout[0]["path"],"modules/kokpit-a320.wasm")
            self.assertEqual(layout[0]["size"],8)
            self.assertEqual(manifest["content_type"],"MISC")
            self.assertTrue((root/"modules"/"kokpit-a320.wasm").exists())
