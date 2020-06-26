let numberOfDisplayedPeers = 0;
let swipeDone = false;

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

            swipeEventFunction = function () {
                if (swipeDone) {
                    swipeDone = false;
                    console.log(numberOfDisplayedPeers);
                    swipeContent(numberOfDisplayedPeers);
                }
            }

            document.addEventListener('touchmove', () => {swipeDone = true}, false);
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

function swipeContent(numberOfDisplayedPeers) {
    if (contentShown) {
        contentShown = false;
        document.getElementsByClassName('contentContainer')[0].classList.add('hidden');
        gridLayout(numberOfDisplayedPeers - 1)
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
        contentShown = true;
        contentExists = true;
        peerNode.classList.add('contentContainer');
    }

    document.getElementById('videos').appendChild(peerNode);

    document.getElementById('video' + peerId).srcObject = new MediaStream();

    enforceLayout(++numberOfDisplayedPeers);
}

function hideLocalVideo() {
    localVideoElem = document.getElementById('localVideoContainer');
    localVideoElem.classList.add('relaxedHidden');
    document.getElementById('localVideoShowButton').classList.remove('hidden'); 
}

function showLocalVideo() {
    localVideoElem = document.getElementById('localVideoContainer');
    localVideoElem.classList.remove('relaxedHidden');
    document.getElementById('localVideoShowButton').classList.add('hidden'); 
}
