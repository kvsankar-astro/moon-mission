function disposeLocationsInContainer({ locations, container }) {
    if (!Array.isArray(locations) || !container) return locations ?? [];

    const remaining = [];
    for (const location of locations) {
        if (!location) continue;
        if (location.parent !== container) {
            remaining.push(location);
            continue;
        }

        if (location.geometry) {
            location.geometry.dispose();
        }
        if (location.material) {
            location.material.dispose();
        }
        container.remove(location);
    }
    return remaining;
}

function setLocationsVisible(locations, visible) {
    if (!Array.isArray(locations)) return;
    for (const location of locations) {
        if (location) location.visible = visible;
    }
}

export function createLocationActions({
    THREE,
    sphericalToCartesian,
    degreesToRadians,
    COL,
    getEarthRadius,
    getMoonRadius,
    getGlobalConfig,
    getViewCraters,
}) {
    function plotEarthLocation({ scene, longRads, latRads, color }) {
        const earthRadius = getEarthRadius();
        if (!scene?.earthContainer || !Number.isFinite(earthRadius)) return null;

        const locationRadiusScale = 0.001;
        const geometry = new THREE.SphereGeometry(locationRadiusScale * earthRadius, 100, 100);
        const material = new THREE.MeshPhysicalMaterial({
            color: COL.BLACK,
            emissive: color,
            reflectivity: 0.0,
            transparent: false,
            opacity: 0.2,
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = false;
        sphere.receiveShadow = false;

        const radiusScale = 1 - locationRadiusScale / 2;
        const pos = sphericalToCartesian(radiusScale * earthRadius, longRads, latRads);
        sphere.position.set(pos.x, pos.y, pos.z);

        if (!Array.isArray(scene.locations)) scene.locations = [];
        scene.locations.push(sphere);
        scene.earthContainer.add(sphere);
        return sphere;
    }

    function plotMoonLocation({ scene, longRads, latRads, color }) {
        const globalConfig = getGlobalConfig();
        if (!globalConfig || !globalConfig.is_lunar) return null;

        const moonRadius = getMoonRadius();
        if (!scene?.moonContainer || !Number.isFinite(moonRadius)) return null;

        const locationRadiusScale = 0.005;
        const geometry = new THREE.SphereGeometry(locationRadiusScale * moonRadius, 100, 100);
        const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            transparent: false,
            opacity: 1.0,
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = false;
        sphere.receiveShadow = false;

        const radiusScale = 1.005 - locationRadiusScale / 2;
        const pos = sphericalToCartesian(radiusScale * moonRadius, longRads, latRads);
        sphere.position.set(pos.x, pos.y, pos.z);

        if (!Array.isArray(scene.locations)) scene.locations = [];
        scene.locations.push(sphere);
        scene.moonContainer.add(sphere);
        return sphere;
    }

    function addEarthLocations({ scene }) {
        if (!scene) return;

        scene.dwingeloo = plotEarthLocation({
            scene,
            longRads: degreesToRadians(6.39616944444),
            latRads: degreesToRadians(52.8120194444),
            color: "#FF0000",
        });
        scene.chennai = plotEarthLocation({
            scene,
            longRads: degreesToRadians(80.2707),
            latRads: degreesToRadians(13.0827),
            color: "#FF0000",
        });

        setLocationsVisible(scene.locations, getViewCraters());
    }

    function addMoonLocations({ scene }) {
        const globalConfig = getGlobalConfig();
        if (!scene || !globalConfig || !globalConfig.is_lunar) return;

        if (globalConfig.landingSites) {
            globalConfig.landingSites.forEach((site) => {
                plotMoonLocation({
                    scene,
                    longRads: degreesToRadians(site.longitude),
                    latRads: degreesToRadians(site.latitude),
                    color: site.color,
                });
            });
        }

        setLocationsVisible(scene.locations, getViewCraters());
    }

    function disposeEarthLocations({ scene }) {
        if (!scene) return;

        scene.locations = disposeLocationsInContainer({
            locations: scene.locations,
            container: scene.earthContainer,
        });

        scene.dwingeloo = null;
        scene.chennai = null;
    }

    function disposeMoonLocations({ scene }) {
        const globalConfig = getGlobalConfig();
        if (!scene || !globalConfig || !globalConfig.is_lunar) return;

        scene.locations = disposeLocationsInContainer({
            locations: scene.locations,
            container: scene.moonContainer,
        });
    }

    return {
        addEarthLocations,
        addMoonLocations,
        disposeEarthLocations,
        disposeMoonLocations,
    };
}

