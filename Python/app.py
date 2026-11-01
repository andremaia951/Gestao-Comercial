"""Backend local do Varejo+ (Python + SQLite, biblioteca padrão).

Execute com: py -3 app.py (Windows) ou python3 app.py (Linux/macOS)
Depois abra: http://127.0.0.1:8000
O banco gestao_comercial.db e os logs são criados automaticamente nesta pasta.
"""
from __future__ import annotations
import json
import sqlite3
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(__file__).resolve().parent / "gestao_comercial.db"
PORT = 8000

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, sale_number TEXT, data_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS delivery_contacts (id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, details_json TEXT NOT NULL,
  created_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'application'
);
CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_logs_created ON audit_logs(created_at);
"""

def connect():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def save_collection(db, table, values):
    db.execute(f"DELETE FROM {table}")
    for item in values if isinstance(values, list) else []:
        item_id = str(item.get("id") or item.get("number") or "")
        if not item_id:
            continue
        number = item.get("number") if table == "sales" else None
        if table == "sales":
            db.execute("INSERT OR REPLACE INTO sales(id,sale_number,data_json,updated_at) VALUES(?,?,?,?)", (item_id, number, json.dumps(item, ensure_ascii=False), now()))
        else:
            db.execute(f"INSERT OR REPLACE INTO {table}(id,data_json,updated_at) VALUES(?,?,?)", (item_id, json.dumps(item, ensure_ascii=False), now()))

def add_log(db, entry, source="application"):
    db.execute("INSERT OR REPLACE INTO audit_logs(id,action,details_json,created_at,source) VALUES(?,?,?,?,?)", (
        str(entry.get("id") or f"log-{now()}"), str(entry.get("action") or "unknown"),
        json.dumps(entry.get("details") or {}, ensure_ascii=False), str(entry.get("createdAt") or now()), source))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 8_000_000:
            raise ValueError("Requisição muito grande")
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/HTML/index.html")
            self.end_headers()
            return
        if path == "/api/health":
            with connect() as db:
                count = {t: db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("products", "sales", "delivery_contacts", "audit_logs")}
            return self.send_json(200, {"ok": True, "database": str(DB_PATH.name), "counts": count})
        if path == "/api/logs":
            with connect() as db:
                rows = db.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500").fetchall()
            return self.send_json(200, {"logs": [dict(r) for r in rows]})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            with connect() as db:
                if path == "/api/log":
                    add_log(db, payload)
                    db.commit()
                    return self.send_json(201, {"ok": True})
                if path == "/api/snapshot":
                    save_collection(db, "products", payload.get("products", []))
                    save_collection(db, "sales", payload.get("sales", []))
                    save_collection(db, "delivery_contacts", payload.get("contacts", []))
                    add_log(db, {"action": "database_snapshot_synced", "details": {
                        "products": len(payload.get("products", [])), "sales": len(payload.get("sales", [])),
                        "contacts": len(payload.get("contacts", []))}})
                    db.commit()
                    return self.send_json(200, {"ok": True, "message": "Dados sincronizados no SQLite"})
            return self.send_json(404, {"ok": False, "error": "Rota não encontrada"})
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            return self.send_json(500, {"ok": False, "error": "Erro interno ao gravar dados"})

    def log_message(self, fmt, *args):
        # Mantém o terminal limpo; eventos de negócio ficam em audit_logs.
        pass

if __name__ == "__main__":
    with connect() as db:
        add_log(db, {"action": "backend_started", "details": {"port": PORT}}, "system")
    print(f"Varejo+ disponível em http://127.0.0.1:{PORT}")
    print(f"Banco SQLite: {DB_PATH}")
    print("Para parar o servidor, pressione Ctrl+C.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
