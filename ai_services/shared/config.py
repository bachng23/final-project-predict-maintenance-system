from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # PostgreSQL
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str = "postgre_db"
    POSTGRES_PORT: int = 5432

    @property
    def postgre_dsn(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    # Redis
    REDIS_HOST: str = "redis_cache"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_TTL_SECONDS: int = 300  # Time-to-live for cached items in seconds

    @property
    def redis_url(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"
    
    # Redpanda
    REDPANDA_HOST: str = "redpanda"
    REDPANDA_PORT: int = 9092

    @property
    def redpanda_bootstrap_servers(self) -> str:
        return f"{self.REDPANDA_HOST}:{self.REDPANDA_PORT}"
    
    # MinIO
    MINIO_HOST: str = "minio"
    MINIO_PORT: int = 9000
    MINIO_USER: str
    MINIO_PASSWORD: str
    MINIO_SECURE: bool = False
    MINIO_BUCKET_RAW_SIGNALS: str = "raw-signals"
    MINIO_BUCKET_MLFLOW: str = "mlflow"
    MINIO_BUCKET_LANGFUSE: str = "langfuse"

    @property
    def minio_endpoint(self) -> str:
        return f"{self.MINIO_HOST}:{self.MINIO_PORT}"
    
    # MLflow
    MLFLOW_HOST: str = "mlflow"
    MLFLOW_PORT: int = 5000

    @property
    def mlflow_tracking_uri(self) -> str:
        return f"http://{self.MLFLOW_HOST}:{self.MLFLOW_PORT}"
    
    # Ollama
    OLLAMA_HOST: str = "ollama"
    OLLAMA_PORT: int = 11434
    OLLAMA_DEFAULT_MODEL: str = "llama3.2:3b"

    @property
    def ollama_url(self) -> str:
        return f"http://{self.OLLAMA_HOST}:{self.OLLAMA_PORT}"
    
    # Langfuse
    LANGFUSE_HOST: str = "http://langfuse:3000"
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""

    # Model/Inference
    MODEL_VERSION: str = "predictive-v1.0.0"
    MC_DROPOUT_PASSES: int = 50  # Number of forward passes for Monte Carlo Dropout

    # Data
    DATA_ROOT: str = "/data/xjtu-sy"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()