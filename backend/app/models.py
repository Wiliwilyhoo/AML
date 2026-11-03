from typing import Literal
from pydantic import BaseModel, Field, model_validator

Status = Literal['New', 'Under Review', 'Escalated', 'Dismissed', 'Closed']
TRANSITIONS = {
    'New': {'Under Review', 'Dismissed'},
    'Under Review': {'Escalated', 'Dismissed', 'Closed'},
    'Escalated': {'Under Review', 'Closed'},
    'Dismissed': set(), 'Closed': set(),
}


class RuleConfig(BaseModel):
    high_value: float = Field(10000, gt=0, le=1e12)
    velocity_count: int = Field(6, ge=2, le=1000)
    window_minutes: int = Field(60, ge=1, le=10080)
    structuring_threshold: float = Field(10000, gt=0, le=1e12)
    structuring_floor: float = Field(0.8, gt=0, lt=1)
    structuring_count: int = Field(3, ge=2, le=1000)
    fan_in_count: int = Field(4, ge=2, le=1000)
    fan_out_count: int = Field(4, ge=2, le=1000)
    rapid_minutes: int = Field(10, ge=1, le=1440)
    enabled: list[str] = Field(default_factory=lambda: ['HV', 'VEL', 'STR', 'FIN', 'FOUT', 'RAP'])

    @model_validator(mode='after')
    def valid_rules(self):
        if set(self.enabled) - {'HV', 'VEL', 'STR', 'FIN', 'FOUT', 'RAP'}:
            raise ValueError('Unknown rule ID')
        return self


class Review(BaseModel):
    status: Status
    reviewer: str = Field(min_length=1, max_length=100)
    note: str = Field('', max_length=4000)


class Note(BaseModel):
    reviewer: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=4000)


class ReplayCommand(BaseModel):
    action: Literal['start', 'pause', 'resume', 'reset', 'speed']
    speed: float = Field(60, ge=1, le=3600)


class EvidenceRequest(BaseModel):
    reviewer: str = Field(min_length=1, max_length=100)


class Receipt(BaseModel):
    evidence_hash: str = Field(pattern=r'^0x[0-9a-fA-F]{64}$')
    transaction_hash: str = Field(pattern=r'^0x[0-9a-fA-F]{64}$')
    block_number: int = Field(ge=0)
    gas_used: str = Field(pattern=r'^\d+$')
    confirmation_seconds: float = Field(ge=0)
    action: Literal['register', 'review']


class Page(BaseModel):
    items: list[dict]
    total: int
    page: int
    page_size: int
