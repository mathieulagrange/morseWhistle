app.controller("whistleController", ['$scope', '$timeout', '$window', function($scope, $timeout, $window) {

  fMinHertz = 500
  fMaxHertz = 2000

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

  // frame accumulator
  var frameAccumulator = 0
  // number of clip where a whistle is detected
  var nbWhistleClip = 0
  // number of clip with no whistle
  var nbSilentClip = 0
  //
  var max = 0
  //
  var med = 0

  var code = [0, 0, 0, 0]
  var codeIndex = 0
  $scope.code = [1, 1, 1 ,1]

  function update() {
    analyser.getFloatFrequencyData(dataArray)
    fMin = Math.ceil(fMinHertz/audioContext.sampleRate*fftSize)
    fMax = Math.ceil(fMaxHertz/audioContext.sampleRate*fftSize)

    data = new Float32Array(fMax-fMin);
    m = -200
    for (var i = 0; i < data.length; i++) {
      data[i] = dataArray[fMin+i]
      if (m < data[i])
        m = data[i]
    }
    max += m
    med += median(data)
    frameAccumulator += 1
    if (frameAccumulator==13) {
      if (max-med > $scope.ratioThreshold*frameAccumulator  && max > $scope.amplitudeThreshold*frameAccumulator) {
        nbSilentClip = 0
        nbWhistleClip += 1
        if (nbWhistleClip==3) {
          $scope.long = true
          code[codeIndex] = 2
          codeIndex += 1
          nbWhistleClip = 0
        }
      }
      else {
        if (nbWhistleClip==1) {
          $scope.short = true
          code[codeIndex] = 1
          codeIndex += 1
        }
        else if (nbWhistleClip == 0) {
          $scope.long = false
          $scope.short = false
        }
        nbWhistleClip = 0
        nbSilentClip += 1
        code[codeIndex] = 0
        codeIndex += 1
      }
      $scope.amplitude = max/frameAccumulator
      $scope.ratio = (max-med)/frameAccumulator
      max=0
      med=0
      frameAccumulator=0

      if (codeIndex==4) {
        hasCode = false
        for (var i = 0; i < code.length; i++) {
          if (code[i]>0)
            hasCode = true
            $scope.code = code
        }
        codeIndex = 0
      }
    }

    $timeout(function() {
      update()
    }, hop)
  }

  $scope.setMic = function() {
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
