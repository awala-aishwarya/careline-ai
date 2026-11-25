
import sqlite3
from pathlib import Path
from datetime import date, timedelta

DB_PATH = Path(__file__).resolve().parent / "careline.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()

    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS doctors (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                specialty TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                slot_date TEXT NOT NULL,
                slot_time TEXT NOT NULL,
                FOREIGN KEY (doctor_id) REFERENCES doctors(id),
                UNIQUE (doctor_id, slot_date, slot_time)
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slot_id INTEGER NOT NULL,
                phone_number TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'BOOKED'
                    CHECK (status IN ('BOOKED', 'CANCELLED')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (slot_id) REFERENCES slots(id)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS unique_booked_slot
            ON appointments(slot_id)
            WHERE status = 'BOOKED';
        """)

        doctors = [
            (1, "Dr. Ananya Rao", "General Medicine"),
            (2, "Dr. Arjun Mehta", "Cardiology"),
            (3, "Dr. Meera Sharma", "Dermatology"),
            (4, "Dr. Vikram Reddy", "Orthopedics"),
        ]

        conn.executemany("""
            INSERT OR IGNORE INTO doctors
            (id, name, specialty)
            VALUES (?, ?, ?)
        """, doctors)

        times = [
            "09:00",
            "10:30",
            "12:00",
            "14:30",
            "16:00",
        ]

        for doctor in doctors:
            for day in range(7):
                slot_date = (
                    date.today() + timedelta(days=day)
                ).isoformat()

                for slot_time in times:
                    conn.execute("""
                        INSERT OR IGNORE INTO slots
                        (doctor_id, slot_date, slot_time)
                        VALUES (?, ?, ?)
                    """, (doctor[0], slot_date, slot_time))

        conn.commit()

        doctor_count = conn.execute(
            "SELECT COUNT(*) FROM doctors"
        ).fetchone()[0]

        slot_count = conn.execute(
            "SELECT COUNT(*) FROM slots"
        ).fetchone()[0]

        print("Database initialized successfully.")
        print(f"Doctors: {doctor_count}")
        print(f"Appointment slots: {slot_count}")

    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
