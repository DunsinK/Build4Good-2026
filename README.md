# Called It — Pickleball AI Referee

A real-time pickleball AI referee and score-caller built for the **Build4Good Hackathon 2026**.

Called It uses computer vision to track the ball, detect bounces, make IN/OUT line calls, and announce which side got the point — all in real time from a phone camera.

## Project Structure

```
├── backend/
│   ├── backend.py       # FastAPI server, WebSocket /ws/referee
│   └── score.py         # MVP point-award logic
├── ml/
│   ├── __init__.py
│   └── yolo.py          # PickleballRefereeEngine — CV pipeline
├── mobile/
│   └── called-it-mobile/  # Expo React Native app
│       └── src/
│           ├── app/
│           │   ├── index.tsx       # Home screen
│           │   ├── referee.tsx     # AI Referee screen (camera + WebSocket)
│           │   ├── live-game.tsx   # Manual scorekeeping
│           │   └── history.tsx     # Game history
│           ├── hooks/
│           │   └── use-referee-socket.ts  # WebSocket hook
│           └── context/
│               └── GameContext.tsx  # Game state provider
├── shared/
│   └── api_contracts.json  # Backend/frontend response contract
├── docs/
│   └── PRD.md
└── requirements.txt
```

## How It Works

1. Open the app and tap **AI Referee**
2. Connect to the backend WebSocket server
3. Start streaming — the camera sends frames at ~4 fps
4. The backend runs each frame through the ML pipeline:
   - Ball detection (YOLO placeholder)
   - Court detection (OpenCV placeholder)
   - Bounce detection (trajectory analysis)
   - IN/OUT classification (`cv2.pointPolygonTest`)
5. When a rally-ending event is detected, the backend determines which side gets the point
6. The app announces **"left got the point"** or **"right got the point"** via text-to-speech

## Running the Backend

```bash
pip install -r requirements.txt
cd backend
python backend.py
```

Server starts on `http://0.0.0.0:8000`.

## Running the Mobile App

```bash
cd mobile/called-it-mobile
npm install
npx expo start
```

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 55, React Native, TypeScript |
| Backend | Python, FastAPI, uvicorn, WebSockets |
| ML Engine | OpenCV, NumPy (YOLO TBD) |
| Communication | WebSocket `/ws/referee` |

## Team

- [DunsinK](https://github.com/DunsinK)

## License

MIT
