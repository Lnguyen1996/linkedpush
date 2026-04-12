from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import init_db
from routers import posts, auth, media, publish


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Postiz API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure data directories exist
os.makedirs("data/uploads", exist_ok=True)

# Include routers
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(media.router)
app.include_router(publish.router)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
