from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            page.goto("http://127.0.0.1:5001/")
            page.locator("#map").click(position={"x": 400, "y": 300})
            modal = page.locator("#add-lead-modal")
            expect(modal).to_be_visible()

            address_input = page.locator("#lead-address-modal")
            address_input.fill("1600 Amphitheatre Parkway, Mountain View, CA")
            address_input.dispatch_event("keyup")

            # Wait for the suggestions to appear
            suggestions = page.locator("#address-suggestions div")
            expect(suggestions.first).to_be_visible(timeout=10000)

            print("Suggestions appeared!")

            # Take a screenshot showing the suggestions
            page.screenshot(path="jules-scratch/verification/suggestions.png")

        except Exception as e:
            print(f"Verification failed: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
