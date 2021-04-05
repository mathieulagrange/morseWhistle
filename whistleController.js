  app.controller("whistleController", ['$scope', '$timeout', '$window', function($scope, $timeout, $window) {

    $scope.alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 't', 'u', 'v', 'w', 'x', 'y', 'z']

    var dict = {
      'a': [1, 2, 0, 0],
      'b': [2, 1, 1, 1],
      'c': [2, 1, 2 ,1],
      'd': [2, 1, 1, 0],
      'e': [1, 0, 0, 0],
      'f': [1, 1, 2, 1],
      'g': [2, 2, 1, 0],
      'h': [1, 1, 1, 1],
      'i': [1, 1, 0, 0],
      'j': [1, 2, 2, 2],
      'k': [2, 1, 2, 0],
      'l': [1, 2, 1, 1],
      'm': [2, 2, 0, 0],
      'n': [2, 1, 0, 0],
      'o': [2, 2, 2, 0],
      'p': [1, 2, 2, 1],
      'q': [2, 2, 1, 2],
      'r': [1, 2, 1, 0],
      's': [1, 1, 1, 0],
      't': [2, 0, 0, 0],
      'u': [1, 1, 2, 0],
      'v': [1, 1, 1, 2],
      'x': [2, 1, 1, 2],
      'y': [2, 1, 2, 2],
      'z': [2, 2, 1, 1]
    }

    fMinHertz = 500
    fMaxHertz = 2000

    hop = 20 // ms

    clipDuration = 20 // interval

    $scope.short = true
    $scope.long = true

    fftSize = 1024

    $scope.amplitudeThreshold = -70
    $scope.ratioThreshold = 35

    $scope.amplitude = 0
    $scope.ratio = 0
    $scope.micMessage = 'record'
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

    var micSet = false

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
      if (frameAccumulator==clipDuration) {
        frameAccumulator=0
        console.log(nbWhistleClip);
        if (max-med > $scope.ratioThreshold*clipDuration  && max > $scope.amplitudeThreshold*clipDuration
        ) {
          nbWhistleClip += 1
        }
        else {
          nbSilentClip += 1
          if (nbWhistleClip>0 && nbWhistleClip<3) {
            $scope.short = true
            code[codeIndex] = 1
            codeIndex += 1
            nbSilentClip = 1
          } else if (nbWhistleClip>=3) {
            $scope.long = true
            code[codeIndex] = 2
            codeIndex += 1
            nbSilentClip = 1
          }
          else if (nbWhistleClip == 0) {
            $scope.long = false
            $scope.short = false
          }
          nbWhistleClip = 0
          if (codeIndex>0 && (nbSilentClip>3||codeIndex==4)) {
            $scope.letter = getLetter(code)
            $scope.code = code
            codeIndex = 0
          }
        }
        $scope.amplitude = max/clipDuration
        $scope.ratio = (max-med)/clipDuration
        max=0
        med=0
      }

      $timeout(function() {
        if (micSet) {update()}
      }, hop)
    }

    var synAudio = null
    var oscillator = null
    var gain = null

    $scope.synMorse = function(letter) {
      if (synAudio) {
        synAudio.close()
        synAudio = null
        $scope.synMorse(letter)
      }
      else {
      synAudio = new (window.AudioContext || window.webkitAudioContext)();

      oscillator = synAudio.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 440; // valeur en hertz

      gain = synAudio.createGain();

      gain.gain.value = 0.2;

      oscillator.connect(gain);
      gain.connect(synAudio.destination);
      code = [...dict[letter]]
      oscillator.start();
      synSequence(code);
    }
  }

    function synSequence (code) {
      gain.gain.value = 0.2;

      if (code.length == 0 || code[0]==0) {
        synAudio.close()
        synAudio = null
      }
      else {
        var duration = clipDuration*hop
        if (code[0]==2) {
          duration *= 3
        }
        code.shift()
        $timeout(function(){gain.gain.value = 0}, duration)
        $timeout(function(){synSequence(code)}, duration+clipDuration*hop)
      }
    }



    $scope.setMic = function() {
      if (micSet){
        micSet = false
        $scope.micMessage = 'record'
        audioContext.close()
      }
      else {
        $scope.micMessage = 'stop'
        micSet=true
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
  }

  function didntGetStream() {
      alert('Stream generation failed.');
  }

  var mediaStreamSource = null;

  function gotStream(stream) {
      mediaStreamSource = audioContext.createMediaStreamSource(stream);
      mediaStreamSource.connect(analyser);
      console.log(audioContext);
      update()
  }
  }])

  function getLetter(code){
    for(var key in dict) {
      if (arraysEqual(dict[key], code))
        return key
    }
    return 0
    console.log(code)
  }

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

  function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.
    // Please note that calling sort on an array will modify that array.
    // you might want to clone your array first.

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
