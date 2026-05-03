from fastapi import FastAPI, Request

app = FastAPI(title="AI Services")


@app.get("/ai/health")
async def healthcheck():
    return {"status": "OK", "message": "AI backend is running"}


@app.api_route("/ai/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def ai_proxy_placeholder(path: str, request: Request):
    return {
        "status": "OK",
        "message": "FastAPI endpoint reached through Nginx",
        "path": path,
        "method": request.method,
    }
