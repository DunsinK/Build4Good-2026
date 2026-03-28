"""
Pickleball AI Referee — Frame-by-frame ML inference engine.

Stateful pipeline that processes one BGR frame at a time and maintains
session state (ball trajectory, court geometry, rally status) across
frames. Returns structured dicts consumed by the backend orchestrator.

Pipeline steps (see process_frame):
  1. Increment frame counter
  2. Preprocess frame              → _preprocess_frame
  3. Detect / update court state   → _detect_court
  4. Detect ball via color+contour → _detect_ball
  5. Append to trajectory history  → _update_ball_history
  6. Estimate bounce candidate     → _detect_bounce
  7. Determine provisional call    → _determine_call
  8. Generate rally-end event      → _evaluate_rally_event
  9. Return structured result      → _build_tracking_result / _build_decision_result

Ball detection uses HSV color filtering for the bright yellow/green
pickleball, followed by contour analysis and circular shape validation.

Court detection uses Canny edges + Hough line transforms to find
straight court lines, then clusters them into a boundary polygon.

Bounce detection uses vertical velocity sign-change analysis with
minimum arc height and acceleration thresholds.
"""

from __future__ import annotations

import time
import math
import logging
from dataclasses import dataclass
from typing import Optional
from collections import deque

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
# HSV ranges for pickleball detection
# Yellow-green pickleball under various lighting conditions
# ------------------------------------------------------------------

HSV_RANGES = [
    # Bright yellow (outdoor sun)
    (np.array([20, 100, 100]), np.array([35, 255, 255])),
    # Yellow-green (indoor)
    (np.array([25, 80, 80]), np.array([45, 255, 255])),
    # Neon / lime green (some balls)
    (np.array([35, 100, 100]), np.array([55, 255, 255])),
]

# Expected ball radius range in pixels (at typical phone distance)
MIN_BALL_RADIUS = 4
MAX_BALL_RADIUS = 40
MIN_CIRCULARITY = 0.55


# ------------------------------------------------------------------
# Engine
# ------------------------------------------------------------------

class PickleballRefereeEngine:
    """Real-time pickleball referee that processes video one frame at a time.

    One instance is created per WebSocket session and kept alive for the
    duration of the connection so state accumulates across frames.
    """

    MAX_HISTORY = 120
    BOUNCE_COOLDOWN = 12
    COURT_REDETECT_INTERVAL = 300  # re-check court every N frames

    def __init__(self) -> None:
        self.frame_index: int = 0
        self.ball_history: list[BallPosition] = []
        self.court_polygon: Optional[np.ndarray] = None
        self.court_detected: bool = False
        self.court_center_x: int = 0
        self.last_bounce: Optional[BounceEvent] = None
        self.last_call: Optional[str] = None
        self.rally_active: bool = True
        self.last_bounce_side: Optional[str] = None
        self.bounce_count_left: int = 0
        self.bounce_count_right: int = 0
        self._frames_since_bounce: int = 999

        # Kalman-like prediction state for ball tracking
        self._predicted_pos: Optional[tuple[int, int]] = None
        self._velocity: tuple[float, float] = (0.0, 0.0)

        # Court detection cache
        self._court_lines_raw: list = []
        self._frame_h: int = 0
        self._frame_w: int = 0

        logger.info("PickleballRefereeEngine initialised")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> dict:
        """Run the full inference pipeline on a single BGR frame."""
        self.frame_index += 1
        self._frames_since_bounce += 1

        preprocessed = self._preprocess_frame(frame)
        self._detect_court(preprocessed)
        ball_pos = self._detect_ball(preprocessed)

        if ball_pos is not None:
            self._update_ball_history(ball_pos)
            self._update_prediction(ball_pos)
        else:
            self._advance_prediction()

        bounce_detected, bounce_confidence = self._detect_bounce()

        call: Optional[str] = None
        bounce_side: Optional[str] = None
        if bounce_detected and ball_pos is not None:
            call = self._determine_call(ball_pos)
            bounce_side = self._determine_ball_side(ball_pos)
            self._record_bounce(ball_pos, call, bounce_confidence, bounce_side)

        event: Optional[dict] = None
        if bounce_detected and bounce_side is not None:
            event = self._evaluate_rally_event(call, bounce_side)

        if event is not None:
            self.rally_active = False
            return self._build_decision_result(
                ball_pos, bounce_confidence, call, event,
            )

        return self._build_tracking_result(
            ball_pos, bounce_detected, bounce_confidence, call,
        )

    def reset_rally(self) -> None:
        """Called by the backend after a point is awarded."""
        self.rally_active = True
        self.last_call = None
        self.last_bounce_side = None
        self.bounce_count_left = 0
        self.bounce_count_right = 0
        self.ball_history.clear()
        self._frames_since_bounce = 999
        self._predicted_pos = None
        self._velocity = (0.0, 0.0)

    # ------------------------------------------------------------------
    # Step 2 — Preprocessing (OpenCV)
    # ------------------------------------------------------------------

    def _preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Normalise the raw camera frame before running detection.

        - Resize large frames down to a max dimension of 640 for speed
        - Apply CLAHE to the L channel for contrast normalization
        - Light Gaussian blur to reduce noise
        """
        h, w = frame.shape[:2]
        self._frame_h, self._frame_w = h, w

        max_dim = 640
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            frame = cv2.resize(frame, None, fx=scale, fy=scale,
                               interpolation=cv2.INTER_LINEAR)

        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_channel, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_channel = clahe.apply(l_channel)
        lab = cv2.merge([l_channel, a, b])
        frame = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

        frame = cv2.GaussianBlur(frame, (3, 3), 0)
        return frame

    # ------------------------------------------------------------------
    # Step 3 — Court detection (OpenCV Hough lines)
    # ------------------------------------------------------------------

    def _detect_court(self, frame: np.ndarray) -> None:
        """Detect court boundary using edge detection + Hough lines.

        Runs full detection on the first frame and periodically after that.
        Falls back to a frame-margin polygon if line detection fails.
        """
        if self.court_detected and self.frame_index % self.COURT_REDETECT_INTERVAL != 0:
            return

        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # White/light line detection: court lines are usually white
        _, white_mask = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, kernel)

        edges = cv2.Canny(white_mask, 50, 150, apertureSize=3)

        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=50,
            minLineLength=w * 0.15,
            maxLineGap=20,
        )

        if lines is not None and len(lines) >= 4:
            all_points = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                all_points.append([x1, y1])
                all_points.append([x2, y2])

            all_points = np.array(all_points, dtype=np.int32)

            if len(all_points) >= 4:
                hull = cv2.convexHull(all_points)
                area = cv2.contourArea(hull)
                frame_area = h * w

                # Court should occupy at least 10% and at most 90% of the frame
                if 0.10 * frame_area < area < 0.90 * frame_area:
                    self.court_polygon = hull.reshape(-1, 2).astype(np.int32)
                    moments = cv2.moments(hull)
                    if moments["m00"] > 0:
                        self.court_center_x = int(moments["m10"] / moments["m00"])
                    else:
                        self.court_center_x = w // 2
                    self.court_detected = True
                    self._court_lines_raw = lines.tolist()
                    logger.info(
                        "Court detected via Hough lines (area=%.0f, center_x=%d)",
                        area, self.court_center_x,
                    )
                    return

        # Fallback: use frame margins as approximate court boundary
        if not self.court_detected:
            mx, my = int(w * 0.08), int(h * 0.12)
            self.court_polygon = np.array([
                [mx, my], [w - mx, my],
                [w - mx, h - my], [mx, h - my],
            ], dtype=np.int32)
            self.court_center_x = w // 2
            self.court_detected = True
            logger.info("Court fallback polygon (center_x=%d)", self.court_center_x)

    # ------------------------------------------------------------------
    # Step 4 — Ball detection (HSV color + contour analysis)
    # ------------------------------------------------------------------

    def _detect_ball(self, frame: np.ndarray) -> Optional[BallPosition]:
        """Detect pickleball using HSV color filtering + contour analysis.

        Pipeline:
          1. Convert to HSV
          2. Build combined mask from multiple HSV ranges
          3. Morphological cleanup
          4. Find contours
          5. Filter by area, circularity, and aspect ratio
          6. If prediction exists, prefer candidates near predicted position
          7. Return best candidate
        """
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h, w = frame.shape[:2]

        # Build combined color mask
        combined_mask = np.zeros((h, w), dtype=np.uint8)
        for lower, upper in HSV_RANGES:
            mask = cv2.inRange(hsv, lower, upper)
            combined_mask = cv2.bitwise_or(combined_mask, mask)

        # Morphological cleanup
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel_open)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel_close)

        contours, _ = cv2.findContours(
            combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE,
        )

        candidates: list[tuple[int, int, float, float]] = []

        for cnt in contours:
            area = cv2.contourArea(cnt)
            min_area = math.pi * MIN_BALL_RADIUS ** 2
            max_area = math.pi * MAX_BALL_RADIUS ** 2

            if area < min_area or area > max_area:
                continue

            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * math.pi * area / (perimeter * perimeter)
            if circularity < MIN_CIRCULARITY:
                continue

            x_r, y_r, w_r, h_r = cv2.boundingRect(cnt)
            aspect_ratio = float(w_r) / h_r if h_r > 0 else 0
            if aspect_ratio < 0.5 or aspect_ratio > 2.0:
                continue

            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            # Confidence from circularity and area fit
            radius = math.sqrt(area / math.pi)
            ideal_area = math.pi * radius ** 2
            area_score = min(area, ideal_area) / max(area, ideal_area)
            confidence = round(circularity * 0.6 + area_score * 0.4, 4)

            candidates.append((cx, cy, confidence, radius))

        if not candidates:
            return None

        # If we have a prediction, prefer candidates close to it
        if self._predicted_pos is not None:
            px, py = self._predicted_pos
            max_search_radius = 80

            nearby = []
            for cx, cy, conf, radius in candidates:
                dist = math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
                if dist < max_search_radius:
                    proximity_bonus = max(0, 1.0 - dist / max_search_radius) * 0.2
                    nearby.append((cx, cy, min(conf + proximity_bonus, 1.0), radius))

            if nearby:
                candidates = nearby

        # Pick the best candidate by confidence
        best = max(candidates, key=lambda c: c[2])
        cx, cy, confidence, _ = best

        # Scale back to original frame dimensions if we resized
        if self._frame_h > 0 and self._frame_w > 0:
            actual_h, actual_w = frame.shape[:2]
            if actual_h != self._frame_h or actual_w != self._frame_w:
                scale_x = self._frame_w / actual_w
                scale_y = self._frame_h / actual_h
                cx = int(cx * scale_x)
                cy = int(cy * scale_y)

        return BallPosition(x=cx, y=cy, confidence=confidence, timestamp=time.time())

    # ------------------------------------------------------------------
    # Step 5 — Trajectory history
    # ------------------------------------------------------------------

    def _update_ball_history(self, pos: BallPosition) -> None:
        """Append a detected position to the rolling trajectory buffer."""
        self.ball_history.append(pos)
        if len(self.ball_history) > self.MAX_HISTORY:
            self.ball_history = self.ball_history[-self.MAX_HISTORY:]

    def _update_prediction(self, pos: BallPosition) -> None:
        """Update velocity estimate and next-frame prediction."""
        if self._predicted_pos is not None:
            self._velocity = (
                pos.x - self._predicted_pos[0],
                pos.y - self._predicted_pos[1],
            )
        self._predicted_pos = (
            int(pos.x + self._velocity[0]),
            int(pos.y + self._velocity[1]),
        )

    def _advance_prediction(self) -> None:
        """Advance prediction when ball is not detected this frame."""
        if self._predicted_pos is not None:
            vx, vy = self._velocity
            self._predicted_pos = (
                int(self._predicted_pos[0] + vx),
                int(self._predicted_pos[1] + vy * 1.05),  # gravity bias
            )

    # ------------------------------------------------------------------
    # Step 6 — Bounce detection (trajectory velocity analysis)
    # ------------------------------------------------------------------

    def _detect_bounce(self) -> tuple[bool, float]:
        """Analyse recent trajectory to detect a bounce.

        A bounce is identified when:
          1. Rally is active
          2. Enough cooldown since last bounce
          3. At least 8 positions in history
          4. Vertical velocity changes from downward to upward (dy sign flip)
          5. The ball was moving fast enough downward before the flip
          6. Minimum arc height is met

        Returns (bounce_detected, confidence).
        """
        if not self.rally_active:
            return False, 0.0
        if self._frames_since_bounce <= self.BOUNCE_COOLDOWN:
            return False, 0.0
        if len(self.ball_history) < 8:
            return False, 0.0

        recent = self.ball_history[-8:]
        timestamps = [p.timestamp for p in recent]
        ys = [p.y for p in recent]

        # Compute velocities (dy/dt) between consecutive points
        velocities = []
        for i in range(len(recent) - 1):
            dt = timestamps[i + 1] - timestamps[i]
            if dt <= 0:
                dt = 0.033  # assume ~30fps
            dy = ys[i + 1] - ys[i]
            velocities.append(dy / dt)

        if len(velocities) < 5:
            return False, 0.0

        # Look for sign change: positive (downward in screen coords) → negative (upward)
        for i in range(len(velocities) - 2, 0, -1):
            v_before = velocities[i - 1]
            v_after = velocities[i + 1] if i + 1 < len(velocities) else velocities[i]

            if v_before > 15 and v_after < -5:
                # Minimum arc height check
                y_max = max(ys[:i + 1])
                y_min = min(ys[i:])
                arc_height = abs(y_max - y_min)

                if arc_height < 10:
                    continue

                # Confidence based on velocity magnitude and arc height
                speed_conf = min(abs(v_before) / 100, 1.0)
                arc_conf = min(arc_height / 60, 1.0)
                confidence = round(speed_conf * 0.5 + arc_conf * 0.5, 4)
                confidence = max(0.5, min(confidence, 0.99))

                return True, confidence

        return False, 0.0

    # ------------------------------------------------------------------
    # Step 7 — In / Out call (OpenCV)
    # ------------------------------------------------------------------

    def _determine_call(self, ball_pos: BallPosition) -> Optional[str]:
        """Determine whether the bounce landed IN or OUT.

        Uses cv2.pointPolygonTest against the court polygon.
        Accounts for ball radius: if the ball center is just outside but
        the edge touches the line, it's IN (signed distance check).
        """
        if self.court_polygon is None:
            return None

        dist = cv2.pointPolygonTest(
            self.court_polygon.astype(np.float32),
            (float(ball_pos.x), float(ball_pos.y)),
            measureDist=True,
        )

        # Ball radius ~6px at typical resolution; if center is within
        # 6px outside the line, the ball is touching → IN
        ball_radius_px = 6
        if dist >= -ball_radius_px:
            return "IN"
        return "OUT"

    def _determine_ball_side(self, ball_pos: BallPosition) -> str:
        """Which side of the court the ball is on (left / right)."""
        return "left" if ball_pos.x < self.court_center_x else "right"

    # ------------------------------------------------------------------
    # Internal — bounce bookkeeping
    # ------------------------------------------------------------------

    def _record_bounce(
        self,
        ball_pos: BallPosition,
        call: Optional[str],
        confidence: float,
        bounce_side: str,
    ) -> None:
        """Store bounce metadata and update per-side counters."""
        self.last_call = call
        self.last_bounce = BounceEvent(
            position=ball_pos,
            call=call or "IN",
            confidence=confidence,
            frame_index=self.frame_index,
        )
        self._frames_since_bounce = 0

        if bounce_side == self.last_bounce_side:
            if bounce_side == "left":
                self.bounce_count_left += 1
            else:
                self.bounce_count_right += 1
        else:
            self.bounce_count_left = 1 if bounce_side == "left" else 0
            self.bounce_count_right = 1 if bounce_side == "right" else 0
        self.last_bounce_side = bounce_side

    # ------------------------------------------------------------------
    # Step 8 — Rally event evaluation
    # ------------------------------------------------------------------

    def _evaluate_rally_event(
        self, call: Optional[str], bounce_side: str,
    ) -> Optional[dict]:
        """Decide whether the current bounce ends the rally.

        Rally-ending conditions:
          1. ball_out       — ball bounced outside the court
          2. second_bounce  — ball bounced twice on the same side

        Point logic:
          - Event on left side  → right gets the point
          - Event on right side → left gets the point
        """
        opposite = "right" if bounce_side == "left" else "left"

        if call == "OUT":
            return {
                "event_type": "rally_end",
                "reason": "ball_out",
                "bounce_side": bounce_side,
                "point_candidate": opposite,
            }

        count = self.bounce_count_left if bounce_side == "left" else self.bounce_count_right
        if count >= 2:
            return {
                "event_type": "rally_end",
                "reason": "second_bounce",
                "bounce_side": bounce_side,
                "point_candidate": opposite,
            }

        return None

    # ------------------------------------------------------------------
    # Step 9 — Result builders
    # ------------------------------------------------------------------

    def _build_tracking_result(
        self,
        ball_pos: Optional[BallPosition],
        bounce_detected: bool,
        confidence: float,
        call: Optional[str],
    ) -> dict:
        """Build a type="tracking" response for a normal frame."""
        ball_detected = ball_pos is not None
        message = None
        if bounce_detected and call:
            message = f"Bounce detected — {call}"
        elif not ball_detected:
            message = "Ball not detected"

        return {
            "type": "tracking",
            "frame_index": self.frame_index,
            "ball_detected": ball_detected,
            "ball_position": {"x": ball_pos.x, "y": ball_pos.y} if ball_pos else None,
            "court_detected": self.court_detected,
            "bounce_detected": bounce_detected,
            "call": call,
            "event": None,
            "confidence": round(confidence, 4),
            "message": message,
        }

    def _build_decision_result(
        self,
        ball_pos: Optional[BallPosition],
        confidence: float,
        call: Optional[str],
        event: dict,
    ) -> dict:
        """Build a type="decision" response for a rally-ending frame."""
        reason = event.get("reason", "unknown")
        winner = event.get("point_candidate", "unknown")

        return {
            "type": "decision",
            "frame_index": self.frame_index,
            "ball_detected": ball_pos is not None,
            "ball_position": {"x": ball_pos.x, "y": ball_pos.y} if ball_pos else None,
            "court_detected": self.court_detected,
            "bounce_detected": True,
            "call": call,
            "event": event,
            "confidence": round(confidence, 4),
            "message": f"Rally ended ({reason}) — point candidate: {winner}",
        }
