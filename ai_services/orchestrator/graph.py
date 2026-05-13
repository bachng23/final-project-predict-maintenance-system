from __future__ import annotations

import operator
import random
from typing import Annotated, TypedDict

from orchestrator.agents.base import BaseAgent
from orchestrator.agents.manager_agent import ManagerAgent
from shared.schemas import AgentTranscriptEntry, NegotiationRecord, SnapshotPayload


class NegotiationState(TypedDict):
    snapshot: SnapshotPayload
    round_no: int
    proposals: list[AgentTranscriptEntry]
    critiques: list[AgentTranscriptEntry]
    votes: list[AgentTranscriptEntry]
    transcript: Annotated[list[AgentTranscriptEntry], operator.add]
    final_result: NegotiationRecord | None
    agents: list[BaseAgent]
    manager: ManagerAgent
    max_rounds: int
    confidence_threshold: float
    trace: object | None


def _agent_call(agent, method_name: str, *args, trace=None):
    method = getattr(agent, method_name)
    if trace is None:
        return method(*args)
    try:
        return method(*args, trace=trace)
    except TypeError:
        return method(*args)


def node_propose(state: NegotiationState) -> dict:
    agents = state["agents"].copy()
    random.shuffle(agents)
    proposals = [
        _agent_call(agent, "propose", state["snapshot"], state["round_no"], trace=state.get("trace"))
        for agent in agents
    ]
    return {"proposals": proposals, "transcript": proposals}


def node_critique(state: NegotiationState) -> dict:
    critiques = [
        _agent_call(
            agent,
            "critique",
            state["snapshot"],
            state["round_no"],
            [p for p in state["proposals"] if p.agent_name != agent.name],
            trace=state.get("trace"),
        )
        for agent in state["agents"]
    ]
    return {"critiques": critiques, "transcript": critiques}


def node_vote(state: NegotiationState) -> dict:
    votes = [
        _agent_call(
            agent,
            "vote",
            state["snapshot"],
            state["round_no"],
            state["critiques"],
            trace=state.get("trace"),
        )
        for agent in state["agents"]
    ]
    return {"votes": votes, "transcript": votes}


def node_aggregate(state: NegotiationState) -> dict:
    result = state["manager"].aggregate(
        snapshot=state["snapshot"],
        votes=state["votes"],
        transcript=state["transcript"],
        round_no=state["round_no"],
        trace=state.get("trace"),
    )
    if (result.recommended_confidence or 0.0) >= state["confidence_threshold"]:
        return {"final_result": result}
    if state["round_no"] >= state["max_rounds"]:
        return node_fallback(state)
    return {
        "round_no": state["round_no"] + 1,
        "proposals": [],
        "critiques": [],
        "votes": [],
        "final_result": None,
    }


def should_continue(state: NegotiationState) -> str:
    if state["final_result"] is not None:
        return "end"
    if state["round_no"] >= state["max_rounds"]:
        return "fallback"
    return "propose"


def node_fallback(state: NegotiationState) -> dict:
    result = NegotiationRecord(
        snapshot_id=state["snapshot"].snapshot_id,
        recommended_action="INSPECT",
        recommended_confidence=0.5,
        priority="MEDIUM",
        safety_veto=False,
        reasoning_summary="Max negotiation rounds reached without consensus. Defaulting to INSPECT.",
        rounds_taken=state["round_no"],
        transcript=state["transcript"],
    )
    return {"final_result": result}


class _SimpleNegotiationGraph:
    def __init__(
        self,
        agents: list[BaseAgent],
        manager: ManagerAgent,
        max_rounds: int,
        confidence_threshold: float,
    ):
        self._agents = agents
        self._manager = manager
        self._max_rounds = max_rounds
        self._confidence_threshold = confidence_threshold

    def invoke(self, input_state: dict) -> NegotiationState:
        state: NegotiationState = {
            "snapshot": input_state["snapshot"],
            "round_no": input_state.get("round_no", 1),
            "proposals": input_state.get("proposals", []),
            "critiques": input_state.get("critiques", []),
            "votes": input_state.get("votes", []),
            "transcript": input_state.get("transcript", []),
            "final_result": None,
            "agents": input_state.get("agents", self._agents),
            "manager": input_state.get("manager", self._manager),
            "max_rounds": input_state.get("max_rounds", self._max_rounds),
            "confidence_threshold": input_state.get("confidence_threshold", self._confidence_threshold),
            "trace": input_state.get("trace"),
        }

        while state["final_result"] is None:
            _merge_state(state, node_propose(state))
            _merge_state(state, node_critique(state))
            _merge_state(state, node_vote(state))
            _merge_state(state, node_aggregate(state))
            route = should_continue(state)
            if route == "fallback":
                _merge_state(state, node_fallback(state))
            elif route == "end":
                break
        return state


class _CompiledNegotiationGraph:
    def __init__(
        self,
        compiled_graph,
        agents: list[BaseAgent],
        manager: ManagerAgent,
        max_rounds: int,
        confidence_threshold: float,
    ):
        self._compiled_graph = compiled_graph
        self._agents = agents
        self._manager = manager
        self._max_rounds = max_rounds
        self._confidence_threshold = confidence_threshold

    def invoke(self, input_state: dict):
        return self._compiled_graph.invoke(
            {
                "round_no": 1,
                "proposals": [],
                "critiques": [],
                "votes": [],
                "transcript": [],
                "final_result": None,
                "agents": self._agents,
                "manager": self._manager,
                "max_rounds": self._max_rounds,
                "confidence_threshold": self._confidence_threshold,
                "trace": None,
                **input_state,
            }
        )


def _merge_state(state: NegotiationState, update: dict) -> None:
    for key, value in update.items():
        if key == "transcript":
            state["transcript"] = state.get("transcript", []) + value
        else:
            state[key] = value


def build_negotiation_graph(
    agents: list[BaseAgent],
    max_rounds: int = 2,
    confidence_threshold: float = 0.66,
):
    manager = ManagerAgent()
    try:
        from langgraph.graph import END, StateGraph
    except ImportError:
        return _SimpleNegotiationGraph(agents, manager, max_rounds, confidence_threshold)

    graph = StateGraph(NegotiationState)
    graph.add_node("propose", node_propose)
    graph.add_node("critique", node_critique)
    graph.add_node("vote", node_vote)
    graph.add_node("aggregate", node_aggregate)
    graph.add_node("fallback", node_fallback)
    graph.set_entry_point("propose")
    graph.add_edge("propose", "critique")
    graph.add_edge("critique", "vote")
    graph.add_edge("vote", "aggregate")
    graph.add_conditional_edges(
        "aggregate",
        should_continue,
        {"end": END, "fallback": "fallback", "propose": "propose"},
    )
    graph.add_edge("fallback", END)
    return _CompiledNegotiationGraph(
        graph.compile(),
        agents,
        manager,
        max_rounds,
        confidence_threshold,
    )
