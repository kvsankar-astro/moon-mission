export function createOrbitElementsActions({
    getSvgContainer,
    getConfig,
    animationScenes,
    planetProperties,
    PC,
    PIXELS_PER_AU,
    getZoomFactor,
    setEpochJD,
    setEpochDate,
}) {
    function processOrbitElementsData() {
        const svgContainer = getSvgContainer();
        if (!svgContainer) {
            console.debug(
                "SVG container not initialized, skipping processOrbitElementsData",
            );
            return;
        }

        const config = getConfig();

        for (let i = 0; i < animationScenes[config].planetsForOrbits.length; ++i) {
            const planetKey = animationScenes[config].planetsForOrbits[i];
            const planetProps = planetProperties[planetKey];
            const planetId = planetProps.id;
            const planet = animationScenes[config].orbits[planetId];
            const elements = planet.elements;

            for (const jd in elements) {
                // only 1 is expected
                const element = elements[jd];
                setEpochJD(jd);
                setEpochDate(element.date);

                const cx =
                    -1 *
                    (element.a / PC.KM_PER_AU) *
                    element.ec *
                    PIXELS_PER_AU;
                const cy = 0 * PIXELS_PER_AU;
                const rx = (element.a / PC.KM_PER_AU) * PIXELS_PER_AU;
                const ry = rx * Math.sqrt(1 - element.ec * element.ec);

                let angle = parseFloat(element.om) + parseFloat(element.w);
                while (angle >= PC.DEGREES_PER_CIRCLE) angle -= PC.DEGREES_PER_CIRCLE;
                angle = -1 * angle;

                svgContainer
                    .append("ellipse")
                    .attr("id", "ellipse-orbit-" + planetKey)
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("rx", rx)
                    .attr("ry", ry)
                    .attr("stroke", planetProps.orbitcolor)
                    .attr("stroke-width", 1.0 / getZoomFactor())
                    .attr("fill", "none")
                    .attr("transform", "rotate(" + angle + " 0 0)");
            }
        }
    }

    return { processOrbitElementsData };
}

