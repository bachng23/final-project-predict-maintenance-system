from prometheus_client import Counter, Gauge, Histogram

anomaly_triggers_total = Counter(
    "pdm_anomaly_triggers_total",
    "Total anomaly triggers by bearing",
    ["bearing_id"],
)

decisions_total = Counter(
    "pdm_decisions_total",
    "Negotiation outcomes by action and routing",
    ["action", "routing"],
)

safety_veto_total = Counter(
    "pdm_safety_veto_total",
    "Total safety veto triggers",
)

negotiation_rounds = Histogram(
    "pdm_negotiation_rounds",
    "Number of rounds per negotiation",
    buckets=[1, 2, 3],
)

negotiation_duration_seconds = Histogram(
    "pdm_negotiation_duration_seconds",
    "End-to-end negotiation latency",
    buckets=[1, 5, 10, 30, 60],
)

agent_llm_latency_seconds = Histogram(
    "pdm_agent_llm_latency_seconds",
    "LLM call latency per agent",
    ["agent_name", "method"],
    buckets=[1, 3, 5, 10, 30],
)

override_rate = Gauge(
    "pdm_hitl_override_rate",
    "Ratio of operator overrides to total decisions (last 1h)",
)
