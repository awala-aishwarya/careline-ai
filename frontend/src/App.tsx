
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  HeartPulse,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  CalendarDays,
  CalendarCheck,
  Stethoscope,
  MessageSquare,
  Clock,
  Users,
  AudioLines,
  ShieldCheck,
  CircleAlert,
} from "lucide-react";

import {
  getDashboardData,
  type Doctor,
  type AppointmentSlot,
  type Appointment,
} from "./api";

import { createVoiceClient } from "./voice";
import "./App.css";

interface Transcript {
  role: "user" | "assistant";
  text: string;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function App() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  const [callState, setCallState] = useState("disconnected");
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("all");

  const voiceRef = useRef<ReturnType<typeof createVoiceClient> | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const activeCall = [
    "initializing",
    "initialized",
    "connecting",
    "connected",
    "ready",
    "disconnecting",
  ].includes(callState);

  const connected = callState === "ready" || callState === "connected";

  const activeBookings = appointments.filter(
    (appointment) => appointment.status === "BOOKED"
  ).length;

  const filteredSlots = slots.filter(
    (slot) =>
      selectedDoctor === "all" ||
      slot.doctor_name === selectedDoctor
  );

  // Automatically refresh dashboard records.
  useEffect(() => {
    let mounted = true;

    async function refreshDashboard() {
      try {
        const data = await getDashboardData();

        if (mounted) {
          setDoctors(data.doctors);
          setSlots(data.slots);
          setAppointments(data.appointments);
          setOnline(true);
        }
      } catch {
        if (mounted) setOnline(false);
      }
    }

    void refreshDashboard();

    const interval = window.setInterval(refreshDashboard, 2500);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Call duration timer.
  useEffect(() => {
    if (!connected) return;

    const interval = window.setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [connected]);

  // Keep the latest conversation visible.
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [transcripts]);

  useEffect(() => {
    return () => {
      void voiceRef.current?.disconnect().catch(() => {});
    };
  }, []);

  async function startCall() {
    if (voiceRef.current) return;

    setError("");
    setTranscripts([]);
    setSeconds(0);
    setMuted(false);
    setSpeaking(false);
    setCallState("connecting");

    const voice = createVoiceClient({
      onStateChange: (state) => {
        setCallState(state);

        if (state === "disconnected") {
          voiceRef.current = null;
          setSpeaking(false);
          setMuted(false);
        }
      },

      onTranscript: (role, text) => {
  const cleanText = text.trim();

  if (!cleanText) return;

  setTranscripts((previous) => {
    const lastMessage = previous[previous.length - 1];

    if (
      role === "assistant" &&
      lastMessage?.role === "assistant"
    ) {
      const separator = /^[.,!?;:]/.test(cleanText)
        ? ""
        : " ";

      return [
        ...previous.slice(0, -1),
        {
          role: "assistant",
          text: lastMessage.text + separator + cleanText,
        },
      ];
    }

    return [...previous, { role, text: cleanText }];
  });
},

      onSpeakingChange: setSpeaking,
      onError: setError,
    });

    voiceRef.current = voice;

    try {
      await voice.connect();
    } catch {
      await voice.disconnect().catch(() => {});
      setCallState("disconnected");
      voiceRef.current = null;
    }
  }

  async function endCall() {
    try {
      setCallState("disconnecting");
      await voiceRef.current?.disconnect();
    } catch {
      setError("Unable to close the call cleanly.");
    } finally {
      voiceRef.current = null;
      setCallState("disconnected");
      setSpeaking(false);
      setMuted(false);
    }
  }

  function toggleMute() {
    const nextMuted = !muted;
    voiceRef.current?.setMuted(nextMuted);
    setMuted(nextMuted);
  }

  const duration = `${String(Math.floor(seconds / 60)).padStart(
    2,
    "0"
  )}:${String(seconds % 60).padStart(2, "0")}`;

  const callLabel = speaking
    ? "Agent speaking"
    : connected
      ? muted
        ? "Microphone muted"
        : "Listening"
      : activeCall
        ? "Connecting..."
        : "Ready to connect";

  return (
    <div className="app-shell">

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <HeartPulse size={27} />
          </div>
          <div>
            <h1>CareLine<span> AI</span></h1>
            <p>Intelligent appointment assistant</p>
          </div>
        </div>

        <div className={`system-status ${online ? "online" : "offline"}`}>
          <span className="status-dot" />
          {online ? "System online" : "Backend offline"}
        </div>
      </header>

      <main className="dashboard">

        <section className="page-heading">
          <div>
            <div className="eyebrow">RECEPTION WORKSPACE</div>
            <h2>Appointment overview</h2>
            <p>Voice-powered care, seamlessly connected.</p>
          </div>

          <div className="today">
            <CalendarDays size={17} />
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon">
              <Users size={23} />
            </div>
            <div>
              <p>Available doctors</p>
              <h3>{doctors.length}</h3>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <CalendarDays size={23} />
            </div>
            <div>
              <p>Open slots</p>
              <h3>{slots.length}</h3>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <CalendarCheck size={23} />
            </div>
            <div>
              <p>Active bookings</p>
              <h3>{activeBookings}</h3>
            </div>
          </article>
        </section>

        <section className="conversation-grid">

          <article className="call-panel">
            <div className="call-panel-top">
              <span><Activity size={16} /> VOICE ASSISTANT</span>
              <span className="call-timer">
                <Clock size={14} /> {duration}
              </span>
            </div>

            <div className={`agent-avatar ${speaking ? "speaking" : ""}`}>
              <AudioLines size={48} />
            </div>

            <h3>CareLine Receptionist</h3>
            <p className="call-status">{callLabel}</p>

            <div className={`waveform ${speaking ? "animated" : ""}`}>
              {Array.from({ length: 25 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    height: `${8 + ((index * 17) % 35)}px`,
                    animationDelay: `${index * 0.055}s`,
                  }}
                />
              ))}
            </div>

            <div className="call-controls">
              {activeCall ? (
                <>
                  <div className="control-item">
                    <button
                      className={`mute-button ${muted ? "muted" : ""}`}
                      onClick={toggleMute}
                      disabled={!connected}
                      aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                    >
                      {muted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    <span>{muted ? "Unmute" : "Mute"}</span>
                  </div>

                  <div className="control-item">
                    <button
                      className="end-button"
                      onClick={endCall}
                      disabled={callState === "disconnecting"}
                      aria-label="End call"
                    >
                      <PhoneOff size={25} />
                    </button>
                    <span>End call</span>
                  </div>
                </>
              ) : (
                <div className="control-item">
                  <button
                    className="start-button"
                    onClick={startCall}
                    disabled={!online}
                    aria-label="Start call"
                  >
                    <Phone size={27} />
                  </button>
                  <span>Start call</span>
                </div>
              )}
            </div>

            {error && (
              <div className="call-error">
                <CircleAlert size={16} />
                {error}
              </div>
            )}

            <div className="call-footer">
              <ShieldCheck size={15} />
              Browser-based voice session
            </div>
          </article>

          <article className="panel transcript-panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3>Live transcript</h3>
                <p>Real-time conversation</p>
              </div>
              {connected && <span className="live-label">● LIVE</span>}
            </div>

            <div className="transcript-body">
              {transcripts.length === 0 ? (
                <div className="empty-state">
                  <MessageSquare size={36} />
                  <h4>No conversation yet</h4>
                  <p>Start a call to speak with CareLine.</p>
                </div>
              ) : (
                transcripts.map((message, index) => (
                  <div
                    key={index}
                    className={`message ${message.role}`}
                  >
                    <span className="message-role">
                      {message.role === "assistant"
                        ? "CareLine AI"
                        : "You"}
                    </span>
                    <div className="message-bubble">
                      {message.text}
                    </div>
                  </div>
                ))
              )}

              <div ref={transcriptEnd} />
            </div>
          </article>
        </section>

        <section className="availability-grid">

          <article className="panel doctors-panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <Stethoscope size={21} />
              </div>
              <div>
                <h3>Our doctors</h3>
                <p>Specialists available for appointments</p>
              </div>
            </div>

            <div className="doctor-list">
              {doctors.map((doctor) => {
                const count = slots.filter(
                  (slot) => slot.doctor_name === doctor.name
                ).length;

                return (
                  <button
                    key={doctor.id}
                    className={`doctor-card ${
                      selectedDoctor === doctor.name ? "selected" : ""
                    }`}
                    onClick={() =>
                      setSelectedDoctor(
                        selectedDoctor === doctor.name
                          ? "all"
                          : doctor.name
                      )
                    }
                  >
                    <div className="doctor-avatar">
                      <Stethoscope size={21} />
                    </div>

                    <div className="doctor-details">
                      <h4>{doctor.name}</h4>
                      <p>{doctor.specialty}</p>
                    </div>

                    <span className="slot-count">{count} slots</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="panel slots-panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <CalendarDays size={21} />
              </div>
              <div>
                <h3>Available slots</h3>
                <p>{filteredSlots.length} appointments available</p>
              </div>
            </div>

            <div className="slot-filter">
              <select
                value={selectedDoctor}
                onChange={(event) => setSelectedDoctor(event.target.value)}
                aria-label="Filter by doctor"
              >
                <option value="all">All doctors</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.name}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="slot-list">
              {filteredSlots.length === 0 ? (
                <div className="empty-state">
                  <CalendarDays size={30} />
                  <p>No available slots.</p>
                </div>
              ) : (
                filteredSlots.map((slot) => (
                  <div className="slot-row" key={slot.slot_id}>
                    <div>
                      <h4>{slot.doctor_name}</h4>
                      <p>{formatDate(slot.slot_date)}</p>
                    </div>

                    <span className="time-chip">
                      <Clock size={13} />
                      {formatTime(slot.slot_time)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="panel appointments-panel">
          <div className="panel-heading">
            <div className="heading-icon">
              <CalendarCheck size={21} />
            </div>
            <div>
              <h3>Appointment records</h3>
              <p>Bookings and cancellations updated automatically</p>
            </div>
            <span className="sync-label">
              <span className="status-dot" /> Auto-sync
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="empty-state appointment-empty">
              <CalendarCheck size={34} />
              <h4>No appointments yet</h4>
              <p>Appointments booked through voice will appear here.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Doctor</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Phone number</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.appointment_id}>
                      <td>
                        CL-{String(appointment.appointment_id).padStart(4, "0")}
                      </td>
                      <td>
                        <strong>{appointment.doctor_name}</strong>
                        <small>{appointment.specialty}</small>
                      </td>
                      <td>{formatDate(appointment.slot_date)}</td>
                      <td>{formatTime(appointment.slot_time)}</td>
                      <td>
                        {"••••••" + appointment.phone_number.slice(-4)}
                      </td>
                      <td>
                        <span
                          className={`appointment-status ${appointment.status.toLowerCase()}`}
                        >
                          {appointment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span><HeartPulse size={16} /> CareLine AI</span>
          <span>Powered by Pipecat · ElevenLabs · Gemini</span>
        </footer>

      </main>
    </div>
  );
}

export default App;
