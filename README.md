# Log Analyser

A full-featured web-based log analysis tool built with **Python + Flask**.

## Features
- **Upload** `.log`, `.txt`, or `.csv` files (up to 50 MB) via drag-and-drop or file picker
- **Auto-parse** Apache/Nginx, syslog, ISO-timestamp, and generic level-prefixed formats
- **Dashboard** with summary cards for total lines and per-level counts
- **Charts** — doughnut and bar charts for level distribution (Chart.js)
- **Search & filter** — full-text search + level filter with pagination (100 lines/page)
- **Export** filtered results as CSV or JSON

## Project Structure

```
log_analyser/
├── app.py                  # Flask app — routes, parser, export
├── requirements.txt
├── uploads/                # Uploaded files (auto-created)
├── templates/
│   ├── index.html          # Upload page
│   └── dashboard.html      # Analysis dashboard
└── static/
    ├── css/style.css
    └── js/
        ├── upload.js
        └── dashboard.js
```

## Quick Start

```bash
# 1. Create & activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the app
python app.py
```

Open **http://localhost:5000** in your browser.

## Supported Log Formats

| Format | Example |
|--------|---------|
| Apache/Nginx combined | `127.0.0.1 - - [01/Jan/2024:00:00:00 +0000] "GET / HTTP/1.1" 200 1234` |
| Syslog | `Jan  1 00:00:00 host sshd[123]: message` |
| ISO timestamp | `2024-01-01T00:00:00 ERROR something went wrong` |
| Generic level prefix | `ERROR: connection refused` |
