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

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)

if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from ml.yolo import PickleballRefereeEngine
from score import determine_point_winner

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
    version="0.3.0",
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
# Normalised response helpers
# ------------------------------------------------------------------

_EMPTY_RESPONSE: dict = {
    "type": "tracking",
    "frame_index": None,
    "ball_detected": False,
    "ball_position": None,
    "court_detected": False,
    "bounce_detected": False,
    "call": None,
    "point_awarded_to": None,
    "audio_text": None,
    "confidence": 0.0,
    "message": None,
}


def _normalise(**overrides) -> dict:
    """Return a response dict that always conforms to the shared contract."""
    return {**_EMPTY_RESPONSE, **overrides}


def build_connected() -> dict:
    return _normalise(type="connected", message="WebSocket connected")


def build_error(message: str, frame_index: int | None = None) -> dict:
    return _normalise(type="error", frame_index=frame_index, message=message)


def build_response(engine_result: dict, score_result: dict | None = None) -> dict:
    """Merge engine output and optional scoring into the normalised contract."""
    resp = _normalise(
        type=engine_result.get("type", "tracking"),
        frame_index=engine_result.get("frame_index"),
        ball_detected=engine_result.get("ball_detected", False),
        ball_position=engine_result.get("ball_position"),
        court_detected=engine_result.get("court_detected", False),
        bounce_detected=engine_result.get("bounce_detected", False),
        call=engine_result.get("call"),
        confidence=engine_result.get("confidence", 0.0),
        message=engine_result.get("message"),
    )
    if score_result:
        resp["point_awarded_to"] = score_result.get("point_awarded_to")
        resp["audio_text"] = score_result.get("audio_text")
    return resp


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
# WebSocket — real-time frame streaming
# ------------------------------------------------------------------

@app.websocket("/ws/referee")
async def referee_ws(ws: WebSocket):
    await ws.accept()
    client_id = f"{ws.client.host}:{ws.client.port}" if ws.client else "unknown"
    logger.info("WS connect  | client=%s", client_id)

    engine = PickleballRefereeEngine()
    await ws.send_json(build_connected())
    logger.info("WS ready    | client=%s | engine created", client_id)

    try:
        while True:
            msg = await ws.receive()

            # Extract payload — prefer bytes, fall back to text
            data: bytes | str | None = msg.get("bytes")
            if data is None:
                data = msg.get("text")
            if data is None:
                continue

            # --- Decode frame ---
            try:
                frame = decode_frame(data)
            except Exception as exc:
                logger.warning("WS decode error | client=%s | %s", client_id, exc)
                await ws.send_json(build_error(str(exc), engine.frame_index))
                continue

            # --- Run inference ---
            try:
                engine_result = engine.process_frame(frame)
            except Exception as exc:
                logger.exception("WS inference error | client=%s", client_id)
                await ws.send_json(build_error(
                    f"Inference failed: {exc}", engine.frame_index
                ))
                continue

            # --- Score if rally ended ---
            score_result = None
            event = engine_result.get("event")
            if event and event.get("event_type") == "rally_end":
                score_result = determine_point_winner(event)
                engine.reset_rally()
                logger.info(
                    "WS decision | client=%s | frame=%d | reason=%s | point=%s",
                    client_id,
                    engine_result.get("frame_index", -1),
                    event.get("reason"),
                    score_result.get("point_awarded_to") if score_result else None,
                )

            # --- Send normalised response ---
            await ws.send_json(build_response(engine_result, score_result))

    except WebSocketDisconnect:
        logger.info("WS disconnect | client=%s | frames_processed=%d", client_id, engine.frame_index)
    except Exception:
        logger.exception("WS fatal error | client=%s", client_id)
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
