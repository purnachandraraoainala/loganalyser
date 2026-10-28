import os
import re
import csv
import json
import io
from collections import Counter
from datetime import datetime

from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, send_file
)
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = "log-analyser-secret-key"

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
ALLOWED_EXTENSIONS = {"log", "txt", "csv"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB


# ── helpers ────────────────────────────────────────────────────────────────

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# Common log patterns: Apache/Nginx combined, syslog, simple timestamped
LOG_PATTERNS = [
    # Apache / Nginx combined
    re.compile(
        r'(?P<ip>\S+) \S+ \S+ \[(?P<timestamp>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+'
    ),
    # Syslog: "Jan  1 00:00:00 host service[pid]: message"
    re.compile(
        r'(?P<timestamp>\w{3}\s+\d{1,2}\s+[\d:]+)\s+\S+\s+(?P<service>\S+?)(?:\[\d+\])?:\s+(?P<message>.+)'
    ),
    # ISO timestamp  "2024-01-01T00:00:00 LEVEL message"
    re.compile(
        r'(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(?P<level>DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)\s+(?P<message>.+)',
        re.IGNORECASE,
    ),
    # Generic  "LEVEL: message"
    re.compile(
        r'(?P<level>DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)[:\s]+(?P<message>.+)',
        re.IGNORECASE,
    ),
]

LEVEL_RE = re.compile(r'\b(DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\b', re.IGNORECASE)


def parse_log_file(filepath):
    entries = []
    with open(filepath, "r", errors="replace") as fh:
        for lineno, raw in enumerate(fh, start=1):
            line = raw.rstrip("\n")
            if not line.strip():
                continue
            entry = {"lineno": lineno, "raw": line, "level": "INFO",
                     "timestamp": "", "message": line}
            for pat in LOG_PATTERNS:
                m = pat.search(line)
                if m:
                    d = m.groupdict()
                    entry["timestamp"] = d.get("timestamp", "")
                    entry["level"] = d.get("level", entry["level"]).upper()
                    entry["message"] = d.get("message", line)
                    break
            # level fallback via scan
            lm = LEVEL_RE.search(line)
            if lm:
                lvl = lm.group(1).upper()
                entry["level"] = "WARNING" if lvl == "WARN" else lvl
            entries.append(entry)
    return entries


def compute_stats(entries):
    level_counts = Counter(e["level"] for e in entries)
    return {
        "total": len(entries),
        "levels": dict(level_counts),
    }


# ── routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    if "logfile" not in request.files:
        return jsonify({"error": "No file part"}), 400
    f = request.files["logfile"]
    if f.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(f.filename):
        return jsonify({"error": "Unsupported file type"}), 400

    filename = secure_filename(f.filename)
    dest = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    f.save(dest)
    session["current_file"] = filename
    return jsonify({"filename": filename})


@app.route("/analyse")
def analyse():
    filename = session.get("current_file")
    if not filename:
        return redirect(url_for("index"))
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    entries = parse_log_file(filepath)
    stats = compute_stats(entries)
    return render_template("dashboard.html", filename=filename, stats=stats)


@app.route("/api/entries")
def api_entries():
    filename = session.get("current_file")
    if not filename:
        return jsonify([])
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    entries = parse_log_file(filepath)

    # filters
    level = request.args.get("level", "").upper()
    query = request.args.get("q", "").lower()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 100))

    if level:
        entries = [e for e in entries if e["level"] == level]
    if query:
        entries = [e for e in entries if query in e["raw"].lower()]

    total = len(entries)
    start = (page - 1) * per_page
    page_entries = entries[start: start + per_page]

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "entries": page_entries})


@app.route("/api/stats")
def api_stats():
    filename = session.get("current_file")
    if not filename:
        return jsonify({})
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    entries = parse_log_file(filepath)
    stats = compute_stats(entries)
    return jsonify(stats)


@app.route("/export")
def export():
    filename = session.get("current_file")
    if not filename:
        return redirect(url_for("index"))
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    entries = parse_log_file(filepath)

    # filters (same as api_entries)
    level = request.args.get("level", "").upper()
    query = request.args.get("q", "").lower()
    if level:
        entries = [e for e in entries if e["level"] == level]
    if query:
        entries = [e for e in entries if query in e["raw"].lower()]

    fmt = request.args.get("fmt", "csv")
    if fmt == "json":
        buf = io.BytesIO(json.dumps(entries, indent=2).encode())
        return send_file(buf, mimetype="application/json",
                         as_attachment=True,
                         download_name="log_export.json")
    else:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["lineno", "timestamp", "level", "message", "raw"])
        writer.writeheader()
        writer.writerows(entries)
        buf = io.BytesIO(output.getvalue().encode())
        return send_file(buf, mimetype="text/csv",
                         as_attachment=True,
                         download_name="log_export.csv")


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True, port=5000)
