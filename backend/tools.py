
import re
import sqlite3
from datetime import datetime

from database import get_connection


def normalize_phone(phone_number):
    phone = re.sub(r"\D", "", str(phone_number))

    if len(phone) == 12 and phone.startswith("91"):
        phone = phone[2:]

    if len(phone) != 10:
        return None

    return phone


def check_doctor_availability(doctor_name="", date=""):
    conn = get_connection()

    try:
        query = """
            SELECT
                s.id AS slot_id,
                d.name AS doctor_name,
                d.specialty,
                s.slot_date,
                s.slot_time
            FROM slots s
            JOIN doctors d ON d.id = s.doctor_id
            WHERE NOT EXISTS (
                SELECT 1
                FROM appointments a
                WHERE a.slot_id = s.id
                AND a.status = 'BOOKED'
            )
            AND (s.slot_date || ' ' || s.slot_time) > ?
        """

        params = [datetime.now().strftime("%Y-%m-%d %H:%M")]

        if doctor_name:
            query += """
                AND (
                    LOWER(d.name) LIKE LOWER(?)
                    OR LOWER(d.specialty) LIKE LOWER(?)
                )
            """
            params.extend([
                f"%{doctor_name}%",
                f"%{doctor_name}%"
            ])

        if date:
            query += " AND s.slot_date = ?"
            params.append(date)

        query += """
            ORDER BY s.slot_date, s.slot_time, d.name
        """

        slots = conn.execute(query, params).fetchall()

        return {
            "success": True,
            "available_slots": [dict(slot) for slot in slots]
        }

    finally:
        conn.close()


def book_appointment(
    slot_id,
    phone_number,
    phone_confirmed=False
):
    if not phone_confirmed:
        return {
            "success": False,
            "message": "Confirm the phone number with the caller first."
        }

    phone = normalize_phone(phone_number)

    if not phone:
        return {
            "success": False,
            "message": "A valid 10-digit phone number is required."
        }

    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        slot = conn.execute("""
            SELECT
                s.id,
                d.name AS doctor_name,
                d.specialty,
                s.slot_date,
                s.slot_time
            FROM slots s
            JOIN doctors d ON d.id = s.doctor_id
            WHERE s.id = ?
            AND (s.slot_date || ' ' || s.slot_time) > ?
        """, (
            slot_id,
            datetime.now().strftime("%Y-%m-%d %H:%M")
        )).fetchone()

        if not slot:
            return {
                "success": False,
                "message": "Invalid or expired appointment slot."
            }

        existing = conn.execute("""
            SELECT id FROM appointments
            WHERE slot_id = ?
            AND status = 'BOOKED'
        """, (slot_id,)).fetchone()

        if existing:
            return {
                "success": False,
                "message": "This slot is already booked."
            }

        cursor = conn.execute("""
            INSERT INTO appointments
            (slot_id, phone_number, status)
            VALUES (?, ?, 'BOOKED')
        """, (slot_id, phone))

        conn.commit()

        return {
            "success": True,
            "message": "Appointment booked successfully.",
            "appointment_id": cursor.lastrowid,
            "doctor_name": slot["doctor_name"],
            "specialty": slot["specialty"],
            "date": slot["slot_date"],
            "time": slot["slot_time"],
            "phone_number": phone
        }

    except sqlite3.IntegrityError:
        conn.rollback()

        return {
            "success": False,
            "message": "This slot is no longer available."
        }

    finally:
        conn.close()


def cancel_appointment(
    phone_number,
    phone_confirmed=False,
    appointment_id=None
):
    if not phone_confirmed:
        return {
            "success": False,
            "message": "Confirm the phone number with the caller first."
        }

    phone = normalize_phone(phone_number)

    if not phone:
        return {
            "success": False,
            "message": "A valid 10-digit phone number is required."
        }

    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        query = """
            SELECT
                a.id AS appointment_id,
                d.name AS doctor_name,
                s.slot_date,
                s.slot_time
            FROM appointments a
            JOIN slots s ON s.id = a.slot_id
            JOIN doctors d ON d.id = s.doctor_id
            WHERE a.phone_number = ?
            AND a.status = 'BOOKED'
        """

        params = [phone]

        if appointment_id is not None:
            query += " AND a.id = ?"
            params.append(appointment_id)

        appointments = conn.execute(
            query, params
        ).fetchall()

        if not appointments:
            return {
                "success": False,
                "message": "No active appointment found for this number."
            }

        if len(appointments) > 1:
            return {
                "success": False,
                "message": "Multiple appointments found. Ask which appointment to cancel.",
                "appointments": [
                    dict(item) for item in appointments
                ]
            }

        appointment = appointments[0]

        conn.execute("""
            UPDATE appointments
            SET status = 'CANCELLED'
            WHERE id = ?
        """, (appointment["appointment_id"],))

        conn.commit()

        return {
            "success": True,
            "message": "Appointment cancelled successfully.",
            "appointment_id": appointment["appointment_id"],
            "doctor_name": appointment["doctor_name"],
            "date": appointment["slot_date"],
            "time": appointment["slot_time"]
        }

    finally:
        conn.close()
