const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const pool = require('./db-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve your HTML/CSS/JS files
app.use(express.static('.')); // Serve root directory files

// Initialize database with sample data if empty
async function initializeDatabase() {
    try {
        // Check if table has data
        const countResult = await pool.query('SELECT COUNT(*) as count FROM medical_records');
        const count = parseInt(countResult.rows[0].count);
        
        if (count === 0) {
            await insertSampleData();
        }
        console.log('✓ Database initialized');
    } catch (err) {
        console.error('✗ Error initializing database:', err.message);
    }
}

// Insert sample data
async function insertSampleData() {
    const sampleData = [
        ['Aspirin', '500mg', '7 days', '2024-10-15', '2024-10-22', 'Headache'],
        ['Amoxicillin', '250mg', '10 days', '2024-09-20', '2024-09-30', 'Throat Infection'],
        ['Vitamin D', '1000 IU', '30 days', '2024-10-01', '2024-10-31', 'Deficiency']
    ];
    
    const insertSQL = `
        INSERT INTO medical_records (medicine, dosage, duration, start_date, end_date, condition)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    try {
        for (const data of sampleData) {
            await pool.query(insertSQL, data);
        }
        console.log('✓ Sample data inserted');
    } catch (err) {
        console.error('✗ Error inserting sample data:', err.message);
    }
}

// Initialize on startup
initializeDatabase();

// API Routes

// Get all medical records
app.get('/api/records', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM medical_records ORDER BY start_date DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching records:', err.message);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// Get a single record by ID
app.get('/api/records/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM medical_records WHERE id = $1',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching record:', err.message);
        res.status(500).json({ error: 'Failed to fetch record' });
    }
});

// Add a new medical record
app.post('/api/records', async (req, res) => {
    const { medicine, dosage, duration, startDate, endDate, condition } = req.body;
    
    // Validation
    if (!medicine || !dosage || !duration || !startDate || !endDate) {
        return res.status(400).json({ error: 'All required fields must be provided' });
    }
    
    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'Start date cannot be after end date' });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO medical_records (medicine, dosage, duration, start_date, end_date, condition)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [medicine, dosage, duration, startDate, endDate, condition || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding record:', err.message);
        res.status(500).json({ error: 'Failed to add record' });
    }
});

// Update a medical record
app.put('/api/records/:id', async (req, res) => {
    const { medicine, dosage, duration, startDate, endDate, condition } = req.body;
    
    // Validation
    if (!medicine || !dosage || !duration || !startDate || !endDate) {
        return res.status(400).json({ error: 'All required fields must be provided' });
    }
    
    try {
        const result = await pool.query(
            `UPDATE medical_records 
             SET medicine = $1, dosage = $2, duration = $3, 
                 start_date = $4, end_date = $5, condition = $6
             WHERE id = $7
             RETURNING *`,
            [medicine, dosage, duration, startDate, endDate, condition || null, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating record:', err.message);
        res.status(500).json({ error: 'Failed to update record' });
    }
});

// Delete a medical record
app.delete('/api/records/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM medical_records WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json({ message: 'Record deleted successfully' });
    } catch (err) {
        console.error('Error deleting record:', err.message);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});

// Search records
app.get('/api/records/search/:term', async (req, res) => {
    const searchTerm = `%${req.params.term}%`;
    
    try {
        const result = await pool.query(
            `SELECT * FROM medical_records 
             WHERE medicine ILIKE $1 
             OR dosage ILIKE $1 
             OR condition ILIKE $1 
             OR start_date::text LIKE $1
             ORDER BY start_date DESC`,
            [searchTerm]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error searching records:', err.message);
        res.status(500).json({ error: 'Failed to search records' });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'unhealthy',
            database: 'disconnected',
            error: err.message
        });
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n✓ Shutting down gracefully...');
    await pool.end();
    console.log('✓ Database connection closed');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n✓ Shutting down gracefully...');
    await pool.end();
    console.log('✓ Database connection closed');
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ API available at http://localhost:${PORT}/api/records`);
    console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
    console.log(`✓ Database: PostgreSQL`);
});