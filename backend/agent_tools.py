
from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

from tools import (
    check_doctor_availability,
    book_appointment,
    cancel_appointment,
)


availability_schema = FunctionSchema(
    name="check_doctor_availability",
    description=(
        "Find available appointment slots by doctor name, "
        "specialty, or preferred date."
    ),
    properties={
        "doctor_name": {
            "type": "string",
            "description": "Doctor name or medical specialty."
        },
        "date": {
            "type": "string",
            "description": "Preferred date in YYYY-MM-DD format."
        }
    },
    required=[]
)


booking_schema = FunctionSchema(
    name="book_appointment",
    description=(
        "Book an available appointment slot after reading "
        "the caller's phone number back and receiving confirmation."
    ),
    properties={
        "slot_id": {
            "type": "integer",
            "description": "Slot ID returned by the availability tool."
        },
        "phone_number": {
            "type": "string",
            "description": "The caller's spoken 10-digit phone number."
        },
        "phone_confirmed": {
            "type": "boolean",
            "description": (
                "True only after the caller explicitly confirms "
                "the phone number read back by the agent."
            )
        }
    },
    required=[
        "slot_id",
        "phone_number",
        "phone_confirmed"
    ]
)


cancellation_schema = FunctionSchema(
    name="cancel_appointment",
    description=(
        "Cancel an existing appointment using the caller's "
        "confirmed phone number."
    ),
    properties={
        "phone_number": {
            "type": "string",
            "description": "The caller's spoken phone number."
        },
        "phone_confirmed": {
            "type": "boolean",
            "description": "True only after explicit phone confirmation."
        },
        "appointment_id": {
            "type": "integer",
            "description": (
                "Appointment ID if the caller has multiple appointments."
            )
        }
    },
    required=[
        "phone_number",
        "phone_confirmed"
    ]
)


appointment_tools = ToolsSchema(
    standard_tools=[
        availability_schema,
        booking_schema,
        cancellation_schema
    ]
)


async def handle_availability(params: FunctionCallParams):
    args = params.arguments

    result = check_doctor_availability(
        doctor_name=args.get("doctor_name", ""),
        date=args.get("date", "")
    )

    await params.result_callback(result)


async def handle_booking(params: FunctionCallParams):
    args = params.arguments

    result = book_appointment(
        slot_id=args["slot_id"],
        phone_number=args["phone_number"],
        phone_confirmed=args.get("phone_confirmed", False)
    )

    await params.result_callback(result)


async def handle_cancellation(params: FunctionCallParams):
    args = params.arguments

    result = cancel_appointment(
        phone_number=args["phone_number"],
        phone_confirmed=args.get("phone_confirmed", False),
        appointment_id=args.get("appointment_id")
    )

    await params.result_callback(result)


def register_appointment_tools(llm):
    llm.register_function(
        "check_doctor_availability",
        handle_availability
    )

    llm.register_function(
        "book_appointment",
        handle_booking
    )

    llm.register_function(
        "cancel_appointment",
        handle_cancellation
    )
