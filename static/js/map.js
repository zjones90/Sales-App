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

    // --- Functions ---
    const generatePopupContent = (lead) => {
        // Simplified popup, now just shows info. The marker itself will be clickable.
        return `<b>${lead.name || 'Unnamed Lead'}</b><br>${lead.status}`;
    };

    const addLeadMarker = (lead) => {
        if (lead.address && lead.address.lat && lead.address.lng) {
            const marker = L.marker([lead.address.lat, lead.address.lng]);
            marker.bindPopup(generatePopupContent(lead));
            marker.leadData = lead; // Store full lead data on the marker

            // Make the marker clickable to navigate to the lead detail page
            marker.on('click', () => {
                window.location.href = `/leads/${lead.id}`;
            });

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

    // --- Event Listeners ---
    document.querySelectorAll('#filter-container input').forEach(cb => cb.addEventListener('change', updateMapFilters));

    // New lead creation on map click (simplified)
    map.on('click', async (e) => {
        const leadName = prompt("Enter new lead name:");
        if (!leadName) return; // Exit if user cancels or enters nothing

        // For simplicity, we're only asking for the name.
        // The address is the clicked point. Phone/notes can be added on the detail page.
        const newLead = {
            name: leadName,
            phone: '', // Initially blank
            address: { lat: e.latlng.lat, lng: e.latlng.lng }
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLead),
            });
            if (response.ok) {
                const createdLead = await response.json();
                // Immediately redirect to the new lead's detail page
                window.location.href = `/leads/${createdLead.id}`;
            } else {
                alert('Failed to create lead.');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
        }
    });

    // --- Initial Load ---
    loadLeads();
});
