document.addEventListener('DOMContentLoaded', () => {
    // --- Toast Notification Function ---
    const showToast = (message, type = 'success') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    };

    const STATUS_COLORS = {
        "New": "#007bff", // Blue
        "Contacted": "#ffc107", // Yellow
        "Measured": "#fd7e14", // Orange
        "Presented": "#20c997", // Teal
        "Signed": "#28a745", // Green
        "Dug": "#6f42c1", // Indigo
        "Completed": "#17a2b8", // Cyan
        "Lost": "#dc3545", // Red
        "Default": "#6c757d" // Grey for any other status
    };

    const getIconForStatus = (status) => {
        const color = STATUS_COLORS[status] || STATUS_COLORS['Default'];
        // A simple SVG for a pin. Using a divIcon to embed custom HTML.
        const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" style="transform: translateY(-4px);">
            <path fill="${color}" stroke="black" stroke-width="0.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
            <circle cx="12" cy="9" r="2.5" fill="white"></circle>
        </svg>`;

        return L.divIcon({
            html: iconHtml,
            className: 'custom-div-icon',
            iconSize: [30, 42],
            iconAnchor: [15, 42],
            popupAnchor: [0, -42]
        });
    };

    // --- Map Initialization ---
    const map = L.map('map').setView([39.8283, -98.5795], 4);
    let tempMarker = null; // To hold temporary markers for search
    let userMarker = null; // To hold the user's location marker
    let isFirstLocation = true; // To track if we should center the map

    const userLocationIcon = L.divIcon({
        html: `<div class="user-location-marker"></div>`,
        className: 'custom-div-icon',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    // --- Tile Layers & Layer Control ---
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    streetMap.addTo(map);
    L.control.layers({ "Street View": streetMap, "Satellite View": satelliteMap }).addTo(map);

    // --- Custom Search ---
    const searchIcon = document.getElementById('search-icon');
    const searchInput = document.getElementById('search-input');
    const searchSuggestions = document.getElementById('search-suggestions');

    const placeTemporaryMarker = (lat, lon) => {
        if (tempMarker) {
            map.removeLayer(tempMarker);
        }
        tempMarker = L.marker([lat, lon]).addTo(map);
    };

    searchIcon.addEventListener('click', () => {
        searchInput.style.display = 'block';
        searchInput.focus();
        searchIcon.style.display = 'none';
    });

    searchInput.addEventListener('input', async () => {
        const query = searchInput.value.toLowerCase();
        searchSuggestions.innerHTML = '';

        if (query.length < 2) {
            return;
        }

        // --- 1. Search existing leads ---
        const matchedLeads = Object.values(allLeads).filter(lead => {
            const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
            const nameMatch = fullName.includes(query);
            const phoneMatch = lead.phone && lead.phone.toLowerCase().includes(query);
            const addressMatch = lead.address?.full_address && lead.address.full_address.toLowerCase().includes(query);
            return nameMatch || phoneMatch || addressMatch;
        });

        if (matchedLeads.length > 0) {
            matchedLeads.forEach(lead => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
                div.innerHTML = `<b>${fullName}</b><br><small>${lead.address.full_address}</small>`;
                div.addEventListener('click', () => {
                    map.setView([lead.address.lat, lead.address.lng], 18); // Zoom in close
                    // Find and open the lead's popup
                    const marker = leadMarkers.find(m => m.leadData.id === lead.id);
                    if (marker) {
                        marker.openPopup();
                    }
                    searchInput.value = fullName;
                    searchSuggestions.innerHTML = '';
                });
                searchSuggestions.appendChild(div);
            });
            return; // Stop here if we found leads
        }

        // --- 2. If no leads found, search OpenStreetMap ---
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
            const data = await response.json();

            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = item.display_name;
                div.addEventListener('click', () => {
                    const lat = parseFloat(item.lat);
                    const lon = parseFloat(item.lon);
                    map.setView([lat, lon], 14);
                    placeTemporaryMarker(lat, lon);
                    searchInput.value = item.display_name;
                    searchSuggestions.innerHTML = '';
                });
                searchSuggestions.appendChild(div);
            });
        } catch (error) {
            console.error('Error fetching from Nominatim:', error);
        }
    });

    const centerOnUser = () => {
        if (userMarker) {
            map.setView(userMarker.getLatLng(), 17);
        } else {
            // If user location is not available yet, show a message.
            // The location watcher will center the map once it gets a lock.
            showToast('Getting your location...', 'info');
        }
    };

    // --- Center Button ---
    const centerButton = document.getElementById('center-button');
    centerButton.addEventListener('click', centerOnUser);


    // --- App State ---
    const leadMarkers = []; // Array to store all lead marker layers
    let allLeads = {}; // Object to store full lead data by ID

    // --- Modal Elements ---
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-form');
    const addLatInput = document.getElementById('add-lat');
    const addLngInput = document.getElementById('add-lng');
    const addFirstNameInput = document.getElementById('add-first-name');
    const addLastNameInput = document.getElementById('add-last-name');
    const addPhoneInput = document.getElementById('add-phone');
    const addAddressInput = document.getElementById('add-address');

    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const leadIdInput = document.getElementById('edit-lead-id');
    const nameInput = document.getElementById('edit-name');
    const phoneInput = document.getElementById('edit-phone');
    const editAddressInput = document.getElementById('edit-address');
    const notesInput = document.getElementById('edit-notes');
    const statusInput = document.getElementById('_status');


    // --- Functions ---
    const generatePopupContent = (lead) => {
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed Lead';
        const addressStr = lead.address?.full_address || 'No address provided';
        return `<b>${fullName}</b><br>
                Status: ${lead.status || 'N/A'}<br>
                ${addressStr}<br>
                ${lead.phone || ''}
                <br><a href="/leads/${lead.id}" style="font-weight: bold; color: #007bff;">View Details</a>`;
    };

    const addLeadMarker = (lead) => {
        if (lead.address && lead.address.lat && lead.address.lng) {
            const marker = L.marker([lead.address.lat, lead.address.lng], {
                icon: getIconForStatus(lead.status),
                draggable: true // Make the marker draggable
            });
            marker.bindPopup(generatePopupContent(lead));
            marker.leadData = lead; // Store full lead data on the marker

            // Add dragend event listener
            marker.on('dragend', handleMarkerDragEnd);

            leadMarkers.push(marker);
            marker.addTo(map);
        }
    };

    const handleMarkerDragEnd = async (e) => {
        const marker = e.target;
        const lead = marker.leadData;
        const newLatLng = marker.getLatLng();
        const oldLatLng = [lead.address.lat, lead.address.lng];

        // Reverse geocode the new location
        let newAddress = 'Address not found';
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLatLng.lat}&lon=${newLatLng.lng}`);
            const data = await response.json();
            if (data.display_name) {
                newAddress = data.display_name;
            }
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
        }

        // Show the custom modal
        const modal = document.getElementById('pin-drag-modal');
        document.getElementById('new-address-text').textContent = newAddress;
        modal.style.display = 'flex';

        const cancelBtn = document.getElementById('pin-drag-cancel');
        const moveOnlyBtn = document.getElementById('pin-drag-move-only');
        const updateAddressBtn = document.getElementById('pin-drag-update-address');

        const closePinModal = () => {
            modal.style.display = 'none';
            // Clean up event listeners
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            moveOnlyBtn.replaceWith(moveOnlyBtn.cloneNode(true));
            updateAddressBtn.replaceWith(updateAddressBtn.cloneNode(true));
        };

        const sendUpdate = async (updateAddress) => {
            const updatedData = {
                address: {
                    lat: newLatLng.lat,
                    lng: newLatLng.lng,
                    full_address: updateAddress ? newAddress : lead.address.full_address
                }
            };

            try {
                marker.setPopupContent('Updating...').openPopup();
                const response = await fetch(`/api/leads/${lead.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                if (response.ok) {
                    const updatedLead = await response.json();
                    allLeads[lead.id] = updatedLead;
                    marker.leadData = updatedLead;
                    showToast('Lead location updated!');
                } else {
                    marker.setLatLng(oldLatLng); // Revert on failure
                    showToast('Failed to update lead location.', 'error');
                }
            } catch (error) {
                console.error('Error updating lead location:', error);
                marker.setLatLng(oldLatLng); // Revert on error
                showToast('An error occurred.', 'error');
            } finally {
                marker.setPopupContent(generatePopupContent(marker.leadData));
                closePinModal();
            }
        };

        cancelBtn.addEventListener('click', () => {
            marker.setLatLng(oldLatLng); // Revert position
            closePinModal();
        }, { once: true });

        moveOnlyBtn.addEventListener('click', () => {
            sendUpdate(false); // Don't update address text
        }, { once: true });

        updateAddressBtn.addEventListener('click', () => {
            sendUpdate(true); // Update address text
        }, { once: true });
    };

    const updateMapFilters = () => {
        const checkedStatuses = Array.from(document.querySelectorAll('#filter-options input:checked')).map(cb => cb.value);
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        // Add 'T23:59:59' to the end date to include the entire day
        const endDateTime = endDate ? `${endDate}T23:59:59` : null;

        leadMarkers.forEach(marker => {
            const lead = marker.leadData;
            const statusMatch = checkedStatuses.includes(lead.status);

            let dateMatch = true;
            if (lead.created_at) {
                const leadDate = new Date(lead.created_at);
                if (startDate && leadDate < new Date(startDate)) {
                    dateMatch = false;
                }
                if (endDateTime && leadDate > new Date(endDateTime)) {
                    dateMatch = false;
                }
            } else if (startDate || endDate) {
                // If there's a date filter, but the lead has no created_at, it shouldn't match
                dateMatch = false;
            }

            if (statusMatch && dateMatch) {
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
        const filterOptionsContainer = document.getElementById('filter-options');
        const statusDropdown = document.getElementById('_status');

        // Clear any existing placeholders
        filterOptionsContainer.innerHTML = '';
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
            filterOptionsContainer.appendChild(optionDiv);

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
        addFirstNameInput.value = '';
        addLastNameInput.value = '';
        addPhoneInput.value = '';
        addAddressInput.value = 'Fetching address...';
        addModal.style.display = 'flex';

        // Reverse geocode
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`);
            const data = await response.json();
            if (data.address) {
                addAddressInput.value = formatAddress(data.address);
            } else {
                addAddressInput.value = data.display_name || 'Could not find address.';
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

    addAddressInput.addEventListener('input', (e) => {
        fetchAddressSuggestions(e.target.value, (suggestions) => {
            const addressSuggestions = document.getElementById('address-suggestions');
            addressSuggestions.innerHTML = '';
            suggestions.forEach(place => {
                const div = document.createElement('div');
                div.textContent = place.displayName;
                div.className = 'suggestion-item';
                div.addEventListener('click', () => {
                    addAddressInput.value = place.displayName;
                    addLatInput.value = place.lat;
                    addLngInput.value = place.lng;
                    addressSuggestions.innerHTML = '';
                });
                addressSuggestions.appendChild(div);
            });
        });
    });

    document.addEventListener('click', function(e) {
        // The edit button on the popup is gone, so this listener is no longer needed for that.
        // It could be used for other things, so we'll leave it for now but it's not strictly necessary.
    });

    document.getElementById('add-lead-fab').addEventListener('click', () => {
        // Open the modal at the current center of the map
        openAddModal(map.getCenter());
    });

    map.on('click', (e) => {
        // Prevent opening the add modal if a marker (real or temporary) was clicked
        if (e.originalEvent.target.closest('.leaflet-marker-icon') || e.originalEvent.target.closest('.leaflet-control')) {
            return;
        }
        openAddModal(e.latlng);
    });

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newLead = {
            first_name: addFirstNameInput.value,
            last_name: addLastNameInput.value,
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
                showToast('Lead created successfully!');
            } else {
                showToast('Failed to create lead.', 'error');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
            showToast('An error occurred while creating the lead.', 'error');
        }
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leadId = leadIdInput.value;
        const lead = allLeads[leadId];

        // Start with the basic data
        const updatedData = {
            name: nameInput.value,
            phone: phoneInput.value,
            notes: notesInput.value.split('\n').filter(n => n.trim() !== ''),
            status: statusInput.value,
            address: { ...lead.address } // Copy existing address object
        };

        const newAddress = editAddressInput.value;
        // Check if the address has actually changed
        if (newAddress && newAddress !== lead.address.full_address) {
            updatedData.address.full_address = newAddress;
            // Address has changed, so we need to re-geocode it
            try {
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newAddress)}&limit=1`);
                const geoData = await geoResponse.json();
                if (geoData.length > 0) {
                    updatedData.address.lat = parseFloat(geoData[0].lat);
                    updatedData.address.lng = parseFloat(geoData[0].lon);
                } else {
                    console.warn("Could not geocode the new address. Marker position will not be updated.");
                }
            } catch (geoError) {
                console.error("Error during geocoding:", geoError);
                // Proceed without updating lat/lng if geocoding fails
            }
        } else {
            // Address is unchanged, just update the text part
            updatedData.address.full_address = newAddress;
        }


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
                    // Update popup content, marker position, and icon
                    markerToUpdate.setPopupContent(generatePopupContent(updatedLead));
                    markerToUpdate.setIcon(getIconForStatus(updatedLead.status)); // Update icon
                    if (updatedLead.address.lat && updatedLead.address.lng) {
                        markerToUpdate.setLatLng([updatedLead.address.lat, updatedLead.address.lng]);
                    }
                }
                closeEditModal();
                showToast('Lead updated successfully!');
            } else {
                showToast('Failed to update lead.', 'error');
            }
        } catch (error) {
            console.error('Error updating lead:', error);
            showToast('An error occurred while updating the lead.', 'error');
        }
    });

    document.getElementById('delete-lead-btn').addEventListener('click', async () => {
        const leadId = leadIdInput.value;
        if (!leadId) return;

        if (confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/leads/${leadId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    // Remove from map
                    const markerToRemove = leadMarkers.find(m => m.leadData.id === leadId);
                    if (markerToRemove) {
                        map.removeLayer(markerToRemove);
                    }
                    // Remove from local data stores
                    const index = leadMarkers.findIndex(m => m.leadData.id === leadId);
                    if (index > -1) {
                        leadMarkers.splice(index, 1);
                    }
                    delete allLeads[leadId];

                    closeEditModal();
                    showToast('Lead deleted successfully.');
                } else {
                    showToast('Failed to delete lead.', 'error');
                }
            } catch (error) {
                console.error('Error deleting lead:', error);
                showToast('An error occurred while deleting the lead.', 'error');
            }
        }
    });

    const startLocationWatcher = () => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by this browser.', 'error');
            return;
        }

        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const latLng = [latitude, longitude];

                if (userMarker) {
                    userMarker.setLatLng(latLng);
                } else {
                    userMarker = L.marker(latLng, { icon: userLocationIcon }).addTo(map);
                }

                // Only center the map on the first location update if not centered on a lead
                if (isFirstLocation) {
                    map.setView(latLng, 17);
                    isFirstLocation = false;
                }
            },
            () => {
                showToast('Could not get your location.', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const centerOnLeadFromURL = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const lat = urlParams.get('lat');
        const lng = urlParams.get('lng');
        const zoom = urlParams.get('zoom') || 18;
        if (lat && lng) {
            map.setView([parseFloat(lat), parseFloat(lng)], parseInt(zoom));
            isFirstLocation = false; // Prevent location watcher from overriding this view
        }
    };

    // --- Event Listeners ---
    document.getElementById('filter-button').addEventListener('click', () => {
        const filterPanel = document.getElementById('filter-panel');
        const isHidden = filterPanel.style.display === 'none';
        filterPanel.style.display = isHidden ? 'block' : 'none';
    });

    document.getElementById('start-date').addEventListener('change', updateMapFilters);
    document.getElementById('end-date').addEventListener('change', updateMapFilters);

    // --- Main App Initialization ---
    const initializeMap = async () => {
        centerOnLeadFromURL(); // Center on lead first if params exist
        try {
            const response = await fetch('/api/statuses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const statuses = await response.json();
            buildControlsFromStatuses(statuses);
            await loadLeads();
            startLocationWatcher(); // Start tracking user's location
        } catch (error) {
            console.error('Error initializing map:', error);
            // Can't build a button, so just show error text.
            document.getElementById('filter-control-container').innerHTML = '<p>Error loading filters.</p>';
        }
    };

    initializeMap();

});