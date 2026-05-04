-- ==========================================
-- DENTASSIST AI: SUPABASE CRM SCHEMA
-- Run this entirely in your Supabase SQL Editor
-- ==========================================

-- 1. Patients Table
-- This is the core CRM. The Agent will lookup patients by phone number.
CREATE TABLE patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    insurance_provider VARCHAR(255),
    insurance_id VARCHAR(100),
    dentist_notes TEXT,
    is_waitlisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for lightning-fast phone number lookups
CREATE INDEX idx_patients_phone ON patients(phone_number);

-- 2. Appointments Table
-- Tracks full appointment lifecycle so the Agent can Edit/Cancel them
CREATE TABLE appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    google_calendar_event_id VARCHAR(255), -- Stores the Google Calendar ID for editing
    service_type VARCHAR(100) NOT NULL,    -- e.g., "Exam", "Cleaning", "Emergency"
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'cancelled', 'completed'
    ai_summary_notes TEXT,                 -- Notes the AI gathered during booking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for searching appointments by patient and status
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_time ON appointments(start_time);

-- 3. Chat History Table (For N8N Postgres Memory Node)
-- If you haven't created this yet, you MUST run this for chat memory to work!
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    message JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
