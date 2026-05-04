from fastapi import FastAPI, Request


app = FastAPI(title="Predictive Maintenance AI Service")


@app.get("/ai/health")
def healthcheck() -> dict[str, str]:
    return {"status": "OK", "message": "AI backend is running"}


@app.get("/ai/")
def root() -> dict[str, str]:
    return {"message": "Predictive Maintenance AI API"}


@app.api_route("/ai/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def ai_proxy_placeholder(path: str, request: Request) -> dict[str, str]:
    return {
        "status": "OK",
        "message": "FastAPI endpoint reached through Nginx",
        "path": path,
        "method": request.method,
    }
