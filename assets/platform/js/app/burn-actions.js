export function createBurnActions({
    getEventInfos,
    setAnimTime,
    missionSetTime,
}) {
    function burnButtonHandler(index) {
        const eventInfos = getEventInfos();
        if (eventInfos[index]["label"] === "\u23F0 Now") {
            setAnimTime(new Date().getTime());
        } else {
            setAnimTime(new Date(eventInfos[index]["startTime"].getTime()).getTime());
        }

        missionSetTime();
    }

    return { burnButtonHandler };
}
