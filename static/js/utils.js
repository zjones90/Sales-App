/**
 * Fetches address suggestions from Nominatim API, restricted to the US.
 * @param {string} query The address query to search for.
 * @param {function(Array<Object>)} callback The function to call with the processed suggestions.
 */
/**
 * Constructs a clean address string from Nominatim address components.
 * @param {Object} addr The address object from a Nominatim response.
 * @returns {string} A formatted address string.
 */
function formatAddress(addr) {
    const streetPart = [addr.house_number, addr.road].filter(c => c).join(' ');
    const components = [
        streetPart,
        addr.city || addr.town || addr.village,
        addr.state,
        addr.postcode
    ];
    // Join non-empty components, separated by commas, and clean up spacing.
    return components.filter(c => c).join(', ').replace(/ ,/g, ',');
}


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
            const displayName = formatAddress(place.address);
            return {
                displayName: displayName.length > 5 ? displayName : place.display_name,
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
