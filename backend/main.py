
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCRequestHandler,
    SmallWebRTCRequest,
)

from database import init_db, get_connection
from tools import check_doctor_availability
from bot import run_bot


app = FastAPI(
    title="CareLine AI",
    description="AI-powered voice appointment assistant",
    version="1.0.0",
)


# Allow the React frontend to access the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database
init_db()


# WebRTC connection handler
webrtc_handler = SmallWebRTCRequestHandler()


@app.get("/")
def home():
    return {
        "service": "CareLine AI",
        "status": "running",
    }


@app.get("/api/doctors")
def get_doctors():
    conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT id, name, specialty
            FROM doctors
            ORDER BY id
            """
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        conn.close()


@app.get("/api/slots")
def get_slots(
    doctor_name: str = "",
    date: str = "",
):
    result = check_doctor_availability(
        doctor_name=doctor_name,
        date=date,
    )

    return result["available_slots"]


@app.get("/api/appointments")
def get_appointments():
    conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                a.id AS appointment_id,
                d.name AS doctor_name,
                d.specialty,
                s.slot_date,
                s.slot_time,
                a.phone_number,
                a.status,
                a.created_at
            FROM appointments a
            JOIN slots s ON a.slot_id = s.id
            JOIN doctors d ON s.doctor_id = d.id
            ORDER BY a.id DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        conn.close()


@app.post("/api/offer")
async def create_offer(
    request: SmallWebRTCRequest,
    background_tasks: BackgroundTasks,
):

    async def connection_callback(connection):
        background_tasks.add_task(
            run_bot,
            connection,
        )

    answer = await webrtc_handler.handle_web_request(
        request=request,
        webrtc_connection_callback=connection_callback,
    )

    if answer is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to establish voice connection",
        )

    return answer
