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
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-form');
    const addLatInput = document.getElementById('add-lat');
    const addLngInput = document.getElementById('add-lng');
    const addNameInput = document.getElementById('add-name');
    const addPhoneInput = document.getElementById('add-phone');
    const addAddressInput = document.getElementById('add-address');

    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const leadIdInput = document.getElementById('edit-lead-id');
    const nameInput = document.getElementById('edit-name');
    const phoneInput = document.getElementById('edit-phone');
    const editAddressInput = document.getElementById('edit-address');
    const notesInput = document.getElementById('edit-notes');


    // --- Functions ---
    const generatePopupContent = (lead) => {
        const addressStr = lead.address?.street || 'No address provided';
        return `<b>${lead.name || 'Unnamed Lead'}</b><br>
                ${addressStr}<br>
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

    const openAddModal = async (latlng) => {
        addLatInput.value = latlng.lat;
        addLngInput.value = latlng.lng;
        addNameInput.value = '';
        addPhoneInput.value = '';
        addAddressInput.value = 'Fetching address...';
        addModal.style.display = 'flex';

        // Reverse geocode
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
            const data = await response.json();
            if (data.display_name) {
                addAddressInput.value = data.display_name;
            } else {
                addAddressInput.value = 'Could not find address.';
            }
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            addAddressInput.value = 'Could not find address.';
        }
    };

    window.closeAddModal = () => {
        addModal.style.display = 'none';
    };

    window.openEditModal = (leadId) => {
        const lead = allLeads[leadId];
        if (!lead) return;

        leadIdInput.value = lead.id;
        nameInput.value = lead.name;
        phoneInput.value = lead.phone;
        editAddressInput.value = lead.address?.street || '';
        notesInput.value = lead.notes.join('\n');
        editModal.style.display = 'flex';
    };

    window.closeEditModal = () => {
        editModal.style.display = 'none';
    };

    addAddressInput.addEventListener('keyup', async (e) => {
        const query = e.target.value;
        if (query.length < 3) {
            document.getElementById('address-suggestions').innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const suggestions = await response.json();
            const addressSuggestions = document.getElementById('address-suggestions');
            addressSuggestions.innerHTML = '';
            suggestions.forEach(place => {
                const div = document.createElement('div');
                div.textContent = place.display_name;
                div.addEventListener('click', () => {
                    addAddressInput.value = place.display_name;
                    addLatInput.value = place.lat;
                    addLngInput.value = place.lon;
                    addressSuggestions.innerHTML = '';
                });
                addressSuggestions.appendChild(div);
            });
        } catch (error) {
            console.error('Error fetching address suggestions:', error);
        }
    });

    // --- Event Listeners ---
    document.querySelectorAll('#filter-container input').forEach(cb => cb.addEventListener('change', updateMapFilters));

    map.on('popupopen', (e) => {
        const btn = e.popup._container.querySelector('.edit-lead-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const leadId = btn.dataset.leadId;
                openEditModal(leadId);
            });
        }
    });

    map.on('click', (e) => {
        // Prevent creating new leads when clicking on a marker or control
        if (e.originalEvent.target.closest('.leaflet-marker-icon') || e.originalEvent.target.closest('.leaflet-control')) {
            return;
        }
        openAddModal(e.latlng);
    });

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newLead = {
            name: addNameInput.value,
            phone: addPhoneInput.value,
            address: {
                lat: parseFloat(addLatInput.value),
                lng: parseFloat(addLngInput.value),
                full_address: addAddressInput.value
            }
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLead),
            });
            if (response.ok) {
                closeAddModal();
                await loadLeads();
            } else {
                alert('Failed to create lead.');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
        }
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leadId = leadIdInput.value;
        const lead = allLeads[leadId];
        const updatedData = {
            name: nameInput.value,
            phone: phoneInput.value,
            address: {
                ...lead.address, // Preserve original lat/lng
                street: editAddressInput.value
            },
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
                allLeads[leadId] = updatedLead;
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

    // Event listener for the "Center on Me" button
    const centerOnMeButton = document.getElementById('center-on-me');
    centerOnMeButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 13); // Zoom in closer when centering
            }, (error) => {
                console.error('Error getting location:', error);
                alert('Could not get your location. Please ensure you have granted permission.');
            });
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    });

    // --- Initial Load ---
    loadLeads();
});
