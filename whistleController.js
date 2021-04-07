  app.controller("whistleController", ['$scope', '$timeout', '$window', function($scope, $timeout, $window) {
    $scope.letter = ''
    $scope.alphabet = {
      'a': ['.', '-', ' ', ' '],
      'b': ['-', '.', '.', '.'],
      'c': ['-', '.', '-' ,'.'],
      'd': ['-', '.', '.', ' '],
      'e': ['.', ' ', ' ', ' '],
      'f': ['.', '.', '-', '.'],
      'g': ['-', '-', '.', ' '],
      'h': ['.', '.', '.', '.'],
      'i': ['.', '.', ' ', ' '],
      'j': ['.', '-', '-', '-'],
      'k': ['-', '.', '-', ' '],
      'l': ['.', '-', '.', '.'],
      'm': ['-', '-', ' ', ' '],
      'n': ['-', '.', ' ', ' '],
      'o': ['-', '-', '-', ' '],
      'p': ['.', '-', '-', '.'],
      'q': ['-', '-', '.', '-'],
      'r': ['.', '-', '.', ' '],
      's': ['.', '.', '.', ' '],
      't': ['-', ' ', ' ', ' '],
      'u': ['.', '.', '-', ' '],
      'v': ['.', '.', '.', '-'],
      'w': ['.', '-', '-', ' '],
      'x': ['-', '.', '.', '-'],
      'y': ['-', '.', '-', '-'],
      'z': ['-', '-', '.', '.']
    }

    fMinHertz = 500
    fMaxHertz = 2000

    hop = 25 // ms

    clipDuration = 20 // interval

    bufferMax = new Float32Array(clipDuration);
    bufferMedian = new Float32Array(clipDuration);
    bufferIndex = 0
    for (var i = 0; i < bufferMax.length; i++) {
      bufferMax[i] = 0
      bufferMedian[i] = 0
    }

    fftSize = 1024

    $scope.amplitudeThreshold = -70
    $scope.ratioThreshold = 35

    $scope.amplitude = 0
    $scope.ratio = 0
    $scope.micMessage = 'record'

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

    var synCode = null
    var code = []
    var codeIndex = 0
    $scope.code = [' ', ' ', ' ', ' ']

    var micSet = false
    var waitNext = 0

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
      bufferMax[bufferIndex] = m
      bufferMedian[bufferIndex] = median(data)
      bufferIndex = (bufferIndex+1)%clipDuration
      meanMax = 0
      meanMedian = 0
      for (var i = 0; i < bufferMax.length; i++) {
        meanMax += bufferMax[i]
        meanMedian += bufferMedian[i]
      }
      if (waitNext == 0) {
        if (meanMax-meanMedian > $scope.ratioThreshold*clipDuration  && meanMax > $scope.amplitudeThreshold*clipDuration) {
          nbWhistleClip += 1
          waitNext = clipDuration
          console.log(nbWhistleClip);
        }
        else {
          if (nbWhistleClip) {
            console.log('cut');
            if (nbWhistleClip<3) {
              code[codeIndex] = '.'
              codeIndex += 1
            }
            else {
              code[codeIndex] = '-'
              codeIndex += 1
            }
            nbWhistleClip = 0
            nbSilentClip  = 0
          }
          waitNext = clipDuration
          nbSilentClip += 1
          if (codeIndex>0 && (nbSilentClip>3||codeIndex==4)) {
             console.log(code);
             $scope.letter = getLetter($scope.alphabet, code)
             $timeout(function () {
               $scope.letter = ''
             }, 1000);
             console.log($scope.letter);
             code = []
             codeIndex = 0
          }
      }
    }

      $scope.amplitude = meanMax/clipDuration
      $scope.ratio = (meanMax-meanMedian)/clipDuration
      max=0
      med=0
      if (waitNext>0) {
        waitNext-=1
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
      synCode = [...$scope.alphabet[letter]]
      oscillator.start();
      synSequence(synCode);
    }
  }

    function synSequence (synCode) {
      gain.gain.value = 0.2;

      if (synCode.length == 0 || synCode[0]==' ') {
        synAudio.close()
        synAudio = null
      }
      else {
        var duration = clipDuration*hop
        if (synCode[0]=='-') {
          duration *= 3
        }
        synCode.shift()
        $timeout(function(){gain.gain.value = 0}, duration)
        $timeout(function(){synSequence(synCode)}, duration+clipDuration*hop)
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

  function getLetter(alphabet, code){
    for (var i = 0; i < 4; i++) {
      if (i>=code.length)
        code[i] = ' '
    }
    for(var key in alphabet) {
      if (arraysEqual(alphabet[key], code))
        return key
    }
    return 0
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
