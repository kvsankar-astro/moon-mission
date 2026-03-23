export function computeLandingTimesUpdate({ globalConfig, createUTCTimestamp }) {
    if (globalConfig?.landing?.enabled) {
        const cfg = globalConfig.landing;
        const startLandingTime = createUTCTimestamp(
            parseInt(cfg.start_year),
            parseInt(cfg.start_month),
            parseInt(cfg.start_day),
            parseInt(cfg.start_hour),
            parseInt(cfg.start_minute),
        );
        const endLandingTime = createUTCTimestamp(
            parseInt(cfg.stop_year),
            parseInt(cfg.stop_month),
            parseInt(cfg.stop_day),
            parseInt(cfg.stop_hour),
            parseInt(cfg.stop_minute),
        );

        return {
            startLandingTime,
            endLandingTime,
            log: {
                message: "Updated landing times from config:",
                payload: {
                    startLandingTime: new Date(startLandingTime),
                    endLandingTime: new Date(endLandingTime),
                },
            },
        };
    }

    if (!globalConfig || !globalConfig.landing) {
        return {
            log: {
                message: "Using default landing times (no config.landing found)",
            },
        };
    }

    return null;
}

export function applyLandingTimesUpdate({
    update,
    setStartLandingTime,
    setEndLandingTime,
    console,
}) {
    if (!update) return;

    if (typeof update.startLandingTime === "number") {
        setStartLandingTime?.(update.startLandingTime);
    }
    if (typeof update.endLandingTime === "number") {
        setEndLandingTime?.(update.endLandingTime);
    }

    if (update.log?.message) {
        if (update.log.payload) {
            console?.debug?.(update.log.message, update.log.payload);
        } else {
            console?.debug?.(update.log.message);
        }
    }
}

export function computeMissionEventTimes({ globalConfig }) {
    const patch = {};

    if (globalConfig?.is_lunar && globalConfig.events?.tli) {
        patch.timeTransLunarInjection = new Date(
            globalConfig.events.tli.startTime,
        ).getTime();
    }
    if (globalConfig?.is_lunar && globalConfig.events?.loi) {
        patch.timeLunarOrbitInsertion = new Date(
            globalConfig.events.loi.startTime,
        ).getTime();
    }

    return patch;
}

