
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
}

export interface AppointmentSlot {
  slot_id: number;
  doctor_name: string;
  specialty: string;
  slot_date: string;
  slot_time: string;
}

export interface Appointment {
  appointment_id: number;
  doctor_name: string;
  specialty: string;
  slot_date: string;
  slot_time: string;
  phone_number: string;
  status: "BOOKED" | "CANCELLED";
  created_at: string;
}

async function fetchData<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getDoctors(): Promise<Doctor[]> {
  return fetchData<Doctor[]>("/api/doctors");
}

export function getSlots(): Promise<AppointmentSlot[]> {
  return fetchData<AppointmentSlot[]>("/api/slots");
}

export function getAppointments(): Promise<Appointment[]> {
  return fetchData<Appointment[]>("/api/appointments");
}

export async function getDashboardData() {
  const [doctors, slots, appointments] = await Promise.all([
    getDoctors(),
    getSlots(),
    getAppointments(),
  ]);

  return { doctors, slots, appointments };
}
