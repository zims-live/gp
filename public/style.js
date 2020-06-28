let numberOfDisplayedPeers = 0;

function enforceLayout(numberOfDisplayedPeers) {
    if (!contentExists) {
        gridLayout(numberOfDisplayedPeers);
    } else {
        if (isHandheld()) {
            contentShown = true;
            document.getElementById('videos').setAttribute('class', '');
            document.getElementById('videos').classList.add('single_cell');
            document.getElementsByClassName('contentContainer')[0].classList.remove('hidden');
            document.querySelectorAll('.video-box').forEach(elem => {
                if (!elem.classList.contains('contentContainer')) {
                    elem.classList.add('hidden');
                }
            });
            
            let swipeDone = false;
            let lastY = 120;
            let lastX = 120;
            let currentX = 120;
            var currentY = 120;

            var touchInitiation = (e) => {
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            }

            var detectSwipe = (e) => {
                currentY = e.touches[0].clientY;
                currentX = e.touches[0].clientX;
                swipeDone = true;
            }

            document.removeEventListener('touchend', swipeEventFunction);
            swipeEventFunction = function () {
                if (swipeDone && Math.abs(lastX - currentX) > 50 && Math.abs(lastY - currentY) < 50) {
                    swipeDone = false;
                    swipeContent();
                }
                console.log('currentY ' + currentY + 'Last Y ' + lastY);
                console.log('currentX ' + currentX + 'Last X ' + lastX);
            }

            document.addEventListener('touchstart', (e) => touchInitiation(e), false);
            document.addEventListener('touchmove', (e) => detectSwipe(e), false);
            document.addEventListener('touchend', swipeEventFunction, false);
        } else {
            document.getElementById('videos').setAttribute('class', '');
            document.getElementById('videos').classList.add('sixteen_cell');
            document.getElementById('localVideoContainer').classList.remove('sideLocalVideo');
        }
    }
}


function gridLayout(numberOfDisplayedPeers) {
    document.querySelectorAll('.video-box').forEach(elem => {
        if (!elem.classList.contains('contentContainer')) {
            elem.classList.remove('hidden');
        }
    });

    if (numberOfDisplayedPeers == 1) {
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('single_cell');
        document.getElementById('localVideoContainer').classList.add('sideLocalVideo');
    } else if (numberOfDisplayedPeers == 2) {
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('two_cell');
        document.getElementById('localVideoContainer').classList.add('sideLocalVideo');
    } else if (numberOfDisplayedPeers > 2 && numberOfDisplayedPeers <= 4) {
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('four_cell');
        document.getElementById('localVideoContainer').classList.add('sideLocalVideo');
    } else if (numberOfDisplayedPeers > 4 && numberOfDisplayedPeers <= 9) {
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('nine_cell');
        document.getElementById('localVideoContainer').classList.add('sideLocalVideo');
    } else if (numberOfDisplayedPeers > 9) {
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('sixteen_cell');
        document.getElementById('localVideoContainer').classList.add('sideLocalVideo');
    } else {
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('single_cell');
        document.getElementById('localVideoContainer').classList.remove('sideLocalVideo');
    }
}

function swipeContent() {
    if (contentShown) {
        contentShown = false;
        document.getElementsByClassName('contentContainer')[0].classList.add('hidden');
        gridLayout(numberOfDisplayedPeers - 1);
    } else {
        contentShown = true;
        document.getElementById('videos').setAttribute('class', '');
        document.getElementById('videos').classList.add('single_cell');
        document.getElementsByClassName('contentContainer')[0].classList.remove('hidden');
        document.querySelectorAll('.video-box').forEach(elem => {
            if (!elem.classList.contains('contentContainer')) {
                elem.classList.add('hidden');
            }
        });
    }
}

function createPeerVideo(peerId, isPeerContent) {
    const peerNode = document.getElementsByClassName('video-box')[0].cloneNode();
    peerNode.appendChild(document.getElementById('localVideo').cloneNode());

    peerNode.id = 'video' + peerId + 'Container';
    peerNode.firstElementChild.id = 'video' + peerId;

    peerNode.classList.remove('sideLocalVideo');
    peerNode.classList.remove('relaxedHidden');
    if (isPeerContent) {
        let inFullscreen = false;
        contentShown = true;
        contentExists = true;
        peerNode.classList.add('contentContainer');
        peerNode.addEventListener('click', () => {
            if (inFullscreen) {
                inFullscreen = false;
                screen.orientation.unlock();
                closeFullscreen();
            } else {
                inFullscreen = true;
                screen.orientation.lock('landscape');
                openFullscreen(peerNode)
            }
        });
    }

    document.getElementById('videos').appendChild(peerNode);

    document.getElementById('video' + peerId).srcObject = new MediaStream();

    enforceLayout(++numberOfDisplayedPeers);
}

function openFullscreen(video) {
    if (video.requestFullscreen) {
        video.requestFullscreen();
    } else if (video.mozRequestFullScreen) { /* Firefox */
        video.mozRequestFullScreen();
    } else if (video.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        video.webkitRequestFullscreen();
    } else if (video.msRequestFullscreen) { /* IE/Edge */
        video.msRequestFullscreen();
    }
}

function closeFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
    }
}

function hideLocalVideo() {
    if (numberOfDisplayedPeers > 0) {
        localVideoElem = document.getElementById('localVideoContainer');
        localVideoElem.classList.add('relaxedHidden');
        document.getElementById('localVideoShowButton').classList.remove('hidden'); 
    }
}

function showLocalVideo() {
    localVideoElem = document.getElementById('localVideoContainer');
    localVideoElem.classList.remove('relaxedHidden');
    document.getElementById('localVideoShowButton').classList.add('hidden'); 
}
