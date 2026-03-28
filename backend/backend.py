"""
Pickleball AI Referee — Real-time FastAPI backend.

Orchestration layer that:
  1. Accepts live camera frames over WebSocket from the mobile app
  2. Decodes each frame into an OpenCV BGR image
  3. Passes the frame through a per-session PickleballRefereeEngine
  4. When a rally-ending event is detected, calls score.determine_point_winner()
  5. Sends a normalised JSON response back to the frontend after every frame

All ML logic lives in ml/yolo.py.
All scoring logic lives in backend/score.py.
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
from backend.score import determine_point_winner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Application
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Pickleball Referee API starting up")
    yield
    logger.info("Pickleball Referee API shutting down")


app = FastAPI(
    title="Pickleball AI Referee",
    version="0.2.0",
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
# REST
# ------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ------------------------------------------------------------------
# Frame decoding
# ------------------------------------------------------------------

def decode_frame(data: bytes | str) -> np.ndarray:
    """Decode an incoming WebSocket message into a BGR OpenCV image.

    Accepts:
      - Raw binary bytes (JPEG / PNG)
      - Base64-encoded string (with or without data-URI prefix)
      - JSON text with a ``"frame"`` key containing base64 data
    """
    if isinstance(data, str):
        try:
            payload = json.loads(data)
            if isinstance(payload, dict) and "frame" in payload:
                data = payload["frame"]
        except (json.JSONDecodeError, TypeError):
            pass

        if isinstance(data, str):
            if data.startswith("data:image"):
                data = data.split(",", 1)[1]
            raw = base64.b64decode(data)
        else:
            raw = data
    else:
        raw = data

    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Failed to decode image frame")
    return frame


# ------------------------------------------------------------------
# Response builder
# ------------------------------------------------------------------

def build_response(
    engine_result: dict,
    score_result: dict | None = None,
) -> dict:
    """Merge engine output and optional scoring into the normalised
    response contract sent to the frontend."""
    point_awarded_to = None
    audio_text = None

    if score_result:
        point_awarded_to = score_result.get("point_awarded_to")
        audio_text = score_result.get("audio_text")

    return {
        "type": engine_result.get("type", "tracking"),
        "frame_index": engine_result.get("frame_index"),
        "ball_detected": engine_result.get("ball_detected", False),
        "ball_position": engine_result.get("ball_position"),
        "court_detected": engine_result.get("court_detected", False),
        "bounce_detected": engine_result.get("bounce_detected", False),
        "call": engine_result.get("call"),
        "point_awarded_to": point_awarded_to,
        "audio_text": audio_text,
        "confidence": engine_result.get("confidence", 0.0),
        "message": engine_result.get("message"),
    }


def build_error(message: str, frame_index: int | None = None) -> dict:
    return {
        "type": "error",
        "frame_index": frame_index,
        "ball_detected": False,
        "ball_position": None,
        "court_detected": False,
        "bounce_detected": False,
        "call": None,
        "point_awarded_to": None,
        "audio_text": None,
        "confidence": 0.0,
        "message": message,
    }


def build_connected() -> dict:
    return {
        "type": "connected",
        "frame_index": None,
        "ball_detected": False,
        "ball_position": None,
        "court_detected": False,
        "bounce_detected": False,
        "call": None,
        "point_awarded_to": None,
        "audio_text": None,
        "confidence": 0.0,
        "message": "Engine ready — start streaming frames",
    }


# ------------------------------------------------------------------
# WebSocket — real-time frame streaming
# ------------------------------------------------------------------

@app.websocket("/ws/referee")
async def referee_ws(ws: WebSocket):
    await ws.accept()
    client = ws.client
    logger.info("Client connected: %s", client)

    engine = PickleballRefereeEngine()
    await ws.send_json(build_connected())

    try:
        while True:
            # Accept both binary and text messages
            msg = await ws.receive()
            data = msg.get("bytes") or msg.get("text")
            if data is None:
                continue

            try:
                frame = decode_frame(data)
            except (ValueError, Exception) as exc:
                await ws.send_json(build_error(str(exc), engine.frame_index))
                continue

            engine_result = engine.process_frame(frame)

            score_result = None
            event = engine_result.get("event")
            if event and event.get("event_type") == "rally_end":
                score_result = determine_point_winner(event)
                engine.reset_rally()

            response = build_response(engine_result, score_result)
            await ws.send_json(response)

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
