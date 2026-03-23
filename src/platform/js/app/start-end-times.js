export function createStartEndTimesResolver({
    getGlobalConfig,
    getConfig,
    createUTCTimestamp,
    oneMinuteMs,
}) {
    return function getStartAndEndTimes(_id) {
        const globalConfig = getGlobalConfig?.();
        const config = getConfig?.();

        if (!globalConfig || !config || !globalConfig[config]) {
            return [null, null];
        }

        const phaseConfig = globalConfig[config];

        const startTime = createUTCTimestamp(
            parseInt(phaseConfig.start_year),
            parseInt(phaseConfig.start_month),
            parseInt(phaseConfig.start_day),
            parseInt(phaseConfig.start_hour),
            parseInt(phaseConfig.start_minute),
        );

        // Note: we should keep end times 1 minute (current resolution) less than the last orbit data point time argument
        const endTime =
            createUTCTimestamp(
                parseInt(phaseConfig.stop_year),
                parseInt(phaseConfig.stop_month),
                parseInt(phaseConfig.stop_day),
                parseInt(phaseConfig.stop_hour),
                parseInt(phaseConfig.stop_minute),
            ) - oneMinuteMs;

        return [startTime, endTime];
    };
}

