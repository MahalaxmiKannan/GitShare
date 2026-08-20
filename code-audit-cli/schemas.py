from pydantic import BaseModel, Field
from typing import List, Literal

class Issue(BaseModel):
    category: Literal["Security", "Bug", "Performance", "Code Quality"]
    severity: Literal["Critical", "Warning", "Info"]
    line_number: str = Field(description="Line number or range, e.g., '14' or '14-18'")
    description: str = Field(description="Clear explanation of the problem")
    fix_suggestion: str = Field(description="Suggested corrected code or remediation step")

class AuditReport(BaseModel):
    summary: str = Field(description="High-level overview of the code quality")
    issues: List[Issue]