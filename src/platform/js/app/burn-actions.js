import { EVENT_KIND } from "../core/domain/event-time-resolver.js";

export function createBurnActions({
    getEventInfos,
    setAnimTime,
    missionSetTime,
}) {
    function burnButtonHandler(index) {
        const eventInfos = getEventInfos();
        const eventInfo = eventInfos[index];
        if (!eventInfo) return;

        if (eventInfo.kind === EVENT_KIND.NOW) {
            setAnimTime(new Date().getTime());
        } else {
            setAnimTime(new Date(eventInfo.startTime.getTime()).getTime());
        }

        missionSetTime();
    }

    return { burnButtonHandler };
}
