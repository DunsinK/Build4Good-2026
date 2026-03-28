"""
Pickleball AI Referee — Frame-by-frame ML inference engine.

Stateful pipeline that processes one BGR frame at a time and maintains
session state (ball trajectory, court geometry, rally status) across
frames. Returns structured dicts consumed by the backend orchestrator.

Responsibilities split:
  - YOLO  → ball detection, position, confidence
  - OpenCV → preprocessing, court lines, trajectory tracking,
             bounce detection, in/out classification, event generation
"""

from __future__ import annotations

import time
import random
import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Data classes
# ------------------------------------------------------------------

@dataclass
class BallPosition:
    x: int
    y: int
    confidence: float
    timestamp: float


@dataclass
class BounceEvent:
    position: BallPosition
    call: str           # "IN" | "OUT"
    confidence: float
    frame_index: int


# ------------------------------------------------------------------
# Engine
# ------------------------------------------------------------------

class PickleballRefereeEngine:
    """Real-time pickleball referee that processes video one frame at a time.

    One instance is created per WebSocket session and kept alive for the
    duration of the connection so state accumulates across frames.

    Usage::

        engine = PickleballRefereeEngine()
        result = engine.process_frame(cv2_bgr_frame)
    """

    MAX_HISTORY = 120       # ~4 s at 30 fps
    BOUNCE_COOLDOWN = 15    # min frames between two bounce detections

    def __init__(self) -> None:
        self.frame_index: int = 0
        self.ball_history: list[BallPosition] = []
        self.court_polygon: Optional[np.ndarray] = None
        self.court_detected: bool = False
        self.last_bounce: Optional[BounceEvent] = None
        self.last_call: Optional[str] = None
        self.rally_active: bool = True
        self.last_hitter_side: Optional[str] = None  # "left" | "right"
        self._frames_since_bounce: int = 999

        logger.info("PickleballRefereeEngine initialised")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> dict:
        """Run the full inference pipeline on a single BGR frame.

        Returns a structured dict matching the project's response contract::

            {
                "type":            "tracking" | "decision",
                "frame_index":     int,
                "ball_detected":   bool,
                "ball_position":   {"x": int, "y": int} | None,
                "court_detected":  bool,
                "bounce_detected": bool,
                "call":            "IN" | "OUT" | None,
                "event":           {...} | None,
                "confidence":      float,
                "message":         str | None,
            }
        """
        self.frame_index += 1
        self._frames_since_bounce += 1

        preprocessed = self._preprocess(frame)

        if not self.court_detected:
            self._detect_court_lines(preprocessed)

        ball_pos = self._detect_ball(preprocessed)
        ball_detected = ball_pos is not None

        if ball_pos is not None:
            self._update_ball_history(ball_pos)
            self.last_hitter_side = self._estimate_hitter_side(ball_pos, frame)

        bounce_detected = False
        bounce_confidence = 0.0
        call: Optional[str] = None
        event: Optional[dict] = None
        result_type = "tracking"

        if self.rally_active and self._frames_since_bounce > self.BOUNCE_COOLDOWN:
            bounce_detected, bounce_confidence = self._detect_bounce()

        if bounce_detected and ball_pos is not None:
            call = self._decide_in_out(ball_pos)
            self.last_call = call
            self.last_bounce = BounceEvent(
                position=ball_pos,
                call=call,
                confidence=bounce_confidence,
                frame_index=self.frame_index,
            )
            self._frames_since_bounce = 0

            event = self._evaluate_rally_event(call)
            if event is not None:
                result_type = "decision"
                self.rally_active = False

        return {
            "type": result_type,
            "frame_index": self.frame_index,
            "ball_detected": ball_detected,
            "ball_position": {"x": ball_pos.x, "y": ball_pos.y} if ball_pos else None,
            "court_detected": self.court_detected,
            "bounce_detected": bounce_detected,
            "call": call,
            "event": event,
            "confidence": round(bounce_confidence, 4),
            "message": self._build_message(ball_detected, bounce_detected, call, event),
        }

    def reset_rally(self) -> None:
        """Called by the backend after a point is awarded to prepare for
        the next rally."""
        self.rally_active = True
        self.last_call = None
        self.last_hitter_side = None
        self.ball_history.clear()
        self._frames_since_bounce = 999

    # ------------------------------------------------------------------
    # Preprocessing (OpenCV)
    # ------------------------------------------------------------------

    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        """Normalise the frame before detection.

        TODO: Add real preprocessing
          - White-balance correction for outdoor/indoor lighting
          - Contrast-limited adaptive histogram equalisation (CLAHE)
          - Resize to model input dimensions
        """
        return frame

    # ------------------------------------------------------------------
    # Court detection (OpenCV)
    # ------------------------------------------------------------------

    def _detect_court_lines(self, frame: np.ndarray) -> None:
        """Identify court boundary polygon from the frame.

        TODO: Replace with real court detection
          - Convert to HSV / edge map
          - Hough line transform or segmentation model
          - Identify baseline, sidelines, kitchen (NVZ) line
          - Fit polygon for point-in-polygon tests
          - Compute homography matrix for perspective correction
        """
        h, w = frame.shape[:2]
        mx, my = int(w * 0.1), int(h * 0.15)
        self.court_polygon = np.array([
            [mx, my], [w - mx, my],
            [w - mx, h - my], [mx, h - my],
        ], dtype=np.int32)
        self.court_detected = True
        logger.info("Court lines detected (placeholder polygon)")

    # ------------------------------------------------------------------
    # Ball detection (YOLO)
    # ------------------------------------------------------------------

    def _detect_ball(self, frame: np.ndarray) -> Optional[BallPosition]:
        """Locate the pickleball in the current frame.

        TODO: Replace with real YOLO inference
          - Load YOLOv8/v11 model fine-tuned on pickleball data
          - Run inference, filter detections by class + confidence
          - Apply NMS and return highest-confidence detection
          - Fall back to colour-blob tracker when YOLO misses
        """
        h, w = frame.shape[:2]
        if random.random() < 0.85:
            cx = int(w * 0.3 + random.gauss(0, w * 0.05))
            cy = int(h * 0.4 + random.gauss(0, h * 0.03))
            cx = max(0, min(w - 1, cx))
            cy = max(0, min(h - 1, cy))
            conf = round(random.uniform(0.70, 0.99), 4)
            return BallPosition(x=cx, y=cy, confidence=conf, timestamp=time.time())
        return None

    # ------------------------------------------------------------------
    # Trajectory tracking (OpenCV)
    # ------------------------------------------------------------------

    def _update_ball_history(self, pos: BallPosition) -> None:
        self.ball_history.append(pos)
        if len(self.ball_history) > self.MAX_HISTORY:
            self.ball_history = self.ball_history[-self.MAX_HISTORY:]

    def _estimate_hitter_side(
        self, ball_pos: BallPosition, frame: np.ndarray
    ) -> Optional[str]:
        """Rough estimate of which side last hit the ball based on x-position.

        TODO: Replace with real hitter estimation
          - Use player pose estimation or bounding boxes
          - Track which player swung most recently
        """
        w = frame.shape[1]
        return "left" if ball_pos.x < w / 2 else "right"

    # ------------------------------------------------------------------
    # Bounce detection (OpenCV / trajectory analysis)
    # ------------------------------------------------------------------

    def _detect_bounce(self) -> tuple[bool, float]:
        """Detect a bounce event by analysing vertical velocity changes.

        TODO: Replace with real bounce detection
          - Compute vertical velocity (dy/dt) from ball_history
          - Detect sign change in dy (downward → upward)
          - Require minimum trajectory arc height
          - Use acceleration thresholds to reduce false positives
          - Return calibrated confidence

        Returns (bounce_detected, confidence).
        """
        if len(self.ball_history) < 6:
            return False, 0.0

        recent = self.ball_history[-6:]
        dy = [recent[i + 1].y - recent[i].y for i in range(len(recent) - 1)]

        if len(dy) >= 3 and dy[-3] > 0 and dy[-2] > 0 and dy[-1] < 0:
            conf = round(random.uniform(0.75, 0.98), 4)
            return True, conf

        return False, 0.0

    # ------------------------------------------------------------------
    # In / Out classification (OpenCV)
    # ------------------------------------------------------------------

    def _decide_in_out(self, ball_pos: BallPosition) -> Optional[str]:
        """Check whether the bounce position falls inside the court polygon.

        TODO: Improve in/out logic
          - Account for ball radius (~37 mm)
          - Apply homography for perspective correction
          - Use distance-from-line for marginal calls
        """
        if self.court_polygon is None:
            return None

        dist = cv2.pointPolygonTest(
            self.court_polygon.astype(np.float32),
            (float(ball_pos.x), float(ball_pos.y)),
            measureDist=False,
        )
        return "IN" if dist >= 0 else "OUT"

    # ------------------------------------------------------------------
    # Rally event evaluation
    # ------------------------------------------------------------------

    def _evaluate_rally_event(self, call: Optional[str]) -> Optional[dict]:
        """Decide whether the current bounce ends the rally.

        TODO: Expand event detection
          - Detect second-bounce (ball bounces twice on same side)
          - Detect faults (serve into net, foot fault, kitchen violation)
          - Use ball trajectory + player positions for net detection
        """
        if call == "OUT":
            hitter = self.last_hitter_side
            winner = "right" if hitter == "left" else "left"
            return {
                "event_type": "rally_end",
                "reason": "ball_out",
                "point_candidate": winner,
            }

        # TODO: detect second_bounce, fault, etc.
        return None

    # ------------------------------------------------------------------
    # Human-readable message
    # ------------------------------------------------------------------

    @staticmethod
    def _build_message(
        ball_detected: bool,
        bounce_detected: bool,
        call: Optional[str],
        event: Optional[dict],
    ) -> Optional[str]:
        if event:
            reason = event.get("reason", "unknown")
            winner = event.get("point_candidate", "unknown")
            return f"Rally ended ({reason}) — point candidate: {winner}"
        if bounce_detected and call:
            return f"Bounce detected — {call}"
        if not ball_detected:
            return "Ball not detected"
        return None
