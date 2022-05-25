const mimeType = 'video/webm;codecs=h264'; // inputs or streams from media recorder will be webm.
const outputMimeType = 'video/mp4;codecs=h264'; // expected output after ffmpeg conversion is mp4.

// NOTE: Media Recorder supports h264 codec, but due to MP4 liscence issue
// Webm was created by google with open source lisence to create a container on top of it.
// so if we internally use h264 codec, we can directly change only the container
// i.e., webm -> mp4 by just copying the contents of video
// conclusion the output is very fast conversion.

const {
    createFFmpeg,
    fetchFile
} = FFmpeg;

let mpegPromise;
let ffmpeg;

async function loadFFmpeg(){
    if( !mpegPromise ) {
        ffmpeg = createFFmpeg({
            corePath: '../node_modules/@ffmpeg/core/dist/ffmpeg-core.js', // dynamic loading / preload.
            log: true
        });
        // loading ffmpeg
        mpegPromise = ffmpeg.load();
    }
    return mpegPromise;
}

async function getStream() {
    // stream can either be screen or camera.
    return navigator.mediaDevices.getDisplayMedia({
        video: {
            cursor: 'always',
            frameRate: 12,
            width: {
                ideal: 1280,
                max: 1920
            },
            aspectRatio: 1.78
        },
        audio: true
    });
}

async function convert(blob, name = 'input.mp4') {
    // Load ffmpeg.wasm in preload
    console.log(`Blob chunk from webm to mp4 conversion`);
    const outputFileName = 'output.mp4';
    await loadFFmpeg(); // loading ffmpgeg takes time.
    const madeData = await fetchFile(blob);
    // write into file system
    ffmpeg.FS('writeFile', name, madeData);
    // covert into mp4 with preset copy
    await ffmpeg.run('-i', name, '-movflags', 'faststart', '-c:v', 'copy', outputFileName);
    // read from file system 
    const data = await ffmpeg.FS('readFile', outputFileName);
    // load in browser for preview,
    // NOTE: Need to upload to Google Cloud Storage.
    loadInBrowser(data.buffer);
    // unlink from file system
    ffmpeg.FS('unlink', outputFileName);
    console.log(`unlink successful`);
}

function loadInBrowser(bufferFromFfmpeg) {
    let video = document.createElement('video');
    video.controls = true;
    let blob = new Blob([bufferFromFfmpeg], {
        type: outputMimeType
    });
    let videoURL = window.URL.createObjectURL(blob);
    video.src = videoURL;
    document.body.appendChild(video);
    // window.URL.revokeObjectURL(videoURL)
}

async function record() {
    let chunks = [];
    if (MediaRecorder.isTypeSupported(mimeType)) {
        let stream = await getStream();
        window.stream = stream;
        let userMediaStream = new MediaRecorder(stream, {
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000,
            mimeType
        });

        userMediaStream.addEventListener('dataavailable', (e) => {
            chunks.push(e.data);
        });

        userMediaStream.addEventListener('stop', function () {
            let blob = new Blob(chunks, {
                type: mimeType
            });

            convert(blob);
            // revoke the buffer/chunks, memory to make it efficient.
            chunks = null;
        });

        userMediaStream.start(100);
        return userMediaStream;
    }
}

let mr;
let dom = document.getElementById('start');
dom.onclick = async function (_) {
    if (mr && mr.state == 'recording') {
        mr.stop();
        dom.innerText = 'start'
    } else {
        mr = await record();
        dom.innerText = 'stop'
    }
};

// Loading ffmpeg but certainly in browser we have to load with either preload/prefretch and keep them in memory.
loadFFmpeg();