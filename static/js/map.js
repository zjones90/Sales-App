document.addEventListener('DOMContentLoaded', () => {
    // Initialize the map and set its view to a default location
    const map = L.map('map').setView([39.8283, -98.5795], 4); // Centered on USA

    // Add a tile layer from OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Function to add a lead marker to the map
    const addLeadMarker = (lead) => {
        if (lead.address && lead.address.lat && lead.address.lng) {
            const marker = L.marker([lead.address.lat, lead.address.lng]).addTo(map);
            marker.bindPopup(`<b>${lead.name || 'Unnamed Lead'}</b><br>${lead.phone || ''}`);
        }
    };

    // Fetch existing leads and add them to the map
    const loadLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            const leads = await response.json();
            leads.forEach(addLeadMarker);
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    // Handle map click to create a new lead
    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;

        // Use simple prompts to get lead info
        const leadName = prompt("Enter lead name:");
        if (leadName === null) return; // User cancelled

        const leadPhone = prompt("Enter lead phone number:");
        if (leadPhone === null) return; // User cancelled

        const newLead = {
            name: leadName,
            phone: leadPhone,
            address: { lat, lng }, // Storing lat/lng in address object
            notes: '',
            status: 'New'
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newLead),
            });

            if (response.ok) {
                const createdLead = await response.json();
                addLeadMarker(createdLead);
                alert('Lead created successfully!');
            } else {
                alert('Failed to create lead.');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
            alert('An error occurred.');
        }
    });

    // Initial load of leads
    loadLeads();
});
