
import os
import aiohttp

from dotenv import load_dotenv

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams

from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)

from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService

from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from agent_tools import appointment_tools, register_appointment_tools
from prompts import get_system_prompt


load_dotenv(override=True)


async def run_bot(webrtc_connection):

    async with aiohttp.ClientSession() as session:

        # Browser audio transport
        transport = SmallWebRTCTransport(
            webrtc_connection=webrtc_connection,
            params=TransportParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
            ),
        )

        # ElevenLabs speech-to-text
        stt = ElevenLabsSTTService(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            aiohttp_session=session,
            model="scribe_v1",
        )

        # Google Gemini language model
        llm = GoogleLLMService(
            api_key=os.environ["GOOGLE_API_KEY"],
            model=os.getenv(
                "GEMINI_MODEL",
                "gemini-3.8-flash-lite"
            ),
            system_instruction=get_system_prompt(),
        )

        # Register the three appointment tools
        register_appointment_tools(llm)

        # ElevenLabs text-to-speech
        tts = ElevenLabsTTSService(
    api_key=os.environ["ELEVENLABS_API_KEY"],
    voice_id=os.getenv(
        "ELEVENLABS_VOICE_ID",
        "EXAVITQu4vr4xnSDxMaL"
    ),
    model="eleven_flash_v2_5",
)

        # Maintain conversation history
        context = LLMContext(
            messages=[],
            tools=appointment_tools,
        )

        # Conversation context and voice activity detection
        context_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                vad_analyzer=SileroVADAnalyzer(),
            ),
        )

        # Real-time voice processing pipeline
        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                context_aggregator.user(),
                llm,
                tts,
                transport.output(),
                context_aggregator.assistant(),
            ]
        )

        # Enable RTVI for live transcripts and speaking events
        task = PipelineTask(
            pipeline,
            enable_rtvi=True,
            params=PipelineParams(
                enable_metrics=True,
                enable_usage_metrics=True,
            ),
        )

        # Start conversation when browser connects
        @transport.event_handler("on_client_connected")
        async def on_client_connected(transport, client):
            print("CareLine voice call connected.")

            context.add_message(
                {
                    "role": "user",
                    "content": (
                        "The caller has connected. "
                        "Greet them and offer assistance."
                    ),
                }
            )

            await task.queue_frames([LLMRunFrame()])

        # Stop pipeline when browser disconnects
        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, client):
            print("CareLine voice call ended.")
            await task.cancel()

        # Run the voice pipeline
        runner = PipelineRunner(
            handle_sigint=False
        )

        await runner.run(task)
