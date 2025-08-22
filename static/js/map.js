document.addEventListener('DOMContentLoaded', () => {
    // --- Map Initialization ---
    const map = L.map('map').setView([39.8283, -98.5795], 4);

    // --- Tile Layers & Layer Control ---
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    streetMap.addTo(map);
    L.control.layers({ "Street View": streetMap, "Satellite View": satelliteMap }).addTo(map);

    // --- Address Search Control ---
    const searchControl = new GeoSearch.GeoSearchControl({
        provider: new GeoSearch.OpenStreetMapProvider(),
        style: 'bar', autoClose: true, keepResult: true,
    });
    map.addControl(searchControl);

    // --- App State ---
    const leadMarkers = []; // Array to store all lead marker layers
    let allLeads = {}; // Object to store full lead data by ID

    // --- Modal Elements ---
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const leadIdInput = document.getElementById('edit-lead-id');
    const nameInput = document.getElementById('edit-name');
    const phoneInput = document.getElementById('edit-phone');
    const notesInput = document.getElementById('edit-notes');

    // --- Functions ---
    const generatePopupContent = (lead) => {
        return `<b>${lead.name || 'Unnamed Lead'}</b><br>
                ${lead.phone || ''}<br>
                <button class="edit-lead-btn" data-lead-id="${lead.id}">Edit</button>`;
    };

    const addLeadMarker = (lead) => {
        if (lead.address && lead.address.lat && lead.address.lng) {
            const marker = L.marker([lead.address.lat, lead.address.lng]);
            marker.bindPopup(generatePopupContent(lead));
            marker.leadData = lead; // Store full lead data on the marker
            leadMarkers.push(marker);
            marker.addTo(map);
        }
    };

    const updateMapFilters = () => {
        const checkedStatuses = Array.from(document.querySelectorAll('#filter-container input:checked')).map(cb => cb.value);
        leadMarkers.forEach(marker => {
            if (checkedStatuses.includes(marker.leadData.status)) {
                if (!map.hasLayer(marker)) marker.addTo(map);
            } else {
                if (map.hasLayer(marker)) marker.removeFrom(map);
            }
        });
    };

    const loadLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            const leads = await response.json();
            // Clear existing markers before loading new ones
            leadMarkers.forEach(marker => marker.removeFrom(map));
            leadMarkers.length = 0;
            allLeads = {};

            leads.forEach(lead => {
                allLeads[lead.id] = lead;
                addLeadMarker(lead);
            });
            updateMapFilters();
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    window.openEditModal = (leadId) => {
        const lead = allLeads[leadId];
        if (!lead) return;

        leadIdInput.value = lead.id;
        nameInput.value = lead.name;
        phoneInput.value = lead.phone;
        // Notes are now an array, join them with a newline for editing
        notesInput.value = lead.notes.join('\n');
        editModal.style.display = 'flex';
    };

    window.closeEditModal = () => {
        editModal.style.display = 'none';
    };

    // --- Event Listeners ---
    document.querySelectorAll('#filter-container input').forEach(cb => cb.addEventListener('change', updateMapFilters));

    // Use event delegation for edit buttons in popups
    map.on('popupopen', (e) => {
        const btn = e.popup._container.querySelector('.edit-lead-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const leadId = btn.dataset.leadId;
                openEditModal(leadId);
            });
        }
    });

    // New lead creation
    map.on('click', async (e) => {
        const leadName = prompt("Enter lead name:");
        if (leadName === null) return;
        const leadPhone = prompt("Enter lead phone number:");
        if (leadPhone === null) return;

        const newLead = {
            name: leadName, phone: leadPhone,
            address: { lat: e.latlng.lat, lng: e.latlng.lng }
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLead),
            });
            if (response.ok) {
                await loadLeads(); // Reload all leads to get the new one
            } else {
                alert('Failed to create lead.');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
        }
    });

    // Handle modal form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leadId = leadIdInput.value;
        const updatedData = {
            name: nameInput.value,
            phone: phoneInput.value,
            // Split notes back into an array by newline character
            notes: notesInput.value.split('\n').filter(n => n.trim() !== ''),
        };

        try {
            const response = await fetch(`/api/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
            });

            if (response.ok) {
                const updatedLead = await response.json();
                // Update local data
                allLeads[leadId] = updatedLead;
                // Find and update the marker
                const markerToUpdate = leadMarkers.find(m => m.leadData.id === leadId);
                if (markerToUpdate) {
                    markerToUpdate.leadData = updatedLead;
                    markerToUpdate.setPopupContent(generatePopupContent(updatedLead));
                }
                closeEditModal();
            } else {
                alert('Failed to update lead.');
            }
        } catch (error) {
            console.error('Error updating lead:', error);
        }
    });

    // --- Initial Load ---
    loadLeads();
});
