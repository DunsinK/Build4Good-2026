"""
Pickleball AI Referee — Frame-by-frame ML inference engine.

Maintains state across frames for ball tracking, court detection,
bounce detection, and in/out line-call decisions.
"""

from __future__ import annotations

import time
import random
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class BallPosition:
    x: int
    y: int
    timestamp: float


@dataclass
class BounceEvent:
    position: BallPosition
    call: str  # "IN" | "OUT"
    confidence: float
    frame_index: int


class PickleballRefereeEngine:
    """Real-time pickleball referee that processes video frames one at a time.

    Usage:
        engine = PickleballRefereeEngine()
        result = engine.process_frame(cv2_bgr_frame)
    """

    MAX_HISTORY = 120  # ~4 seconds at 30 fps

    def __init__(self) -> None:
        self.frame_index: int = 0
        self.ball_history: list[BallPosition] = []
        self.court_lines: Optional[np.ndarray] = None
        self.last_bounce: Optional[BounceEvent] = None
        self.last_call: Optional[str] = None
        self._court_detected: bool = False

        logger.info("PickleballRefereeEngine initialised")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> dict:
        """Run full inference pipeline on a single BGR frame.

        Returns a result dict suitable for sending over WebSocket:
            {
                "type":           "tracking" | "decision",
                "ball_position":  {"x": int, "y": int} | None,
                "bounce_detected": bool,
                "call":           "IN" | "OUT" | None,
                "confidence":     float,
                "frame_index":    int,
            }
        """
        self.frame_index += 1

        if not self._court_detected:
            self._detect_court_lines(frame)

        ball_pos = self._detect_ball(frame)

        if ball_pos is not None:
            self.ball_history.append(ball_pos)
            if len(self.ball_history) > self.MAX_HISTORY:
                self.ball_history = self.ball_history[-self.MAX_HISTORY:]

        bounce, confidence = self._detect_bounce()

        call: Optional[str] = None
        result_type = "tracking"

        if bounce:
            call = self._decide_in_out(ball_pos)
            self.last_call = call
            self.last_bounce = BounceEvent(
                position=ball_pos,
                call=call,
                confidence=confidence,
                frame_index=self.frame_index,
            )
            result_type = "decision"

        return {
            "type": result_type,
            "ball_position": {"x": ball_pos.x, "y": ball_pos.y} if ball_pos else None,
            "bounce_detected": bounce,
            "call": call,
            "confidence": round(confidence, 4),
            "frame_index": self.frame_index,
        }

    # ------------------------------------------------------------------
    # Internal pipeline stages — replace with real ML models
    # ------------------------------------------------------------------

    def _detect_court_lines(self, frame: np.ndarray) -> None:
        """Detect court boundary lines using the frame.

        TODO: Replace with real court detection
          - Use Hough line transform or a segmentation model
          - Identify baseline, sidelines, kitchen (NVZ) line
          - Store as polygon for point-in-polygon tests
        """
        h, w = frame.shape[:2]
        margin_x, margin_y = int(w * 0.1), int(h * 0.15)
        self.court_lines = np.array([
            [margin_x, margin_y],
            [w - margin_x, margin_y],
            [w - margin_x, h - margin_y],
            [margin_x, h - margin_y],
        ], dtype=np.int32)
        self._court_detected = True
        logger.info("Court lines detected (placeholder)")

    def _detect_ball(self, frame: np.ndarray) -> Optional[BallPosition]:
        """Locate the pickleball in the current frame.

        TODO: Replace with real ball detection
          - Run YOLOv8/v9 object detection tuned for pickleballs
          - Filter by confidence threshold
          - Apply NMS and pick highest-confidence detection
        """
        h, w = frame.shape[:2]
        if random.random() < 0.85:
            cx = int(w * 0.3 + random.gauss(0, w * 0.05))
            cy = int(h * 0.4 + random.gauss(0, h * 0.03))
            cx = max(0, min(w - 1, cx))
            cy = max(0, min(h - 1, cy))
            return BallPosition(x=cx, y=cy, timestamp=time.time())
        return None

    def _detect_bounce(self) -> tuple[bool, float]:
        """Analyse recent ball trajectory to detect a bounce event.

        TODO: Replace with real bounce detection
          - Compute vertical velocity from ball_history
          - Detect sign change in dy (downward -> upward)
          - Require minimum trajectory length to avoid false positives
          - Return calibrated confidence score

        Returns (bounce_detected, confidence).
        """
        if len(self.ball_history) < 5:
            return False, 0.0

        recent = self.ball_history[-5:]
        dy_values = [recent[i + 1].y - recent[i].y for i in range(len(recent) - 1)]

        if len(dy_values) >= 2 and dy_values[-2] > 0 and dy_values[-1] < 0:
            return True, round(random.uniform(0.75, 0.98), 4)

        return False, 0.0

    def _decide_in_out(self, ball_pos: Optional[BallPosition]) -> Optional[str]:
        """Determine whether the bounce landed in or out of bounds.

        TODO: Replace with real in/out logic
          - Use cv2.pointPolygonTest against detected court polygon
          - Account for ball radius and camera perspective
          - Apply homography correction for angled cameras
        """
        if ball_pos is None or self.court_lines is None:
            return None

        import cv2
        result = cv2.pointPolygonTest(
            self.court_lines.astype(np.float32),
            (float(ball_pos.x), float(ball_pos.y)),
            measureDist=False,
        )
        return "IN" if result >= 0 else "OUT"
