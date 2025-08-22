document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const modal = document.getElementById('add-lead-modal');
    const closeButton = document.querySelector('.close-button');
    const addLeadForm = document.getElementById('add-lead-form');
    const leadLatInput = document.getElementById('lead-lat');
    const leadLngInput = document.getElementById('lead-lng');
    const leadAddressInput = document.getElementById('lead-address-modal');
    const addressSuggestions = document.getElementById('address-suggestions');

    const addLeadMarker = (lead) => {
        if (lead.address && lead.address.lat && lead.address.lng) {
            const marker = L.marker([lead.address.lat, lead.address.lng]).addTo(map);
            const address = lead.address.full_address || `${lead.address.lat.toFixed(4)}, ${lead.address.lng.toFixed(4)}`;
            marker.bindPopup(`<b>${lead.name || 'Unnamed Lead'}</b><br>${address}`);
        }
    };

    const loadLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            const leads = await response.json();
            leads.forEach(addLeadMarker);
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    const openModal = (latlng) => {
        leadLatInput.value = latlng.lat;
        leadLngInput.value = latlng.lng;
        modal.style.display = 'block';
    };

    const closeModal = () => {
        modal.style.display = 'none';
        addLeadForm.reset();
        addressSuggestions.innerHTML = '';
    };

    map.on('click', (e) => {
        openModal(e.latlng);
    });

    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeModal();
        }
    });

    leadAddressInput.addEventListener('keyup', async (e) => {
        const query = e.target.value;
        console.log(`Query: ${query}`);
        if (query.length < 3) {
            addressSuggestions.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const suggestions = await response.json();
            console.log('Suggestions:', suggestions);

            addressSuggestions.innerHTML = '';
            suggestions.forEach(place => {
                const div = document.createElement('div');
                div.textContent = place.display_name;
                div.addEventListener('click', () => {
                    leadAddressInput.value = place.display_name;
                    leadLatInput.value = place.lat;
                    leadLngInput.value = place.lon;
                    addressSuggestions.innerHTML = '';
                });
                addressSuggestions.appendChild(div);
            });
        } catch (error) {
            console.error('Error fetching address suggestions:', error);
        }
    });

    addLeadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(addLeadForm);
        const name = formData.get('name');
        const phone = formData.get('phone');
        const full_address = leadAddressInput.value;
        const lat = parseFloat(leadLatInput.value);
        const lng = parseFloat(leadLngInput.value);

        const newLead = {
            name,
            phone,
            address: { lat, lng, full_address },
            status: 'New'
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLead),
            });

            if (response.ok) {
                const createdLead = await response.json();
                addLeadMarker(createdLead);
                closeModal();
                alert('Lead created successfully!');
            } else {
                alert('Failed to create lead.');
            }
        } catch (error) {
            console.error('Error creating lead:', error);
            alert('An error occurred.');
        }
    });

    loadLeads();
});
