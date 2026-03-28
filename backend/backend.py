"""
Pickleball AI Referee — Real-time FastAPI backend.

Accepts live video frames over a WebSocket, runs each through
the PickleballRefereeEngine, and streams results back as JSON.
"""

from __future__ import annotations

import sys
import os
import json
import base64
import logging
from contextlib import asynccontextmanager

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.yolo import PickleballRefereeEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Application lifespan
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Pickleball Referee API starting up")
    yield
    logger.info("Pickleball Referee API shutting down")


app = FastAPI(
    title="Pickleball AI Referee",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# REST routes
# ------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ------------------------------------------------------------------
# WebSocket — real-time frame streaming
# ------------------------------------------------------------------

def decode_frame(data: bytes | str) -> np.ndarray:
    """Decode an incoming WebSocket message into a BGR OpenCV image.

    Supports two formats:
      - Raw binary (JPEG / PNG bytes)
      - Base64-encoded string (with or without data-URI prefix)
    """
    if isinstance(data, str):
        if data.startswith("data:image"):
            data = data.split(",", 1)[1]
        raw = base64.b64decode(data)
    else:
        raw = data

    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Failed to decode image frame")
    return frame


@app.websocket("/ws/referee")
async def referee_ws(ws: WebSocket):
    await ws.accept()
    client = ws.client
    logger.info("Client connected: %s", client)

    engine = PickleballRefereeEngine()

    try:
        while True:
            data = await ws.receive_bytes()

            try:
                frame = decode_frame(data)
            except ValueError as exc:
                await ws.send_json({"error": str(exc)})
                continue

            result = engine.process_frame(frame)
            await ws.send_json(result)

    except WebSocketDisconnect:
        logger.info("Client disconnected: %s", client)
    except Exception:
        logger.exception("Unexpected error on WebSocket for %s", client)
        try:
            await ws.close(code=1011, reason="Internal server error")
        except RuntimeError:
            pass


# ------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "backend:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
