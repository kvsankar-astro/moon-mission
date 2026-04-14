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
ifeq ($(OS),Windows_NT)
NODE ?= C:/PROGRA~1/nodejs/node.exe
else
NODE ?= node
endif

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
	$(NODE) test/server-manager.js start

# Stop the test server
server-stop:
	$(NODE) test/server-manager.js stop

# Check server status
server-status:
	$(NODE) test/server-manager.js status

# Run all tests (headless)
test:
	$(NODE) test/run-ui-tests.js test

# Run tests with fail-fast
test-fast:
	$(NODE) test/run-ui-tests.js test-fast

# Run tests with visible browser
test-headed:
	$(NODE) test/run-ui-tests.js test-headed

# Regenerate baseline screenshots
baseline:
	@echo "Clearing existing baselines..."
	-rm -f test/screenshots/baseline/*.png
	@echo "Running tests to generate new baselines (headless)..."
	$(NODE) test/run-ui-tests.js baseline
	@echo "Baselines generated in test/screenshots/baseline/"

# Clean up test artifacts
clean: server-stop
	@echo "Cleaning test artifacts..."
	-rm -f .test-server.pid .test-server.json .test-server.log
	-rm -f test/screenshots/current/*.png
	-rm -f test/screenshots/diff/*.png
	@echo "Clean complete"
