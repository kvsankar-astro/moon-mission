# Makefile for Chandrayaan-3 Animation Test Infrastructure
# Cross-platform: works on Windows, macOS, and Linux
#
# Usage:
#   make test          - Run all tests (starts server, runs tests, stops server)
#   make test-fast     - Run tests with fail-fast (bail on first failure)
#   make test-headed   - Run tests with visible browser
#   make baseline      - Regenerate all baseline screenshots
#   make server-start  - Start the test server
#   make server-stop   - Stop the test server
#   make clean         - Clean up test artifacts

TEST_PORT = 8111
TEST_URL = http://localhost:$(TEST_PORT)

.PHONY: test test-fast test-headed baseline server-start server-stop server-status clean help

# Default target
help:
	@echo "Chandrayaan-3 Test Infrastructure"
	@echo ""
	@echo "Usage:"
	@echo "  make test          - Run all tests (headless)"
	@echo "  make test-fast     - Run tests, stop on first failure"
	@echo "  make test-headed   - Run tests with visible browser"
	@echo "  make baseline      - Regenerate all baseline screenshots"
	@echo "  make server-start  - Start the test server"
	@echo "  make server-stop   - Stop the test server"
	@echo "  make server-status - Check if server is running"
	@echo "  make clean         - Clean up test artifacts"

# Start the test server
server-start:
	node test/server-manager.js start

# Stop the test server
server-stop:
	node test/server-manager.js stop

# Check server status
server-status:
	node test/server-manager.js status

# Run all tests (headless)
test: server-start
	-npx cross-env HEADLESS=true VITE_TEST_BASE_URL=$(TEST_URL) npx vitest test/ui.test.js --run
	$(MAKE) server-stop

# Run tests with fail-fast
test-fast: server-start
	-npx cross-env HEADLESS=true VITE_TEST_BASE_URL=$(TEST_URL) npx vitest test/ui.test.js --run --bail=1
	$(MAKE) server-stop

# Run tests with visible browser
test-headed: server-start
	-npx cross-env HEADLESS=false VITE_TEST_BASE_URL=$(TEST_URL) npx vitest test/ui.test.js --run
	$(MAKE) server-stop

# Regenerate baseline screenshots
baseline:
	node test/server-manager.js start
	@echo "Clearing existing baselines..."
	-rm -f test/screenshots/baseline/*.png
	@echo "Running tests to generate new baselines (headless)..."
	-npx cross-env HEADLESS=true VITE_TEST_BASE_URL=$(TEST_URL) npx vitest test/ui.test.js --run
	node test/server-manager.js stop
	@echo "Baselines generated in test/screenshots/baseline/"

# Clean up test artifacts
clean: server-stop
	@echo "Cleaning test artifacts..."
	-rm -f .test-server.pid .test-server.json .test-server.log
	-rm -f test/screenshots/current/*.png
	-rm -f test/screenshots/diff/*.png
	@echo "Clean complete"
