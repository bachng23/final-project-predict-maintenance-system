from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from shared.schemas import AgentTranscriptEntry, SnapshotPayload


class BaseAgent(ABC):
    name: str

    @abstractmethod
    def propose(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        """Propose an action and reasoning for this round."""

    @abstractmethod
    def critique(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        other_proposals: list[AgentTranscriptEntry],
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        """Critique other proposals and optionally revise the action."""

    @abstractmethod
    def vote(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        all_critiques: list[AgentTranscriptEntry],
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        """Cast the final vote after critiques."""
