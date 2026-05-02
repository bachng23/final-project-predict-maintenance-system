from fastapi import FastAPI


app = FastAPI(title="Predictive Maintenance AI Service")


@app.get("/ai/health")
def healthcheck() -> dict[str, str]:
    return {"status": "OK", "message": "AI service is running"}


@app.get("/ai/")
def root() -> dict[str, str]:
    return {"message": "Predictive Maintenance AI API"}
