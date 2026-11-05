"""Chuyển postman/ (YAML v3) sang JSON v2.1 để import vào Postman bản free.

Chạy: python3 docs/postman-export/build_json.py
Cần: pip install pyyaml
"""
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "postman"
OUT = Path(__file__).resolve().parent
SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"


def load(path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def to_auth(a):
    if not a:
        return None
    if a["type"] == "noauth":
        return {"type": "noauth"}
    return {a["type"]: [{"key": c["key"], "value": c["value"], "type": "string"}
                        for c in a.get("credentials", [])],
            "type": a["type"]}


def to_url(raw):
    url = {"raw": raw}
    m = re.match(r"^(\{\{[^}]+\}\})(/[^?]*)?(?:\?(.*))?$", raw)
    if m:
        url["host"] = [m.group(1)]
        url["path"] = [p for p in (m.group(2) or "").split("/") if p]
        if m.group(3):
            url["query"] = [dict(zip(("key", "value"), q.split("=", 1) + [""]))
                            for q in m.group(3).split("&")]
    return url


def to_request(path):
    d = load(path)
    headers = d.get("headers") or []
    if isinstance(headers, dict):
        headers = [{"key": k, "value": v} for k, v in headers.items()]
    req = {"method": d["method"],
           "header": [{"key": h["key"], "value": h["value"]} for h in headers],
           "url": to_url(d["url"])}
    if "body" in d:
        req["body"] = {"mode": "raw", "raw": d["body"]["content"],
                       "options": {"raw": {"language": "json"}}}
    auth = to_auth(d.get("auth"))
    if auth:
        req["auth"] = auth
    item = {"name": path.name.removesuffix(".request.yaml"), "request": req}
    events = [{"listen": "test" if s["type"] == "afterResponse" else "prerequest",
               "script": {"type": "text/javascript", "exec": s["code"].split("\n")}}
              for s in d.get("scripts", [])]
    if events:
        item["event"] = events
    return d.get("order", 0), item


def to_folder(folder):
    meta = load(folder / ".resources" / "definition.yaml")
    entries = []
    for p in folder.iterdir():
        if p.is_dir() and not p.name.startswith("."):
            sub = load(p / ".resources" / "definition.yaml")
            entries.append((sub.get("order", 0), to_folder(p)))
        elif p.name.endswith(".request.yaml"):
            entries.append(to_request(p))
    entries.sort(key=lambda e: (e[0], e[1]["name"]))
    node = {"name": meta["name"], "item": [e[1] for e in entries]}
    if meta.get("description"):
        node["description"] = meta["description"]
    return node


def build_collection():
    root = SRC / "collections" / "Sports Court Booking API"
    meta = load(root / ".resources" / "definition.yaml")
    node = to_folder(root)
    col = {"info": {"name": meta["name"], "description": meta.get("description", ""),
                    "schema": SCHEMA},
           "item": node["item"]}
    auth = to_auth(meta.get("auth"))
    if auth:
        col["auth"] = auth
    return col


def build_env(path):
    d = load(path)
    return {"name": d["name"],
            "values": [{"key": v["key"], "value": v.get("value", ""),
                        "type": v.get("type", "default"), "enabled": v.get("enabled", True)}
                       for v in d["values"]],
            "_postman_variable_scope": "environment"}


def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")


if __name__ == "__main__":
    dump("Sports Court Booking API.postman_collection.json", build_collection())
    for env in sorted((SRC / "environments").glob("*.environment.yaml")):
        dump(f"{env.name.removesuffix('.environment.yaml')}.postman_environment.json",
             build_env(env))
    print("Xong:", *sorted(p.name for p in OUT.glob("*.json")), sep="\n- ")
