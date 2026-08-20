# 🛡️ CodeSentinel: LLM-Powered Code Reviewer & Security Audit CLI

A terminal-based static analysis and security auditing CLI that inspects source code for vulnerabilities, logic bugs, and resource leaks using Google Gemini and Pydantic schema validation.

---

## ✨ Features

- **Automated Code & Security Audit:** Scans source files for critical vulnerabilities (SQL injections, exposed credentials), runtime bugs, resource leaks, and code anti-patterns.
- **Deterministic Structured Output:** Utilizes Pydantic schemas with Gemini's structured JSON output to guarantee consistent, type-safe reports.
- **Rich Terminal Interface:** Displays live progress spinners, summary panels, and color-coded severity tables directly in the console.
- **Multi-Format Export:** Generates GitHub-flavored Markdown (`.md`) tables for pull request reviews or structured JSON (`.json`) for CI/CD pipelines.

---

## 🛠️ Tech Stack

- **Language:** Python 3.10+
- **LLM Engine:** Gemini 3.6 Flash (`google-genai`)
- **Data Validation:** Pydantic V2
- **Terminal UI:** Rich
- **CLI Parsing:** Argparse

---

## 📁 Project Structure

```text
code-audit-cli/
├── audit.py             # CLI entry point, execution flow & report generation
├── schemas.py           # Pydantic data models for structured LLM responses
├── requirements.txt     # Python dependencies
├── .env                 # API credentials (git-ignored)
├── .gitignore           # Git ignore rules
└── vulnerable_test.py   # Test script containing intentional vulnerabilities
```

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/code-audit-cli.git
cd code-audit-cli
```

### 2. Create and Activate a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory and add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```

---

## 💻 Usage & Examples

### 1. Terminal Console Audit
Audit a single file and display findings in a formatted console table:
```bash
python audit.py --file vulnerable_test.py
```

### 2. Export to Markdown (`.md`)
Generate a formatted Markdown report suitable for GitHub PR summaries:
```bash
python audit.py --file vulnerable_test.py --output report.md
```

### 3. Export to JSON (`.json`)
Export the raw structured audit findings for automation pipelines:
```bash
python audit.py --file vulnerable_test.py --output report.json
```

---

## 🧪 Sample Audit Output

### Terminal Preview

```text
╭──────────────────────────────── Audit Summary: vulnerable_test.py ────────────────────────────────╮
│ The analyzed Python file contains critical security vulnerabilities, including SQL injection and   │
│ hardcoded credentials, as well as unclosed database connection resources.                        │
╰───────────────────────────────────────────────────────────────────────────────────────────────────╯
┏━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Severity ┃ Category ┃ Line ┃ Description                         ┃ Recommended Fix                     ┃
┡━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ Critical │ Security │ 7    │ Hardcoded API key detected.         │ Retrieve keys from environment vars │
│ Critical │ Security │ 8-9  │ SQL injection via dynamic string.   │ Use parameterized cursor.execute()  │
│ Warning  │ Bug      │ 5-10 │ Connection/cursor not closed.       │ Use context managers (with sqlite3) │
└──────────┴──────────┴──────┴─────────────────────────────────────┴─────────────────────────────────────┘
```

### Exported Markdown Preview (`report.md`)

| Severity | Category | Line(s) | Description | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | Security | `7` | Hardcoded API key detected in source code. | Retrieve API keys from secure environment variables. |
| **Critical** | Security | `8-9` | SQL injection vulnerability resulting from dynamic string formatting. | Use parameterized queries: `cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))`. |
| **Warning** | Bug | `5-10` | Database connection and cursor are not explicitly closed. | Utilize context managers or ensure `conn.close()` is called. |

---

## 📄 License
MIT License