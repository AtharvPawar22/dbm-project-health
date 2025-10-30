
const API_URL = 'http://localhost:3000/api';

let medicalRecords = [];

async function loadRecordsFromDB() {
    try {
        const response = await fetch(`${API_URL}/records`);
        if (!response.ok) throw new Error('Failed to fetch records');
        medicalRecords = await response.json();
        
        medicalRecords = medicalRecords.map(record => ({
            id: record.id,
            medicine: record.medicine,
            dosage: record.dosage,
            duration: record.duration,
            startDate: record.start_date,
            endDate: record.end_date,
            condition: record.condition || ''
        }));
        
        displayRecords();
    } catch (error) {
        console.error('Error loading records:', error);
        const container = document.getElementById('recordsContainer');
        if (container) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #dc2626; background: white; border-radius: 0.75rem; border: 2px solid #fee2e2;">⚠️ Unable to load records. Please check if the server is running on http://localhost:3000</div>';
        }
    }
}

function showHome() {
    switchSection('home');
    updateNavLinks('home');
}

function showHistory() {
    switchSection('history');
    updateNavLinks('history');
    loadRecordsFromDB(); 
}

function showAbout() {
    switchSection('about');
    updateNavLinks('about');
}

function switchSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

function updateNavLinks(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    const sectionMap = {
        'home': 0,
        'history': 1,
        'about': 2
    };
    
    if (sectionMap[activeSection] !== undefined) {
        navLinks[sectionMap[activeSection]].classList.add('active');
    }
}

function toggleAddForm() {
    const formContainer = document.getElementById('addFormContainer');
    formContainer.classList.toggle('hidden');
    
    if (!formContainer.classList.contains('hidden')) {
        document.getElementById('medicineName').focus();
    }
}

async function addRecord(event) {
    event.preventDefault();
    
    const newRecord = {
        medicine: document.getElementById('medicineName').value,
        dosage: document.getElementById('dosage').value,
        duration: document.getElementById('duration').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        condition: document.getElementById('condition').value
    };
    
    // Basic validation
    if (new Date(newRecord.startDate) > new Date(newRecord.endDate)) {
        showNotification('Start date cannot be after end date', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newRecord)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add record');
        }
        
        const savedRecord = await response.json();
        
        // Reset form
        event.target.reset();
        toggleAddForm();
        
        // Reload records from database
        await loadRecordsFromDB();
        
        // Show success message
        showNotification('Record added successfully!', 'success');
    } catch (error) {
        console.error('Error adding record:', error);
        showNotification(error.message || 'Failed to add record. Please try again.', 'error');
    }
}

async function deleteRecord(id) {
    if (!confirm('Are you sure you want to delete this record?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/records/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete record');
        }
        
        await loadRecordsFromDB();
        
        showNotification('Record deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting record:', error);
        showNotification(error.message || 'Failed to delete record. Please try again.', 'error');
    }
}

function displayRecords(recordsToDisplay = medicalRecords) {
    const container = document.getElementById('recordsContainer');
    const noRecords = document.getElementById('noRecords');
    
    if (recordsToDisplay.length === 0) {
        container.innerHTML = '';
        noRecords.style.display = 'block';
        return;
    }
    
    noRecords.style.display = 'none';
    container.innerHTML = recordsToDisplay.map(record => `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <div class="record-title">${escapeHtml(record.medicine)}</div>
                    ${record.condition ? `<span class="record-condition">${escapeHtml(record.condition)}</span>` : ''}
                </div>
            </div>
            <div class="record-details">
                <div class="detail-item">
                    <div class="detail-label">Dosage</div>
                    <div class="detail-value">${escapeHtml(record.dosage)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${escapeHtml(record.duration)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Start Date</div>
                    <div class="detail-value">${formatDate(record.startDate)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">End Date</div>
                    <div class="detail-value">${formatDate(record.endDate)}</div>
                </div>
            </div>
            <div class="record-actions">
                <button class="btn-delete" onclick="deleteRecord(${record.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function filterRecords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        displayRecords(medicalRecords);
        return;
    }
    
    const filtered = medicalRecords.filter(record => {
        return (
            record.medicine.toLowerCase().includes(searchTerm) ||
            (record.condition && record.condition.toLowerCase().includes(searchTerm)) ||
            record.dosage.toLowerCase().includes(searchTerm) ||
            record.startDate.includes(searchTerm) ||
            record.endDate.includes(searchTerm) ||
            record.duration.toLowerCase().includes(searchTerm)
        );
    });
    
    displayRecords(filtered);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    showHome();
    // Records will be loaded when history section is opened
});