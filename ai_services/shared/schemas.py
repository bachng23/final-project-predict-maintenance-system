from __future__ import annotations

import uuid
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime, timezone

# Enums
BearingStatus = Literal['NORMAL', 'INSPECT', 'NEGOTIATE', 'MAINTAIN', 'STOP', 'OFFLINE']
FaultType = Literal['INNER_RACE', 'OUTER_RACE', 'BALL', 'CAGE', 'UNKNOWN']
RecommendationAction = Literal['CONTINUE', 'INSPECT', 'MAINTAIN', 'STOP']
OperatorAction = Literal['APPROVE', 'OVERRIDE', 'REJECT', 'ACKNOWLEDGE']
DecisionStatus = Literal['PENDING', 'RESOLVED', 'ACKNOWLEDGED']
PriorityLevel = Literal['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
TriggerSource = Literal['ANOMALY_TRIGGER', 'SAFETY_VETO', 'MANUAL_REQUEST', 'SCHEDULED_CHECK']
AgentMessageType = Literal['PROPOSE', 'CRITIQUE', 'VOTE', 'SUMMARY']

#Contracts
class FeatureRecord(BaseModel):
    "The output of signal processor and the input of predictor"

    bearing_id: str = Field(..., description="Unique identifier for the bearing")
    file_idx: int = Field(..., description="Index of the file containing the features")
    sample_ts: datetime = Field(..., description="Timestamp of the sample")
    
    lifetime_pct: float = Field(..., description="Percentage of the bearing's lifetime")
    features: dict[str, float] = Field(..., description="Dictionary of feature names and their values")


class PredictionRecord(BaseModel):
    "The output of predictor service"

    # Identity
    bearing_id: str = Field(..., description="Unique identifier for the bearing")
    file_idx: int = Field(..., description="Index of the file containing the prediction")
    sample_ts: datetime = Field(..., description="Timestamp of the sample")
    
    # RUL
    rul_minutes: float = Field(..., description="Predicted remaining useful life in minutes")
    rul_lower_minutes: Optional[float] = Field(None, description="Lower bound of the predicted remaining useful life in minutes")
    rul_upper_minutes: Optional[float] = Field(None, description="Upper bound of the predicted remaining useful life in minutes")
    rul_uncertainty: Optional[float] = Field(None, description="Uncertainty of the predicted remaining useful life")

    # Core prediction
    p_fail: float = Field(..., description="Predicted probability of failure within a certain time frame")
    health_score: float = Field(..., ge=0, le=100, description="Health score of the bearing, typically between 0 and 100")
    
    # Extra model signals
    degradation_rate: Optional[float] = Field(None, description="Rate of degradation of the bearing")
    ood_flag: Optional[bool] = Field(None, description="Flag indicating if the sample is out-of-distribution")

    # Fault detection
    fault_type: Optional[FaultType] = Field(None, description="Type of fault detected, if any")
    fault_confidence: Optional[float] = Field(None, description="Confidence level of the detected fault type")

    # Anomaly scores
    stat_score: Optional[float] = Field(None, description="Statistical anomaly score")
    rul_drop_score: Optional[float] = Field(None, description="RUL drop anomaly score")
    hybrid_score: Optional[float] = Field(None, description="Hybrid anomaly score combining multiple factors")
    threshold_tau: Optional[float] = Field(None, description="Threshold for triggering maintenance actions based on anomaly scores")

    # Metadata
    model_version: str = Field(..., description="Version of the prediction model used")
    pipeline_run_id: Optional[str] = Field(None, description="Identifier for the pipeline run that generated this prediction")

    # Computed
    @property
    def uncertainty_label(self) -> Literal['low', 'medium', 'high']:
        if self.rul_uncertainty is None:
            return 'low'
        elif self.rul_uncertainty < 0.01:
            return 'low'
        elif self.rul_uncertainty < 0.05:
            return 'medium'
        return 'high'
    

class SnapshotPayload(BaseModel):
    "Context object sent to orchestrator when anomaly triggered"

    snapshot_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique identifier for the snapshot")
    bearing_id: str = Field(..., description="Unique identifier for the bearing")
    prediction_id: str = Field(..., description="Identifier for the prediction that triggered the snapshot")
    snapshot_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of the snapshot")
    trigger_source: TriggerSource = Field(..., description="Source that triggered the snapshot")
    
    signal_window_ref: Optional[str] = Field(None, description="Reference to the signal window that led to the anomaly trigger")
    feature_vector_ref: Optional[str] = Field(None, description="Reference to the feature vector that led to the anomaly trigger")

    prediction: PredictionRecord = Field(..., description="The prediction record associated with this snapshot")

    # Synthetic context
    operation_context: dict = Field(default_factory=dict, description="Additional context for operation agents, can include synthetic data or metadata")
    cost_context: dict = Field(default_factory=dict, description="Additional context for cost agents, can include synthetic data or metadata")
    safety_context: dict = Field(default_factory=dict, description="Additional context for safety agents, can include synthetic data or metadata")


class AgentTranscriptEntry(BaseModel):
    "A single message turn in the agent negotiation process"

    snapshot_id: str = Field(..., description="Identifier for the snapshot this message is associated with")
    
    round_no: int = Field(..., description="Round number of the negotiation")
    agent_name: str = Field(..., description="Name of the agent sending the message")
    message_type: AgentMessageType = Field(..., description="Type of the message, e.g. PROPOSE, CRITIQUE, VOTE, SUMMARY")
    action_candidate: Optional[RecommendationAction] = Field(None, description="Recommended action proposed by the agent, if applicable")
    
    confidence: Optional[float] = Field(None, description="Confidence level of the proposed action, if applicable")
    reasoning: str = Field(..., description="Detailed reasoning provided by the agent for its proposal or critique")
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when the message was created")

class NegotiationRecord(BaseModel):
    "Record of the entire negotiation process for a given snapshot"

    snapshot_id: str = Field(..., description="Identifier for the snapshot this negotiation is associated with")
    
    recommended_action: RecommendationAction = Field(..., description="Final recommended action after the negotiation process")
    recommended_confidence: Optional[float] = Field(None, description="Confidence level of the final recommended action")
    priority: PriorityLevel = Field(..., description="Priority level assigned to this case after negotiation")
    safety_veto: bool = Field(..., description="Indicates whether a safety veto was issued during the negotiation")

    reasoning_summary: str = Field(..., description="Summary of the reasoning from all agents involved in the negotiation")
    rounds_taken: int = Field(..., description="Total number of rounds taken in the negotiation process")
    transcript: list[AgentTranscriptEntry] = Field(default_factory=list, description="Complete transcript of all messages exchanged during the negotiation")


class DecisionActionRequest(BaseModel):
    "Request sent to operation agent to execute a decision action"

    operator_action: OperatorAction = Field(..., description="Action to be taken by the operator, e.g. APPROVE, OVERRIDE, REJECT, ACKNOWLEDGE")
    final_decision: Optional[RecommendationAction] = Field(None, description="Final recommended action after negotiation, if applicable")
    override_reason: Optional[str] = Field(None, description="Reason for overriding the recommended action, if applicable")
    client_version: Optional[str] = Field(None, description="Version of the client making the request, for compatibility purposes")


class DecisionActionRecord(BaseModel):
    "Record of the decision action taken by the operator"

    decison_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique identifier for the decision record")
    action: OperatorAction = Field(..., description="Action taken by the operator, e.g. APPROVE, OVERRIDE, REJECT, ACKNOWLEDGE")
    final_action: RecommendationAction = Field(..., description="Final recommended action after negotiation")
    override_reason: Optional[str] = Field(None, description="Reason for overriding the recommended action, if applicable")
    
    actor_user_id: str = Field(..., description="Identifier for the user who took the action")
    actor_role: str = Field(..., description="Role of the user who took the action, e.g. OPERATOR, ENGINEER, MANAGER")
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when the action was submitted")
    source: Literal["WEB_UI", "API", "SYSTEM"] = Field(default="WEB_UI", description="Source of the action, e.g. WEB_UI, API, SYSTEM")