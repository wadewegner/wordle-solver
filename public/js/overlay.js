// Check if the overlay should be displayed
function shouldDisplayOverlay() {
    const lastVisitKey = 'lastVisitTimestamp';
    const lastVisit = localStorage.getItem(lastVisitKey);
    const currentTime = new Date().getTime();
    const oneHour = 60 * 60 * 1000;

    if (!lastVisit || currentTime - parseInt(lastVisit) >= oneHour) {
        localStorage.setItem(lastVisitKey, currentTime);
        return true;
    } else {
        return false;
    }
}

document.onreadystatechange = function () {
    if (document.readyState === 'complete') {
        const loadingOverlay = document.getElementById('loadingOverlay');

        if (shouldDisplayOverlay()) {
            loadingOverlay.style.display = 'flex'; // Show the loading overlay
            setTimeout(function () {
                loadingOverlay.style.opacity = 0;
                setTimeout(function () {
                    loadingOverlay.style.display = 'none';
                }, 1000);
            }, 1000);
        } else {
            loadingOverlay.style.display = 'none';
        }
    }
};
