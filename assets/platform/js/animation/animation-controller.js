/**
 * Animation Controller Module
 *
 * Manages animation state including play/pause, speed control, and time navigation.
 * Extracted from mission.js to centralize animation logic.
 *
 * Design: The controller is decoupled from DOM and scene specifics.
 * It uses callbacks to notify when time changes or play state changes.
 */

import { TIME_CONSTANTS as TC, UI_CONSTANTS as UC } from "../core/constants.js";

/**
 * AnimationController manages the animation timeline and playback state.
 */
export class AnimationController {
    /**
     * Create an AnimationController.
     * @param {Object} options - Configuration options
     * @param {Function} options.onTimeChange - Callback when animation time changes
     * @param {Function} options.onPlayStateChange - Callback when play/pause state changes
     * @param {Function} options.onSpeedChange - Callback when speed changes
     */
    constructor(options = {}) {
        // Callbacks
        this.onTimeChange = options.onTimeChange || (() => {});
        this.onPlayStateChange = options.onPlayStateChange || (() => {});
        this.onSpeedChange = options.onSpeedChange || (() => {});

        // Time boundaries (set via configure())
        this.startTime = 0;
        this.endTime = 0;
        this.stepDurationMs = TC.ONE_MINUTE_MS;
        this.stepsPerHop = 60; // For fast forward/backward

        // Animation state
        this.currentTime = 0;
        this.isRunning = false;
        this.stopFlag = false;

        // Speed control
        this.speedMultiplier = 1;
        this.isRealtimeSpeed = false;

        // Frame timing
        this.prevFrameTime = null;
        this.deltaFrameTime = TC.ONE_MINUTE_MS;

        // Timeout handle for stopping
        this.timeoutHandle = null;
    }

    /**
     * Configure the controller with mission-specific timing.
     * @param {Object} config - Configuration object
     * @param {number} config.startTime - Start time in milliseconds
     * @param {number} config.endTime - End time in milliseconds
     * @param {number} [config.stepDurationMs] - Step duration in milliseconds
     * @param {number} [config.stepsPerHop] - Number of steps for fast forward/backward
     */
    configure(config) {
        this.startTime = config.startTime;
        this.endTime = config.endTime;
        this.stepDurationMs = config.stepDurationMs || TC.ONE_MINUTE_MS;
        this.stepsPerHop = config.stepsPerHop || 60;

        // Initialize current time to start
        if (this.currentTime === 0 || this.currentTime < this.startTime) {
            this.currentTime = this.startTime;
        }
    }

    /**
     * Get the current animation time.
     * @returns {number} Current time in milliseconds
     */
    getTime() {
        return this.currentTime;
    }

    /**
     * Set the current animation time (with bounds checking).
     * @param {number} time - Time in milliseconds
     * @param {boolean} [notify=true] - Whether to trigger onTimeChange callback
     */
    setTime(time, notify = true) {
        // Clamp to valid range
        if (time < this.startTime) {
            this.currentTime = this.startTime;
        } else if (time > this.endTime - this.stepDurationMs) {
            this.currentTime = this.endTime - this.stepDurationMs;
        } else {
            this.currentTime = time;
        }

        if (notify) {
            this.onTimeChange(this.currentTime);
        }
    }

    /**
     * Check if animation is currently running.
     * @returns {boolean} True if running
     */
    getIsRunning() {
        return this.isRunning;
    }

    /**
     * Toggle play/pause state.
     */
    toggle() {
        if (this.isRunning) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Start playing the animation.
     */
    play() {
        // If at end, restart from beginning
        if (this.currentTime >= this.endTime - this.stepDurationMs) {
            this.currentTime = this.startTime;
        }

        this.isRunning = true;
        this.stopFlag = false;
        this.onPlayStateChange(true);
    }

    /**
     * Pause the animation.
     */
    pause() {
        this.isRunning = false;
        this.stopFlag = true;

        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }

        this.onPlayStateChange(false);
    }

    /**
     * Alias for pause() - stops the animation.
     */
    stop() {
        this.pause();
    }

    /**
     * Step forward by one step.
     */
    stepForward() {
        this.setTime(this.currentTime + this.stepDurationMs);
    }

    /**
     * Step backward by one step.
     */
    stepBackward() {
        this.setTime(this.currentTime - this.stepDurationMs);
    }

    /**
     * Fast forward by multiple steps.
     */
    fastForward() {
        this.setTime(this.currentTime + this.stepsPerHop * this.stepDurationMs);
    }

    /**
     * Fast backward by multiple steps.
     */
    fastBackward() {
        this.setTime(this.currentTime - this.stepsPerHop * this.stepDurationMs);
    }

    /**
     * Go to the start of the animation.
     */
    goToStart() {
        this.pause();
        this.setTime(this.startTime);
    }

    /**
     * Go to the end of the animation.
     */
    goToEnd() {
        this.pause();
        this.setTime(this.endTime - this.stepDurationMs);
    }

    /**
     * Go to a specific event time.
     * @param {number} time - Event time in milliseconds
     */
    goToEvent(time) {
        this.pause();
        this.setTime(time);
    }

    /**
     * Go to the current real-world time (if within bounds).
     */
    goToNow() {
        this.pause();
        this.setTime(Date.now());
    }

    /**
     * Increase animation speed.
     */
    faster() {
        if (this.isRealtimeSpeed) {
            this.isRealtimeSpeed = false;
            this.speedMultiplier = (this.deltaFrameTime / TC.ONE_MINUTE_MS) * UC.SPEED_CHANGE_FACTOR;
        } else {
            this.speedMultiplier *= UC.SPEED_CHANGE_FACTOR;
        }
        this.onSpeedChange(this.speedMultiplier, this.isRealtimeSpeed);
    }

    /**
     * Decrease animation speed.
     */
    slower() {
        if (this.isRealtimeSpeed) {
            this.isRealtimeSpeed = false;
            this.speedMultiplier = (this.deltaFrameTime / TC.ONE_MINUTE_MS) / UC.SPEED_CHANGE_FACTOR;
        } else {
            this.speedMultiplier /= UC.SPEED_CHANGE_FACTOR;
        }
        this.onSpeedChange(this.speedMultiplier, this.isRealtimeSpeed);
    }

    /**
     * Reset speed to 1x.
     */
    resetSpeed() {
        this.isRealtimeSpeed = false;
        this.speedMultiplier = 1;
        this.onSpeedChange(this.speedMultiplier, this.isRealtimeSpeed);
    }

    /**
     * Set realtime speed mode.
     */
    setRealtimeSpeed() {
        this.isRealtimeSpeed = true;
        this.onSpeedChange(this.speedMultiplier, this.isRealtimeSpeed);
    }

    /**
     * Get current speed multiplier.
     * @returns {number} Speed multiplier
     */
    getSpeedMultiplier() {
        return this.speedMultiplier;
    }

    /**
     * Check if in realtime speed mode.
     * @returns {boolean} True if realtime
     */
    getIsRealtimeSpeed() {
        return this.isRealtimeSpeed;
    }

    /**
     * Called each animation frame to advance time if running.
     * Should be called from the main animation loop.
     * @param {number} currentFrameTime - Current timestamp from performance.now() or Date.now()
     * @returns {boolean} True if time was updated
     */
    tick(currentFrameTime) {
        // Calculate delta time
        if (this.prevFrameTime !== null) {
            this.deltaFrameTime = currentFrameTime - this.prevFrameTime;
        }
        this.prevFrameTime = currentFrameTime;

        if (!this.isRunning) {
            return false;
        }

        // Advance time based on speed mode
        let newTime;
        if (this.isRealtimeSpeed) {
            newTime = this.currentTime + this.deltaFrameTime;
        } else {
            newTime = this.currentTime + this.speedMultiplier * TC.ONE_MINUTE_MS;
        }

        // Check bounds
        if (newTime > this.endTime - this.stepDurationMs) {
            newTime = this.endTime - this.stepDurationMs;
            this.currentTime = newTime;
            this.pause(); // Stop at end
            this.onTimeChange(this.currentTime);
            return true;
        }

        this.currentTime = newTime;
        this.onTimeChange(this.currentTime);
        return true;
    }

    /**
     * Dispose of the controller and clean up.
     */
    dispose() {
        this.pause();
        this.onTimeChange = () => {};
        this.onPlayStateChange = () => {};
        this.onSpeedChange = () => {};
    }
}
