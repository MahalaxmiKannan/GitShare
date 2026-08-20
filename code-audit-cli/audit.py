import os
import json
import argparse
import warnings
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from schemas import AuditReport

# Suppress minor SDK warnings in the console
warnings.filterwarnings("ignore")

load_dotenv()
console = Console()

def save_report(report: AuditReport, filename: str, output_path: str):
    """Exports the audit report to Markdown or JSON."""
    out_path = Path(output_path)
    extension = out_path.suffix.lower()

    if extension == ".json":
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(report.model_dump_json(indent=2))
        console.print(f"[bold green]✓ Report exported as JSON:[/bold green] {out_path.resolve()}")

    elif extension in [".md", ".markdown"]:
        md_content = f"# Security & Code Audit Report: `{filename}`\n\n"
        md_content += f"## Executive Summary\n{report.summary}\n\n"
        md_content += "## Findings\n\n"

        if not report.issues:
            md_content += "No security vulnerabilities or bugs identified.\n"
        else:
            md_content += "| Severity | Category | Line(s) | Description | Recommended Fix |\n"
            md_content += "| :--- | :--- | :--- | :--- | :--- |\n"
            for issue in report.issues:
                # Replace newlines in description/fix to keep markdown table clean
                desc = issue.description.replace("\n", " ")
                fix = issue.fix_suggestion.replace("\n", "<br>").replace("|", "\\|")
                md_content += f"| **{issue.severity}** | {issue.category} | `{issue.line_number}` | {desc} | {fix} |\n"

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        console.print(f"[bold green]✓ Report exported as Markdown:[/bold green] {out_path.resolve()}")

    else:
        console.print(f"[bold yellow]Warning:[/bold yellow] Unsupported export format '{extension}'. Use .md or .json.")

def run_audit(file_path: str, output_path: str = None):
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        console.print(f"[bold red]Error:[/bold red] File '{file_path}' not found.")
        return

    with open(path, "r", encoding="utf-8") as f:
        code_content = f.read()

    with console.status(f"[cyan]Auditing [bold]{path.name}[/bold] with Gemini...[/cyan]", spinner="dots"):
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        prompt = f"""
        You are an expert static code analysis and security tool. 
        Analyze the following code file: {path.name}
        
        ```
        {code_content}
        ```
        """

        try:
            response = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                    'response_schema': AuditReport,
                    'system_instruction': "Perform a rigorous security and bug review. Focus on injection risks, memory issues, runtime errors, and anti-patterns."
                },
            )
            
            report = AuditReport.model_validate_json(response.text)

        except Exception as e:
            console.print(f"[bold red]API Error:[/bold red] {e}")
            return

    # Always render the terminal table
    display_results(report, path.name)

    # Save to file if --output was provided
    if output_path:
        save_report(report, path.name, output_path)

def display_results(report: AuditReport, filename: str):
    console.print(Panel(report.summary, title=f"[bold green]Audit Summary: {filename}[/bold green]"))

    if not report.issues:
        console.print("[bold green]✓ No issues found! Clean code.[/bold green]")
        return

    table = Table(show_header=True, header_style="bold magenta", expand=True)
    table.add_column("Severity", width=12)
    table.add_column("Category", width=15)
    table.add_column("Line", width=8)
    table.add_column("Description", style="dim")
    table.add_column("Recommended Fix")

    severity_colors = {
        "Critical": "bold red",
        "Warning": "bold yellow",
        "Info": "bold cyan"
    }

    for issue in report.issues:
        color = severity_colors.get(issue.severity, "white")
        table.add_row(
            f"[{color}]{issue.severity}[/{color}]",
            issue.category,
            issue.line_number,
            issue.description,
            issue.fix_suggestion
        )

    console.print(table)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CLI Code Reviewer and Security Auditor")
    parser.add_argument("--file", "-f", required=True, help="Path to the code file you want to audit")
    parser.add_argument("--output", "-o", required=False, help="Save report to file (.md or .json)")
    args = parser.parse_args()

    run_audit(args.file, args.output)