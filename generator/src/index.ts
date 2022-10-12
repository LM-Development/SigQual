// TODO clean up code, modularize, so.

// dom references
const statusLabel = document.getElementById("status-label") as HTMLSpanElement;
const initButton = document.getElementById("init-button") as HTMLButtonElement;
const playPauseButton = document.getElementById("play-pause-button") as HTMLButtonElement;
const audioElement = document.getElementById("audio-element") as HTMLAudioElement;
const outputDeviceSelection = document.getElementById("output-device-selection") as HTMLSelectElement;

interface GainControlledOsc {
    gainNode: GainNode;
    oscillatorNode: OscillatorNode;
}

// state
let status = "uninitialized";
let audioContext: AudioContext;
let masterGain: GainNode;
let attackTime = 0.001;
let holdTime = 0.065;
let releaseTime = 0.001;
let gapTime = 0.065;
let scheduledUntil: number;
let rowFrequencies = [697, 770, 852, 941];
let rowOscillators: GainControlledOsc[] = [];
let columnFrequencies = [1209, 1336, 1477, 1633];
let columnOscillators: GainControlledOsc[] = [];

// init
initButton.addEventListener("click", initializeSimulator);
playPauseButton.addEventListener("click", playPause);
initDevicesSelection();
updateUi();

// functions
function initializeSimulator() {
    try {
        var AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContext();
        var outputDestination = audioContext.createMediaStreamDestination();
        masterGain = new GainNode(audioContext, {
            gain: 0.5
        });
        masterGain.connect(outputDestination);
        audioElement.srcObject = outputDestination.stream;
        audioElement.play();
        for (var i = 0; i < rowFrequencies.length; i++) {
            rowOscillators.push(createOscillator(rowFrequencies[i]))
        }
        for (var i = 0; i < columnFrequencies.length; i++) {
            columnOscillators.push(createOscillator(columnFrequencies[i]))
        }
        goSilent();

        status = "ready"
    } catch (err) {
        status = "error";
        console.error(err);
    }
    updateUi();
}

function createOscillator(frequency: number): GainControlledOsc {
    var gainOsc: GainControlledOsc = {
        gainNode: new GainNode(audioContext, {
            gain: 0
        }),
        oscillatorNode: new OscillatorNode(audioContext, {
            type: "sine",
            frequency: frequency
        })
    };

    gainOsc.oscillatorNode.connect(gainOsc.gainNode).connect(masterGain);
    gainOsc.oscillatorNode.start();
    return gainOsc;
}

function updateUi() {
    initButton.style.display = "none";
    if (status === "uninitialized") {
        statusLabel.textContent = "✖ UNINITIALIZED";
        playPauseButton.style.display = "none";
        initButton.style.display = "inline-block";
    } else if (status === "ready") {
        statusLabel.textContent = "🟢 READY";
        playPauseButton.style.display = "inline-block";
    } else if (status === "playing") {
        statusLabel.textContent = "🎶 PLAYING";
    } else if (status === "paused") {
        statusLabel.textContent = "⏸ PAUSED";
    } else if (status === "error") {
        statusLabel.textContent = "☠ CRASHED";
    }
}

function goSilent() {
    for (var i = 0; i < rowOscillators.length; i++) {
        rowOscillators[i].gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        rowOscillators[i].gainNode.gain.setTargetAtTime(0, audioContext.currentTime, releaseTime);
    }
    for (var i = 0; i < columnOscillators.length; i++) {
        columnOscillators[i].gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        columnOscillators[i].gainNode.gain.setTargetAtTime(0, audioContext.currentTime, releaseTime);
    }
}

function playPause() {
    try {
        if (status === "ready" || status === "paused") {
            status = "playing";
            scheduledUntil = audioContext.currentTime;
            scheduledUntil += 0.3; // initial delay to have enough time to schedule the first batch of tones
            scheduleContinuously();
        } else if (status === "playing") {
            status = "paused";
            goSilent();
        }
    } catch (err) {
        status = "error";
        console.error(err);
    }

    updateUi();
}

function scheduleContinuously() {
    if (status !== "playing") {
        return;
    }

    while (scheduledUntil - audioContext.currentTime < 3) {
        // schedule as long as scheduled sequence is below 3 seconds of length
        scheduleTimestampSequence();
    }

    setTimeout(scheduleContinuously, 1000);
}

function scheduleTimestampSequence() {
    var timeOfPlayback = new Date();
    var timeOfPlaybackEpoch = timeOfPlayback.getTime() + (scheduledUntil - audioContext.currentTime) * 1000
    var unixEpochNanoSecondsString = Math.round(timeOfPlaybackEpoch * 1000).toString(10);
    scheduleDtmfCharacter('A');
    scheduleDtmfString(unixEpochNanoSecondsString);
}

function scheduleDtmfString(dtmfString: string) {
    for (var charIndex = 0; charIndex < dtmfString.length; charIndex++) {
        scheduleDtmfCharacter(dtmfString.charAt(charIndex));
    }
}

function scheduleAscii(asciiString: string) {
    for (var charIndex = 0; charIndex < asciiString.length; charIndex++) {
        var asciiValue = asciiString.charCodeAt(charIndex);
        var asciiValueInDecimal = zeroPad(asciiValue, 3);
        scheduleDtmfCharacter(asciiValueInDecimal.charAt(0));
        scheduleDtmfCharacter(asciiValueInDecimal.charAt(1));
        scheduleDtmfCharacter(asciiValueInDecimal.charAt(2));
    }
}

function zeroPad(num: number, size: number): string {
    var numAsString = num.toString();
    while (numAsString.length < size) numAsString = "0" + numAsString;
    return numAsString;
}

function scheduleDtmfCharacter(dtmfCharacter: string) {
    var rowGain, columnGain;
    // decode correct oscillator gain nodes
    switch (dtmfCharacter) {
        case '1':
            rowGain = rowOscillators[0].gainNode;
            columnGain = columnOscillators[0].gainNode;
            break;
        case '2':
            rowGain = rowOscillators[0].gainNode;
            columnGain = columnOscillators[1].gainNode;
            break;
        case '3':
            rowGain = rowOscillators[0].gainNode;
            columnGain = columnOscillators[2].gainNode;
            break;
        case 'A':
            rowGain = rowOscillators[0].gainNode;
            columnGain = columnOscillators[3].gainNode;
            break;
        case '4':
            rowGain = rowOscillators[1].gainNode;
            columnGain = columnOscillators[0].gainNode;
            break;
        case '5':
            rowGain = rowOscillators[1].gainNode;
            columnGain = columnOscillators[1].gainNode;
            break;
        case '6':
            rowGain = rowOscillators[1].gainNode;
            columnGain = columnOscillators[2].gainNode;
            break;
        case 'B':
            rowGain = rowOscillators[1].gainNode;
            columnGain = columnOscillators[3].gainNode;
            break;
        case '7':
            rowGain = rowOscillators[2].gainNode;
            columnGain = columnOscillators[0].gainNode;
            break;
        case '8':
            rowGain = rowOscillators[2].gainNode;
            columnGain = columnOscillators[1].gainNode;
            break;
        case '9':
            rowGain = rowOscillators[2].gainNode;
            columnGain = columnOscillators[2].gainNode;
            break;
        case 'C':
            rowGain = rowOscillators[2].gainNode;
            columnGain = columnOscillators[3].gainNode;
            break;
        case '*':
            rowGain = rowOscillators[3].gainNode;
            columnGain = columnOscillators[0].gainNode;
            break;
        case '0':
            rowGain = rowOscillators[3].gainNode;
            columnGain = columnOscillators[1].gainNode;
            break;
        case '#':
            rowGain = rowOscillators[3].gainNode;
            columnGain = columnOscillators[2].gainNode;
            break;
        case 'D':
            rowGain = rowOscillators[3].gainNode;
            columnGain = columnOscillators[3].gainNode;
            break;
    }
    // set tone start to prevent bleeding into previous time frame
    rowGain.gain.linearRampToValueAtTime(0, scheduledUntil);
    columnGain.gain.linearRampToValueAtTime(0, scheduledUntil);

    // attack
    scheduledUntil += attackTime;
    rowGain.gain.linearRampToValueAtTime(0.5, scheduledUntil);
    columnGain.gain.linearRampToValueAtTime(0.5, scheduledUntil);

    // hold
    scheduledUntil += holdTime;
    rowGain.gain.linearRampToValueAtTime(0.5, scheduledUntil);
    columnGain.gain.linearRampToValueAtTime(0.5, scheduledUntil);

    // release
    scheduledUntil += releaseTime;
    rowGain.gain.linearRampToValueAtTime(0, scheduledUntil);
    columnGain.gain.linearRampToValueAtTime(0, scheduledUntil);

    // add tone gap
    scheduledUntil += gapTime;
    rowGain.gain.linearRampToValueAtTime(0, scheduledUntil);
    columnGain.gain.linearRampToValueAtTime(0, scheduledUntil);
}

function registerDevices(deviceInfos: MediaDeviceInfo[]) {
    // Handles being called several times to update labels. Preserve values.
    console.log(deviceInfos);
    while (outputDeviceSelection.firstChild) {
        outputDeviceSelection.removeChild(outputDeviceSelection.firstChild);
    }
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audiooutput') {
            option.text = deviceInfo.label || `speaker ${outputDeviceSelection.length + 1}`;
            outputDeviceSelection.appendChild(option);
        }
    }
}

function initDevicesSelection() {

    navigator.mediaDevices.getUserMedia({ audio: { deviceId: undefined } }).then((stream) => {
        navigator.mediaDevices.enumerateDevices().then(registerDevices).catch((err) => {
            console.error(err);
            status = "error";
        });
    });
    outputDeviceSelection.onchange = () => {
        attachToSinkId(outputDeviceSelection.value);
    }
}

function attachToSinkId(destinationSinkId: string) {
    (audioElement as any).setSinkId(destinationSinkId)
        .catch((err: string) => {
            console.error(err);
            status = err;
        });
}
