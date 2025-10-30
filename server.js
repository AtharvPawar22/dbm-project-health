const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve your HTML/CSS/JS files

// SQLite Database Setup
const dbPath = path.join(__dirname, 'healthvault.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('✗ Error opening database:', err.message);
    } else {
        console.log('✓ Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database table
function initializeDatabase() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS medical_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine TEXT NOT NULL,
            dosage TEXT NOT NULL,
            duration TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            condition TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    db.run(createTableSQL, (err) => {
        if (err) {
            console.error('✗ Error creating table:', err.message);
        } else {
            console.log('✓ Database table ready');
            
            // Check if we need sample data
            db.get('SELECT COUNT(*) as count FROM medical_records', (err, row) => {
                if (!err && row.count === 0) {
                    insertSampleData();
                }
            });
        }
    });
}

// Insert sample data
function insertSampleData() {
    const sampleData = [
        ['Aspirin', '500mg', '7 days', '2024-10-15', '2024-10-22', 'Headache'],
        ['Amoxicillin', '250mg', '10 days', '2024-09-20', '2024-09-30', 'Throat Infection'],
        ['Vitamin D', '1000 IU', '30 days', '2024-10-01', '2024-10-31', 'Deficiency']
    ];
    
    const insertSQL = `
        INSERT INTO medical_records (medicine, dosage, duration, start_date, end_date, condition)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    sampleData.forEach(data => {
        db.run(insertSQL, data, (err) => {
            if (err) console.error('Error inserting sample data:', err.message);
        });
    });
    
    console.log('✓ Sample data inserted');
}

// API Routes

// Get all medical records
app.get('/api/records', (req, res) => {
    const sql = 'SELECT * FROM medical_records ORDER BY start_date DESC';
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching records:', err.message);
            return res.status(500).json({ error: 'Failed to fetch records' });
        }
        res.json(rows);
    });
});

// Get a single record by ID
app.get('/api/records/:id', (req, res) => {
    const sql = 'SELECT * FROM medical_records WHERE id = ?';
    
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching record:', err.message);
            return res.status(500).json({ error: 'Failed to fetch record' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json(row);
    });
});

// Add a new medical record
app.post('/api/records', (req, res) => {
    const { medicine, dosage, duration, startDate, endDate, condition } = req.body;
    
    // Validation
    if (!medicine || !dosage || !duration || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const sql = `
        INSERT INTO medical_records (medicine, dosage, duration, start_date, end_date, condition)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [medicine, dosage, duration, startDate, endDate, condition || null], function(err) {
        if (err) {
            console.error('Error adding record:', err.message);
            return res.status(500).json({ error: 'Failed to add record' });
        }
        
        const newRecord = {
            id: this.lastID,
            medicine,
            dosage,
            duration,
            startDate,
            endDate,
            condition
        };
        
        res.status(201).json(newRecord);
    });
});

// Update a medical record
app.put('/api/records/:id', (req, res) => {
    const { medicine, dosage, duration, startDate, endDate, condition } = req.body;
    const { id } = req.params;
    
    const sql = `
        UPDATE medical_records 
        SET medicine = ?, dosage = ?, duration = ?, start_date = ?, end_date = ?, condition = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    db.run(sql, [medicine, dosage, duration, startDate, endDate, condition || null, id], function(err) {
        if (err) {
            console.error('Error updating record:', err.message);
            return res.status(500).json({ error: 'Failed to update record' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json({ message: 'Record updated successfully' });
    });
});

// Delete a medical record
app.delete('/api/records/:id', (req, res) => {
    const sql = 'DELETE FROM medical_records WHERE id = ?';
    
    db.run(sql, [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting record:', err.message);
            return res.status(500).json({ error: 'Failed to delete record' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json({ message: 'Record deleted successfully' });
    });
});

// Search records
app.get('/api/records/search/:term', (req, res) => {
    const searchTerm = `%${req.params.term}%`;
    
    const sql = `
        SELECT * FROM medical_records 
        WHERE medicine LIKE ? 
        OR dosage LIKE ? 
        OR condition LIKE ? 
        OR start_date LIKE ?
        ORDER BY start_date DESC
    `;
    
    db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
            console.error('Error searching records:', err.message);
            return res.status(500).json({ error: 'Failed to search records' });
        }
        res.json(rows);
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('\n✓ Database connection closed');
        }
        process.exit(0);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ API available at http://localhost:${PORT}/api/records`);
    console.log(`✓ Database file: ${dbPath}`);
});