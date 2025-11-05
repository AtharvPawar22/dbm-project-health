-- Create medical_records table
CREATE TABLE IF NOT EXISTS medical_records (
    id SERIAL PRIMARY KEY,
    medicine VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    condition VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better search performance
CREATE INDEX idx_medicine ON medical_records(medicine);
CREATE INDEX idx_start_date ON medical_records(start_date DESC);
CREATE INDEX idx_condition ON medical_records(condition);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on record modification
CREATE TRIGGER update_medical_records_updated_at 
    BEFORE UPDATE ON medical_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();