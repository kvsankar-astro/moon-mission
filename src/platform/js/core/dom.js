/**
 * DOM Utilities Module
 * 
 * Centralized DOM manipulation functions to improve separation of concerns
 * and make the codebase more maintainable.
 * Extracted from mission.js to isolate DOM interactions.
 */

import * as d3 from "d3";

// ===================================
// Element Selection Utilities
// ===================================

/**
 * Safely get element by ID with optional error handling
 * @param {string} id - Element ID
 * @param {boolean} suppressWarnings - Whether to suppress console warnings for missing elements
 * @returns {HTMLElement|null} - Element or null if not found
 */
export function getElementById(id, suppressWarnings = false) {
    const element = document.getElementById(id);
    if (!element && !suppressWarnings) {
        console.warn(`Element with ID '${id}' not found`);
    }
    return element;
}

/**
 * Update text content of element by ID
 * @param {string} id - Element ID
 * @param {string} text - Text to set
 * @param {boolean} suppressWarnings - Whether to suppress warnings for missing elements
 * @returns {boolean} - Success status
 */
export function updateElementText(id, text, suppressWarnings = false) {
    const element = getElementById(id, suppressWarnings);
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

/**
 * Update HTML content of element by ID
 * @param {string} id - Element ID
 * @param {string} html - HTML to set
 * @param {boolean} suppressWarnings - Whether to suppress warnings for missing elements
 * @returns {boolean} - Success status
 */
export function updateElementHTML(id, html, suppressWarnings = false) {
    const element = getElementById(id, suppressWarnings);
    if (element) {
        element.innerHTML = html;
        return true;
    }
    return false;
}

/**
 * Update element style property
 * @param {string} id - Element ID
 * @param {string} property - CSS property name
 * @param {string} value - CSS property value
 * @param {boolean} suppressWarnings - Whether to suppress warnings for missing elements
 * @returns {boolean} - Success status
 */
export function updateElementStyle(id, property, value, suppressWarnings = false) {
    const element = getElementById(id, suppressWarnings);
    if (element) {
        element.style[property] = value;
        return true;
    }
    return false;
}

// ===================================
// Bulk Update Utilities
// ===================================

/**
 * Update multiple elements' text content at once
 * @param {Array<{id: string, text: string}>} updates - Array of {id, text} objects
 * @param {boolean} suppressWarnings - Whether to suppress warnings for missing elements
 * @returns {number} - Number of successful updates
 */
export function updateMultipleElementsText(updates, suppressWarnings = false) {
    let successCount = 0;
    updates.forEach(({id, text}) => {
        if (updateElementText(id, text, suppressWarnings)) {
            successCount++;
        }
    });
    return successCount;
}

/**
 * Update multiple elements' HTML content at once
 * @param {Array<{id: string, html: string}>} updates - Array of {id, html} objects
 * @param {boolean} suppressWarnings - Whether to suppress warnings for missing elements
 * @returns {number} - Number of successful updates
 */
export function updateMultipleElementsHTML(updates, suppressWarnings = false) {
    let successCount = 0;
    updates.forEach(({id, html}) => {
        if (updateElementHTML(id, html, suppressWarnings)) {
            successCount++;
        }
    });
    return successCount;
}

// ===================================
// D3.js Integration Utilities
// ===================================

/**
 * Safe D3 element selection with error handling
 * @param {string} selector - D3 selector string
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {any} - D3 selection object
 */
export function d3Select(selector, suppressWarnings = false) {
    const selection = d3.select(selector);
    if (selection.empty() && !suppressWarnings) {
        console.warn(`D3 selection '${selector}' is empty`);
    }
    return selection;
}

/**
 * Safe D3 multiple element selection with error handling
 * @param {string} selector - D3 selector string
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {any} - D3 selection object
 */
export function d3SelectAll(selector, suppressWarnings = false) {
    const selection = d3.selectAll(selector);
    if (selection.empty() && !suppressWarnings) {
        console.warn(`D3 selectAll '${selector}' is empty`);
    }
    return selection;
}

/**
 * Update D3 element text content
 * @param {string} selector - D3 selector string
 * @param {string} text - Text to set
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {boolean} - Success status
 */
export function updateD3ElementText(selector, text, suppressWarnings = false) {
    const selection = d3Select(selector, suppressWarnings);
    if (!selection.empty()) {
        selection.text(text);
        return true;
    }
    return false;
}

/**
 * Update D3 element HTML content
 * @param {string} selector - D3 selector string
 * @param {string} html - HTML to set
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {boolean} - Success status
 */
export function updateD3ElementHTML(selector, html, suppressWarnings = false) {
    const selection = d3Select(selector, suppressWarnings);
    if (!selection.empty()) {
        selection.html(html);
        return true;
    }
    return false;
}

/**
 * Update D3 element attribute
 * @param {string} selector - D3 selector string
 * @param {string} attribute - Attribute name
 * @param {string} value - Attribute value
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {boolean} - Success status
 */
export function updateD3ElementAttribute(selector, attribute, value, suppressWarnings = false) {
    const selection = d3Select(selector, suppressWarnings);
    if (!selection.empty()) {
        selection.attr(attribute, value);
        return true;
    }
    return false;
}

/**
 * Update D3 element style
 * @param {string} selector - D3 selector string
 * @param {string} property - CSS property name
 * @param {string} value - CSS property value
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {boolean} - Success status
 */
export function updateD3ElementStyle(selector, property, value, suppressWarnings = false) {
    const selection = d3Select(selector, suppressWarnings);
    if (!selection.empty()) {
        selection.style(property, value);
        return true;
    }
    return false;
}

/**
 * Update D3 element property (for form controls)
 * @param {string} selector - D3 selector string
 * @param {string} property - Property name
 * @param {any} value - Property value
 * @param {boolean} suppressWarnings - Whether to suppress warnings for empty selections
 * @returns {boolean} - Success status
 */
export function updateD3ElementProperty(selector, property, value, suppressWarnings = false) {
    const selection = d3Select(selector, suppressWarnings);
    if (!selection.empty()) {
        selection.property(property, value);
        return true;
    }
    return false;
}

// ===================================
// Specialized Update Functions
// ===================================

/**
 * Update FPS counter display
 * @param {number} fps - Frames per second value
 * @returns {boolean} - Success status
 */
export function updateFPSCounter(fps) {
    return updateElementText('fps-counter', `FPS: ${fps.toFixed(0)}`, true);
}

/**
 * Update spacecraft mnemonic display
 * @param {string} mnemonic - Spacecraft mnemonic/short name
 * @returns {boolean} - Success status
 */
export function updateSpacecraftMnemonic(mnemonic) {
    return updateElementText('spacecraft-mnemonic', mnemonic, true);
}

/**
 * Set FPS counter visibility
 * @param {boolean} visible - Whether FPS counter should be visible
 * @returns {boolean} - Success status
 */
export function setFPSCounterVisibility(visible) {
    return updateElementStyle('fps-counter', 'display', visible ? 'block' : 'none', true);
}

/**
 * Clear event info display
 * @returns {boolean} - Success status
 */
export function clearEventInfo() {
    const element = getElementById("eventinfo", true);
    if (element) {
        element.title = "";
    }
    return updateD3ElementText("#eventinfo", "", true);
}

/**
 * Update event info display
 * @param {string} message - Event info message
 * @returns {boolean} - Success status
 */
export function updateEventInfo(message) {
    const element = getElementById("eventinfo", true);
    if (element) {
        element.title = String(message || "");
    }
    return updateD3ElementText("#eventinfo", message, true);
}

/**
 * Update progress bar label
 * @param {string} message - Progress message
 * @returns {boolean} - Success status
 */
export function updateProgressLabel(message) {
    return updateD3ElementHTML("#progressbar-label", message, true);
}

/**
 * Clear progress bar label
 * @returns {boolean} - Success status
 */
export function clearProgressLabel() {
    return updateProgressLabel("");
}
