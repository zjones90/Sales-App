/**
 * Fetches address suggestions from Nominatim API, restricted to the US.
 * @param {string} query The address query to search for.
 * @param {function(Array<Object>)} callback The function to call with the processed suggestions.
 */
async function fetchAddressSuggestions(query, callback) {
    if (query.length < 3) {
        callback([]);
        return;
    }

    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&countrycodes=us&addressdetails=1&limit=5`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const suggestions = data.map(place => {
            const addr = place.address;
            const street = addr.road || '';
            const houseNumber = addr.house_number || '';
            const city = addr.city || addr.town || addr.village || '';
            const state = addr.state || '';
            const postcode = addr.postcode || '';

            // Construct a cleaner display name
            let displayName = `${houseNumber} ${street}, ${city}, ${state} ${postcode}`.trim().replace(/^ ,| ,$/g, '').replace(/ , ,/g, ',');
            // Fallback to Nominatim's display name if ours is empty
            if (displayName.length < 5) {
                displayName = place.display_name;
            }


            return {
                displayName: displayName,
                lat: place.lat,
                lng: place.lon,
                fullDetails: place // Keep original details if needed
            };
        });

        callback(suggestions);
    } catch (error) {
        console.error('Error fetching address suggestions:', error);
        callback([]);
    }
}
