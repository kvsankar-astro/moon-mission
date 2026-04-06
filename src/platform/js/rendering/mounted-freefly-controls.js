import * as THREE from "three";

export class MountedFreeFlyControls {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.domElement
     * @param {import("./camera-controller.js").CameraController} options.controller
     * @param {() => void} [options.onChange]
     */
    constructor({ domElement, controller, onChange }) {
        this.domElement = domElement;
        this.controller = controller;
        this.onChange = onChange ?? null;

        this.enabled = false;

        this.rotateSpeed = 0.004; // radians per pixel
        this.strafeSpeed = 0.002; // units per pixel (scaled by base)
        this.wheelSpeed = 0.0005; // units per wheel delta (scaled by base)

        this._dragMode = null; // "look" | "strafe"
        this._pointerId = null;
        this._lastX = 0;
        this._lastY = 0;
        this._yaw = 0;
        this._pitch = 0;

        this._tmp = new THREE.Vector3();
        this._tmp2 = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 0, 1);

        this._onPointerDown = (e) => this._handlePointerDown(e);
        this._onPointerMove = (e) => this._handlePointerMove(e);
        this._onPointerUp = (e) => this._handlePointerUp(e);
        this._onWheel = (e) => this._handleWheel(e);
        this._onContextMenu = (e) => this._handleContextMenu(e);

        this.domElement.addEventListener("pointerdown", this._onPointerDown);
        this.domElement.addEventListener("pointermove", this._onPointerMove);
        this.domElement.addEventListener("pointerup", this._onPointerUp);
        this.domElement.addEventListener("pointercancel", this._onPointerUp);
        this.domElement.addEventListener("wheel", this._onWheel, { passive: false });
        this.domElement.addEventListener("contextmenu", this._onContextMenu);
    }

    dispose() {
        this.domElement.removeEventListener("pointerdown", this._onPointerDown);
        this.domElement.removeEventListener("pointermove", this._onPointerMove);
        this.domElement.removeEventListener("pointerup", this._onPointerUp);
        this.domElement.removeEventListener("pointercancel", this._onPointerUp);
        this.domElement.removeEventListener("wheel", this._onWheel);
        this.domElement.removeEventListener("contextmenu", this._onContextMenu);
    }

    setEnabled(enabled) {
        const next = !!enabled;
        if (next === this.enabled) return;
        this.enabled = next;
        if (this.enabled) {
            this._syncYawPitchFromCamera();
        } else {
            this._dragMode = null;
            this._pointerId = null;
        }
    }

    _handleContextMenu(event) {
        if (!this.enabled) return;
        event.preventDefault();
    }

    _handlePointerDown(event) {
        if (!this.enabled) return;
        if (this._pointerId !== null) return;
        if (event.pointerType !== "mouse") return;

        const isRight = event.button === 2;
        const isLook = event.button === 0 && !event.shiftKey;
        const isStrafe = isRight || (event.button === 0 && event.shiftKey);
        if (!isLook && !isStrafe) return;

        this._dragMode = isLook ? "look" : "strafe";
        this._pointerId = event.pointerId;
        this._lastX = event.clientX;
        this._lastY = event.clientY;
        this._syncYawPitchFromCamera();

        this.domElement.setPointerCapture?.(event.pointerId);
    }

    _handlePointerMove(event) {
        if (!this.enabled) return;
        if (this._pointerId === null || event.pointerId !== this._pointerId) return;

        const dx = event.clientX - this._lastX;
        const dy = event.clientY - this._lastY;
        this._lastX = event.clientX;
        this._lastY = event.clientY;

        if (dx === 0 && dy === 0) return;

        if (this._dragMode === "look") {
            // Match the existing app feel: dragging right turns the view to the right.
            this._yaw += dx * this.rotateSpeed;
            // Dragging up should look up.
            this._pitch += dy * this.rotateSpeed;

            const limit = Math.PI / 2 - 0.01;
            this._pitch = Math.max(-limit, Math.min(limit, this._pitch));

            this._applyYawPitch();
            this._emitChange();
            return;
        }

        if (this._dragMode === "strafe") {
            const camera = this.controller?.camera;
            if (!camera) return;

            const base = this._getMotionBaseScale();
            const step = this.strafeSpeed * base;

            const forward = camera.getWorldDirection(this._tmp).normalize();
            // Right-handed: right = up × forward
            const right = this._tmp2.copy(this._up).cross(forward).normalize();

            // Drag right => move right. Drag up => move up (+Z).
            this.controller.mountOffset.addScaledVector(right, dx * step);
            this.controller.mountOffset.addScaledVector(this._up, -dy * step);

            this._emitChange();
        }
    }

    _handlePointerUp(event) {
        if (this._pointerId === null || event.pointerId !== this._pointerId) return;
        this._dragMode = null;
        this._pointerId = null;
        if (typeof this.domElement.hasPointerCapture === "function") {
            try {
                if (!this.domElement.hasPointerCapture(event.pointerId)) {
                    return;
                }
            } catch {
                return;
            }
        }
        try {
            this.domElement.releasePointerCapture?.(event.pointerId);
        } catch {
            // Ignore stale pointer IDs from browser/DOM sequencing differences.
        }
    }

    _handleWheel(event) {
        if (!this.enabled) return;
        event.preventDefault();

        const camera = this.controller?.camera;
        if (!camera) return;

        const base = this._getMotionBaseScale();
        const step = this.wheelSpeed * base;

        // Wheel up (deltaY < 0) => forward.
        const forward = camera.getWorldDirection(this._tmp).normalize();
        this.controller.mountOffset.addScaledVector(forward, -event.deltaY * step);

        this._emitChange();
    }

    _getMotionBaseScale() {
        const d = this.controller?.mountOffset?.length?.();
        return Number.isFinite(d) ? Math.max(d, 1) : 1;
    }

    _syncYawPitchFromCamera() {
        const camera = this.controller?.camera;
        if (!camera) return;

        const forward = camera.getWorldDirection(this._tmp).normalize();
        this._yaw = Math.atan2(forward.y, forward.x);
        this._pitch = Math.asin(forward.z);
    }

    _applyYawPitch() {
        const camera = this.controller?.camera;
        if (!camera) return;

        camera.up.copy(this._up);
        const cosPitch = Math.cos(this._pitch);
        const dir = this._tmp.set(
            cosPitch * Math.cos(this._yaw),
            cosPitch * Math.sin(this._yaw),
            Math.sin(this._pitch),
        );
        camera.lookAt(this._tmp2.copy(camera.position).add(dir));
    }

    _emitChange() {
        // Keep camera.position in sync immediately for visual responsiveness.
        const controller = this.controller;
        const mountPos = controller?._resolveTargetWorld?.(controller.positionMode, controller._mountWorld);
        if (mountPos && controller.camera) {
            controller.camera.position.copy(mountPos).add(controller.mountOffset);
        }

        // Notify any listeners wired to TrackballControls' EventDispatcher (used by mounted visibility).
        controller?.controls?.dispatchEvent?.({ type: "change" });

        this.onChange?.();
    }
}
