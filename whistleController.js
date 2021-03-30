app.controller("whistleController", ['$scope', '$timeout', '$window', function($scope, $timeout, $window) {

  fmin = 500
  fmax = 2000

  hop = 20

  $scope.short = true
  $scope.long = true

  fftSize = 1024

  $scope.amplitudeThreshold = -70
  $scope.ratioThreshold = 10

  $scope.amplitude = -70
  $scope.ratio = 2

  $scope.trigger = false

  dataArray = null
  var analyser = null

  var acc = 0
  var short = false
  var long = false
  var show = false
  var up = 0

  max = 0
  med = 0

  function update() {
    analyser.getFloatFrequencyData(dataArray)
    fMin = Math.ceil(fmin/audioContext.sampleRate*fftSize)
    fMax = Math.ceil(fmax/audioContext.sampleRate*fftSize)

    data = new Float32Array(fMax-fMin);
    m = -200
    for (var i = 0; i < data.length; i++) {
      data[i] = dataArray[fMin+i]
      if (m < data[i])
        m = data[i]
    }
    max += m
    med += median(data)
    acc += 1
    if (acc==13) {
      if (max-med > $scope.ratioThreshold*acc  && max > $scope.amplitudeThreshold*acc) {
        up += 1
        if (up==3) {
          $scope.long = true
          up = 0
        }
      }
      else {
        if (up==1) {
          $scope.short = true
        }
        else if (up == 0) {
          $scope.long = false
          $scope.short = false
        }
        up = 0
      }
      $scope.amplitude = max/acc
      $scope.ratio = (max-med)/acc
      max=0
      med=0
      acc=0
    }

    $timeout(function() {
      update()
    }, hop)
  }

  $scope.setMic = function() {
    console.log('pass');
  // monkeypatch Web Audio
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    // grab an audio context
    audioContext = new AudioContext();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;

    var bufferLength = analyser.frequencyBinCount;
    dataArray = new Float32Array(bufferLength);

    // Attempt to get audio input
    try {
        // monkeypatch getUserMedia
        navigator.getUserMedia =
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;

        // ask for an audio input
        navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, didntGetStream);
    } catch (e) {
        alert('getUserMedia threw exception :' + e);
    }
}

function didntGetStream() {
    alert('Stream generation failed.');
}

var mediaStreamSource = null;

function gotStream(stream) {
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

      // Create a new volume meter and connect it.
    // meter = createAudioMeter(audioContext);
    mediaStreamSource.connect(analyser);
    console.log(audioContext);
    // kick off the visual updating
    // drawLoop();
}

  $scope.setMic()
  update()
}])

function median(values){
  if(values.length ===0) return 0;

  values.sort(function(a,b){
    return a-b;
  });

  var half = Math.floor(values.length / 2);

  if (values.length % 2)
    return values[half];

  return (values[half - 1] + values[half]) / 2.0;
}
