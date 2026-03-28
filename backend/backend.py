"""
Pickleball AI Referee — Real-time FastAPI backend.

Accepts live video frames over a WebSocket, runs each through
the PickleballRefereeEngine, and streams results back as JSON.
Also exposes REST endpoints for game/score management.
"""

from __future__ import annotations

import sys
import os
import base64
import logging
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.yolo import PickleballRefereeEngine
from backend.score import PickleballScoreEngine, GameMode, RallyResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Application lifespan
# ------------------------------------------------------------------

game_engine: Optional[PickleballScoreEngine] = None


def get_game() -> PickleballScoreEngine:
    if game_engine is None:
        raise HTTPException(status_code=400, detail="No active game. POST /game/start first.")
    return game_engine


# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------

class StartGameRequest(BaseModel):
    mode: str = "singles"  # "singles" | "doubles"

class RallyRequest(BaseModel):
    winner: str  # "server" | "receiver"

class CorrectScoreRequest(BaseModel):
    side_0: int
    side_1: int


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


@app.post("/game/start")
async def game_start(req: StartGameRequest):
    global game_engine
    try:
        mode = GameMode(req.mode)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid mode: {req.mode}. Use 'singles' or 'doubles'.")
    game_engine = PickleballScoreEngine(mode=mode)
    return game_engine.get_state()


@app.get("/game/state")
async def game_state():
    return get_game().get_state()


@app.post("/game/rally")
async def game_rally(req: RallyRequest):
    try:
        winner = RallyResult(req.winner)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid winner: {req.winner}. Use 'server' or 'receiver'.")
    return get_game().record_rally(winner)


@app.post("/game/score/correct")
async def game_score_correct(req: CorrectScoreRequest):
    if req.side_0 < 0 or req.side_1 < 0:
        raise HTTPException(status_code=422, detail="Scores cannot be negative.")
    return get_game().correct_score(req.side_0, req.side_1)


@app.post("/game/switch-server")
async def game_switch_server():
    return get_game().switch_server()


@app.get("/game/calls")
async def game_calls(last_n: Optional[int] = None):
    return get_game().get_calls(last_n=last_n)


@app.post("/game/reset")
async def game_reset(req: StartGameRequest):
    try:
        mode = GameMode(req.mode)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid mode: {req.mode}. Use 'singles' or 'doubles'.")
    return get_game().reset(mode=mode)


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

    vision_engine = PickleballRefereeEngine()

    try:
        while True:
            data = await ws.receive_bytes()

            try:
                frame = decode_frame(data)
            except ValueError as exc:
                await ws.send_json({"error": str(exc)})
                continue

            result = vision_engine.process_frame(frame)

            if result["type"] == "decision" and result["call"] and game_engine:
                game_engine.record_call(
                    call=result["call"],
                    confidence=result["confidence"],
                    frame_index=result["frame_index"],
                )
                result["game"] = game_engine.get_state()

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
