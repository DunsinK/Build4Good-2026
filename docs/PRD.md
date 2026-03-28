# Called It — Pickleball AI Referee
## Product Requirements Document

---

## 1. Overview

**Called It** is a mobile-first AI-powered pickleball referee that uses computer vision to track the ball in real time, determine whether shots land in or out of bounds, and automatically keep score. The app is designed for recreational and competitive players who want accurate, unbiased line calls without a human referee.

**Hackathon:** Build4Good 2026

---

## 2. Problem Statement

Pickleball is the fastest-growing sport in North America, yet most recreational games have no referee. Line calls — especially on close shots near the kitchen (non-volley zone) and sidelines — are a constant source of disputes. Players need a fast, accessible, and fair way to settle these calls.

---

## 3. Target Users

| Persona | Description |
|---|---|
| **Recreational players** | Casual pickup games at public courts with no ref |
| **League / tournament players** | Want accurate calls to supplement or replace human refs |
| **Court facility operators** | Could mount a phone/camera for automated officiating |

---

## 4. Core Features

### 4.1 Ball Tracking (ML)
- Frame-by-frame ball detection via the `PickleballRefereeEngine` class in `ml/yolo.py`.
- Maintains a rolling history of up to **120 ball positions** (~4 seconds at 30 fps) for trajectory analysis.
- Court boundary detection on first frame to establish the playing surface polygon (baselines, sidelines, kitchen line).
- **Current status:** Stub implementations with placeholder logic. TODO items in code mark where real YOLO model inference, Hough line transforms, and calibrated bounce detection should be integrated.

### 4.2 In/Out Call
- Bounce detection via vertical velocity analysis — monitors `dy` sign changes (downward → upward) across the last 5 ball positions.
- In/Out decision uses **`cv2.pointPolygonTest`** to check whether the bounce point falls inside or outside the detected court polygon.
- Each call returns a confidence score and is sent back to the client as a `"decision"` event.
- **Current status:** Court polygon is a placeholder (10%/15% margin from frame edges). Ball detection is randomized. Bounce confidence is randomized (0.75–0.98). The `pointPolygonTest` logic is real and ready for actual court data.

### 4.3 Score Tracking
- Maintain an **in-memory score state** on the mobile client (no database, no persistence).
- Support standard pickleball scoring:
  - **Singles:** Points scored only by the server; games to 11, win by 2.
  - **Doubles:** Three-number score (server score, receiver score, server number); games to 11, win by 2.
- Allow manual score correction via the UI in case of override.
- Score resets when a new game is started.
- **Current status:** Not yet implemented. Score logic will live in the mobile app, driven by decision events from the backend.

### 4.4 Mobile App (React Native / Expo)
- **Camera view:** Full-screen camera feed with an overlay showing court lines, ball tracking, and the current score.
- **Score display:** Persistent scoreboard overlay at the top of the screen.
- **Call history:** Scrollable list of recent calls (in/out + timestamp) for the current game session (in-memory only).
- **Game controls:** Start game, reset score, switch sides/server.
- **Settings:** Toggle singles/doubles mode, sensitivity adjustments, audio on/off.
- **Current status:** Default Expo template app scaffolded in `mobile/called-it-mobile/`. No pickleball-specific screens or camera integration yet.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────┐
│                  Mobile App                      │
│            (Expo / React Native)                 │
│                                                  │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Camera   │  │ Score UI   │  │  Call       │  │
│  │  Feed     │  │ & Controls │  │  History    │  │
│  └─────┬─────┘  └────────────┘  └────────────┘  │
│        │ frames (binary JPEG/PNG or base64)      │
└────────┼─────────────────────────────────────────┘
         │  WebSocket
         ▼
┌─────────────────────────────────────────────────┐
│              Backend (Python / FastAPI)           │
│                                                  │
│  ┌───────────────────┐                           │
│  │  WebSocket Handler │─── /ws/referee           │
│  │  decode_frame()    │                          │
│  └─────┬─────────────┘                           │
│        │ cv2 BGR frame                           │
│        ▼                                         │
│  ┌───────────────────────────────────────────┐   │
│  │     PickleballRefereeEngine (ml/yolo.py)  │   │
│  │                                           │   │
│  │  _detect_court_lines() → court polygon    │   │
│  │  _detect_ball()        → BallPosition     │   │
│  │  _detect_bounce()      → (bool, conf)     │   │
│  │  _decide_in_out()      → "IN" / "OUT"     │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌───────────────────┐                           │
│  │  GET /health       │                          │
│  └───────────────────┘                           │
└─────────────────────────────────────────────────┘
```

### Component Breakdown

| Layer | Tech | Location | Responsibility |
|---|---|---|---|
| **Mobile** | Expo SDK 55, React Native 0.83, TypeScript | `mobile/called-it-mobile/` | Camera capture, UI, score display, call history |
| **Backend** | Python, FastAPI, uvicorn | `backend/backend.py` | WebSocket server, frame decoding, routes engine results back to client |
| **ML Engine** | OpenCV, NumPy (YOLO TBD) | `ml/yolo.py` | `PickleballRefereeEngine` — ball detection, court detection, bounce detection, in/out classification |
| **Shared** | JSON schemas / types | `shared/` | API contracts between mobile and backend (TBD) |

---

## 6. Data Flow

1. **Mobile** captures camera frames and sends them to the backend over **WebSocket** (`/ws/referee`) as raw binary (JPEG/PNG bytes) or base64-encoded strings.
2. **Backend** `decode_frame()` converts the payload into a BGR OpenCV `np.ndarray`. Supports raw bytes, plain base64, and data-URI prefixed base64.
3. **Backend** passes the frame to `PickleballRefereeEngine.process_frame()`, which runs the full pipeline:
   - **Court detection** (first frame only) — identifies court boundary polygon.
   - **Ball detection** — locates the ball, appends to rolling history (max 120 positions).
   - **Bounce detection** — analyzes vertical velocity in recent trajectory.
   - **In/Out classification** — `cv2.pointPolygonTest` against court polygon.
4. **Backend** returns the result JSON over the same WebSocket connection.
5. **Mobile** renders the ball position overlay, displays any in/out call, and updates the score.

---

## 7. API Contract (Backend ↔ Mobile)

### `GET /health`
Returns server status.
```json
{ "status": "ok" }
```

### WebSocket: `/ws/referee`

**Client → Server (per frame):**
Raw binary bytes (JPEG/PNG) or a base64-encoded string (with or without `data:image/...;base64,` prefix).

**Server → Client (tracking frame — no bounce):**
```json
{
  "type": "tracking",
  "ball_position": { "x": 320, "y": 480 },
  "bounce_detected": false,
  "call": null,
  "confidence": 0.0,
  "frame_index": 42
}
```

**Server → Client (decision — bounce detected):**
```json
{
  "type": "decision",
  "ball_position": { "x": 310, "y": 475 },
  "bounce_detected": true,
  "call": "IN",
  "confidence": 0.9231,
  "frame_index": 87
}
```

**Server → Client (ball not detected in frame):**
```json
{
  "type": "tracking",
  "ball_position": null,
  "bounce_detected": false,
  "call": null,
  "confidence": 0.0,
  "frame_index": 43
}
```

### Future REST Endpoints (not yet implemented)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/game/start` | Start a new game (resets score) |
| `GET` | `/game/score` | Get current score |
| `POST` | `/game/score/correct` | Manually correct the score |
| `POST` | `/game/point` | Award a point to a side |
| `POST` | `/game/switch-server` | Switch the serving side |

Score tracking may live entirely on the mobile client, making these endpoints optional.

---

## 8. ML Engine Details

### `PickleballRefereeEngine` (implemented in `ml/yolo.py`)

| Attribute | Value |
|---|---|
| **Class** | `PickleballRefereeEngine` |
| **State** | `frame_index`, `ball_history` (list of `BallPosition`), `court_lines` (polygon), `last_bounce`, `last_call` |
| **Max history** | 120 positions (~4s at 30 fps) |
| **Court detection** | Runs once on first frame, stores polygon in `self.court_lines` |
| **In/Out logic** | `cv2.pointPolygonTest` — bounce point vs. court boundary polygon |

### Data Classes

```python
@dataclass
class BallPosition:
    x: int
    y: int
    timestamp: float

@dataclass
class BounceEvent:
    position: BallPosition
    call: str          # "IN" | "OUT"
    confidence: float
    frame_index: int
```

### Pipeline Stages & TODO Status

| Stage | Method | Status | TODO |
|---|---|---|---|
| Court detection | `_detect_court_lines()` | Placeholder (margin-based polygon) | Replace with Hough line transform or segmentation model; identify baseline, sidelines, kitchen line |
| Ball detection | `_detect_ball()` | Placeholder (random positions, 85% detection rate) | Integrate YOLOv8/v11 object detection fine-tuned for pickleballs; filter by confidence, apply NMS |
| Bounce detection | `_detect_bounce()` | Placeholder (dy sign change in last 5 positions) | Compute real vertical velocity, require minimum trajectory length, calibrate confidence |
| In/Out decision | `_decide_in_out()` | Functional (`cv2.pointPolygonTest`) | Account for ball radius, camera perspective, and homography correction |

---

## 9. Score Engine Rules

### Singles
- Only the **server** scores points.
- On a side-out, serve passes to the opponent.
- Game to **11**, win by **2**.

### Doubles
- Score format: **server score – receiver score – server number** (e.g., 4-3-2).
- Each team gets two serves (one per player) before a side-out, except at the start of the game (one serve only).
- Game to **11**, win by **2**.

### State (in-memory, mobile-side)
```python
{
  "mode": "singles" | "doubles",
  "scores": [0, 0],
  "server_side": 0 | 1,
  "server_number": 1 | 2,   # doubles only
  "game_over": false,
  "calls": []               # list of {result, confidence, timestamp}
}
```

**Current status:** Not yet implemented. Will be driven by `"decision"` events from the WebSocket.

---

## 10. Mobile Screens

| Screen | Description | Status |
|---|---|---|
| **Home** | Start a new game, choose singles/doubles | Not started (default Expo template) |
| **Camera / Game** | Live camera feed with ball tracking overlay, scoreboard, and in/out call banner | Not started |
| **Call History** | List of all calls made during the current game with timestamps | Not started |
| **Settings** | Toggle mode, audio/haptic alerts, camera resolution | Not started |

---

## 11. Non-Goals (Out of Scope)

- No persistent database or cloud storage.
- No user accounts or authentication.
- No video replay/recording (v1).
- No multi-camera support (single phone camera only).
- No foot-fault detection (v1).
- No net detection / let calls (v1).

---

## 12. Tech Stack Summary

| Component | Technology | Status |
|---|---|---|
| Mobile app | Expo SDK 55, React Native 0.83, TypeScript | Scaffolded (default template) |
| Backend server | Python, FastAPI, uvicorn, WebSockets | Implemented — frame streaming + engine integration |
| ML engine | OpenCV, NumPy | Implemented — pipeline scaffolded with placeholders |
| YOLO inference | Ultralytics (YOLOv8/v11) | Not yet integrated (not in `requirements.txt`) |
| Communication | WebSocket `/ws/referee` (frames), REST `/health` | Implemented |

### Dependencies (`requirements.txt`)
```
fastapi
uvicorn[standard]
websockets
opencv-python-headless
numpy
```

---

## 13. Repo Structure

```
Build4Good-2026/
├── backend/
│   ├── backend.py          # FastAPI server, WebSocket /ws/referee, frame decoder
│   └── .gitignore          # Ignores /venv, /myvenv
├── ml/
│   ├── __init__.py          # Makes ml a Python package
│   └── yolo.py             # PickleballRefereeEngine — detection pipeline
├── mobile/
│   └── called-it-mobile/   # Expo React Native app (default template)
│       ├── app.json
│       ├── package.json
│       └── src/
│           ├── app/         # Screens (_layout, index, explore)
│           └── components/  # Themed UI components
├── shared/                  # API contracts / shared types (TBD)
├── docs/
│   ├── PRD.md               # This document
│   └── bood.py
├── requirements.txt         # Python dependencies
└── README.md
```

---

## 14. Success Metrics

| Metric | Target |
|---|---|
| Ball detection accuracy | > 90% on test footage |
| In/Out call accuracy | > 85% on bounce events |
| Inference latency | < 100ms per frame |
| End-to-end call latency | < 500ms from bounce to on-screen call |
| Usability | Single-tap game start, zero configuration needed |

---

## 15. Implementation Roadmap

| Priority | Task | Owner |
|---|---|---|
| **P0** | Integrate real YOLO model for ball detection in `_detect_ball()` | ML |
| **P0** | Implement real court line detection in `_detect_court_lines()` | ML |
| **P0** | Build camera screen in mobile app with WebSocket streaming | Mobile |
| **P1** | Calibrate bounce detection with real trajectory data | ML |
| **P1** | Add homography correction for angled camera views | ML |
| **P1** | Implement score tracking UI on mobile | Mobile |
| **P2** | Add audio/haptic alerts for calls | Mobile |
| **P2** | Settings screen (singles/doubles, sensitivity) | Mobile |
| **P2** | Call history screen | Mobile |

---

## 16. Open Questions

1. Should frames be processed on-device (using CoreML/TFLite export) or streamed to a local backend server? (Currently: streamed to backend.)
2. What camera angle/mounting position gives the best accuracy for line calls?
3. Should we support landscape-only mode for better court visibility?
4. How do we handle low-light or indoor court conditions?
5. Should score tracking live entirely on mobile, or should the backend maintain game state too?
6. What training dataset will be used for YOLO fine-tuning? (Public pickleball datasets, custom-labeled footage, or synthetic data?)
