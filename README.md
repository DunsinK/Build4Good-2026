# FairPlay — Sports AI Referee

A real-time sports AI referee and score-caller built for the **Build4Good Hackathon 2026**.

FairPlay uses computer vision to track the ball, detect bounces, make IN/OUT line calls, and announce which side got the point — all in real time from a phone camera.

## Demo Video 
[![FairPlay Demo Video](https://img.youtube.com/vi/Z3UByxiCfNE/maxresdefault.jpg)](https://youtu.be/Z3UByxiCfNE)

## Project Structure


```
├── backend/
│   ├── backend.py       # FastAPI server, WebSocket /ws/referee
│   └── score.py         # MVP point-award logic
├── ml/
│   ├── __init__.py
│   └── yolo.py          # PickleballRefereeEngine — CV pipeline
├── mobile/
│   └── called-it-mobile3/  # Expo React Native app
│       ├── App.js            # Root navigator
│       ├── GameContext.js     # Game state provider
│       └── screens/
│           ├── StartScreen.js    # Home / new game
│           ├── PlayScreen.js     # Camera + score (main game)
│           └── HistoryScreen.js  # Past games
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

Requires **Python 3.10+**.

**macOS / Linux:**
```bash
pip install -r requirements.txt
cd backend
python backend.py
```

**Windows (PowerShell):**
```powershell
pip install -r requirements.txt
cd backend
python backend.py
```

If you get an import error on Windows, make sure you're running from inside the `backend/` folder, not the repo root.

Server starts on `http://0.0.0.0:8000`.

## Running the Mobile App

Requires **Node.js 18+**.

```bash
cd mobile/called-it-mobile3
npm install
npx expo start
```

Press `w` to open in web, or scan the QR code with Expo Go on your phone.

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


Docker Commands: 
 docker build -t build4good-backend .
> docker run --rm -p 8000:8000 --name build4good-backend build4good-backend
