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
    const statusInput = document.getElementById('edit-status');


    // --- Functions ---
    const generatePopupContent = (lead) => {
        const addressStr = lead.address?.full_address || 'No address provided';
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

    const buildControlsFromStatuses = (statuses) => {
        const filterContainer = document.getElementById('filter-container');
        const statusDropdown = document.getElementById('edit-status');

        // Clear any existing placeholders
        filterContainer.innerHTML = '<h4>Filter by Status</h4>';
        statusDropdown.innerHTML = '';

        statuses.forEach(status => {
            // Build filter checkboxes
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'status';
            checkbox.value = status;
            checkbox.checked = true;
            checkbox.addEventListener('change', updateMapFilters);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${status}`));
            optionDiv.appendChild(label);
            filterContainer.appendChild(optionDiv);

            // Build edit modal dropdown options
            const dropdownOption = document.createElement('option');
            dropdownOption.value = status;
            dropdownOption.textContent = status;
            statusDropdown.appendChild(dropdownOption);
        });
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
        editAddressInput.value = lead.address?.full_address || '';
        notesInput.value = lead.notes.join('\n');
        statusInput.value = lead.status;
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
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('edit-lead-btn')) {
            const leadId = e.target.dataset.leadId;
            openEditModal(leadId);
        }
    });

    map.on('click', (e) => {
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
                full_address: editAddressInput.value
            },
            notes: notesInput.value.split('\n').filter(n => n.trim() !== ''),
            status: statusInput.value,
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

    const centerOnMeButton = document.getElementById('center-on-me');
    centerOnMeButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 13);
            }, (error) => {
                console.error('Error getting location:', error);
                alert('Could not get your location. Please ensure you have granted permission.');
            });
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    });

    // --- Main App Initialization ---
    const initializeMap = async () => {
        try {
            const response = await fetch('/api/statuses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const statuses = await response.json();
            buildControlsFromStatuses(statuses);
            await loadLeads();
        } catch (error) {
            console.error('Error initializing map:', error);
            document.getElementById('filter-container').innerHTML += '<p>Error loading filters.</p>';
        }
    };

    initializeMap();
});