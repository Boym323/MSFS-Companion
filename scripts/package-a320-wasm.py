#!/usr/bin/env python3
"""Package SDK-compiled Kokpit A320 WASM for Community (without installing)."""
import argparse
import datetime as dt
import json
from pathlib import Path
import shutil

def package(wasm: Path, destination: Path) -> Path:
    data=wasm.read_bytes()
    if not data.startswith(b"\x00asm\x01\x00\x00\x00"):
        raise ValueError("Not an MSFS SDK WebAssembly v1 binary.")
    root=destination/"kokpit-asobo-a320-v1"
    output=root/"modules"/"kokpit-a320.wasm"
    output.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(wasm,output)
    now=dt.datetime.now(dt.timezone.utc)
    ticks=int((now-dt.datetime(1601,1,1,tzinfo=dt.timezone.utc)).total_seconds()*10000000)
    (root/"layout.json").write_text(json.dumps([{
        "path":"modules/kokpit-a320.wasm","size":len(data),"date":ticks
    }],indent=2),encoding="utf-8")
    (root/"manifest.json").write_text(json.dumps({
        "content_type":"MISC","title":"Kokpit Asobo A320neo H-Event Module",
        "creator":"Kokpit","manufacturer":"","package_version":"0.1.0",
        "minimum_game_version":"1.0.0","dependencies":[],
        "release_notes":{"neutral":{"LastUpdate":"Initial H-event module","OlderHistory":""}},
        "total_package_size":f"{len(data):020d}"
    },indent=2),encoding="utf-8")
    return root

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("wasm",type=Path)
    p.add_argument("destination",type=Path)
    args=p.parse_args()
    print(package(args.wasm,args.destination))
