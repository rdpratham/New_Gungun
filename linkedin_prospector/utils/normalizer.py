"""
Unified data schema for contacts and companies across all sources.
"""

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Contact:
    full_name: str = ""
    first_name: str = ""
    last_name: str = ""
    designation: str = ""
    company: str = ""
    location: str = ""
    linkedin_url: str = ""
    email: str = ""
    phone: str = ""
    department: str = ""
    seniority: str = ""
    source: str = ""
    confidence: float = 0.0
    raw: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("raw", None)
        return d

    def merge(self, other: "Contact") -> "Contact":
        """Merge another contact's non-empty fields into this one."""
        for f_name, val in asdict(other).items():
            if f_name in ("raw", "source", "confidence"):
                continue
            if val and not getattr(self, f_name):
                setattr(self, f_name, val)
        if other.confidence > self.confidence:
            self.confidence = other.confidence
        if other.source and self.source and other.source not in self.source:
            self.source = f"{self.source}, {other.source}"
        return self


@dataclass
class Company:
    name: str = ""
    cin: str = ""           # India Corporate Identity Number
    registration_number: str = ""
    status: str = ""
    incorporation_date: str = ""
    registered_address: str = ""
    directors: list = field(default_factory=list)
    category: str = ""
    sub_category: str = ""
    paid_up_capital: str = ""
    authorised_capital: str = ""
    industry: str = ""
    website: str = ""
    source: str = ""
    raw: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("raw", None)
        return d
