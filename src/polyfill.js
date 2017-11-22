/*
  Note: If you use VoiceRSS service, put your apikey as src/private_config.js like the following:

  const tts_config = {
    'APIKEY' : '<YOUR_API_KEY_HERE>',
    'LIMIT' : 10000,
    'LANG' : 'en-US'
  };
  module.exports = tts_config;
*/

var EventEmitter = require('eventemitter3');
var p5 = require('p5');
import 'p5/lib/addons/p5.sound';

var tts_config = window.tts_config || {
    'APIKEY' : '<YOUR_API_KEY_HERE>',
    'LIMIT' : 10000,
    'LANG' : 'en-US'
};

try {
  tts_config = require('./private_config');
} catch (e) {
}

var DEBUG = true;

var protocol = 'https:';

(function(window, document){
  'use strict';

  var LIMIT = tts_config.LIMIT || 100;

  var splitText = function(text, delimeters, limit){
    var sentences = [];

    // split text by multiple delimeters
    var reduce = function(text, index) {
      if (delimeters[index] && text.trim().length) {

        if (text.indexOf(delimeters[index]) > -1) {

          var s = 1;
          var splitted = text.split(delimeters[index]);
          splitted.forEach(function(words){
            if (words.length) {
              var suffix = '';
              if (s != splitted.length) {
                suffix = delimeters[index];
              }
              words = (words + suffix).trim();
            }

            if (words.length && words.length <= limit) {
              sentences.push(words);
            }
            else {
              reduce(words, index + 1);
            }

            s++;
          });
        }
        else {
          reduce(text, index + 1);
        }
      }
      else if (text.length) {
        var regexp = new RegExp('.{1,' + limit + '}', 'g'); // /.{1,100}/g
        var parts = text.match(regexp);
        while (parts.length > 0) {
          sentences.push(parts.shift().trim());
        }
      }
    };
    
    reduce(text, 0);

    var result = [];
    // merge short sentences
    sentences.forEach(function(sentence){
      if (! result.length) {
        result.push(sentence);
      }
      else if (result[result.length - 1].length + sentence.length + 1 <= limit) {
        result[result.length - 1] += ' ' + sentence;
      }
      else {
        result.push(sentence);
      }
    });

    return result;
  };

  var inherits = function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };

  // Audio polyfill by Web Audio API
  var AudioPolyfill = function() {
    EventEmitter.call(this);

    this.soundFile; 
    this.onload;

    this.src;
    this.volume;
    this.playbackRate;

    var that = this;

    this.play = function() {
      if(that.src) {
        that.onload = function() {
            that.soundFile.play();
            that.emit('play', that.soundFile);          
        }

        that.soundFile = new p5.SoundFile(that.src, function() {
          that.soundFile.onended(function() {
            if (! that.soundFile.isPaused()) {
              that.emit('ended', that.soundFile);
              that.soundFile = null;
            }
          });

          if (that.onload) {
            that.onload();
          }
        }, function(error) {
          console.warn('request error: ' + error);
          that.emit('error', error);
        });
      } else {
        console.warn('Audio source not set.');
        that.emit('error', 'No src');
      }
    };

    this.stop = function() {
      that.onload = null;

      if (that.soundFile) {
        that.soundFile.stop();
      }
    }

    this.pause = function() {
      if (that.soundFile) {
        if (that.soundFile.isPaused()) {
          // do nothing
        } else if (that.soundFile.isPlaying()) {
          that.soundFile.pause();
          that.emit('pause', that.soundFile);
        } else if (! that.soundFile.isLoaded()) {
          that.onload = function() {
            that.emit('pause', that.soundFile);
          }
        }
      }
    }

    this.resume = function() {
      if (that.soundFile) {
        if (that.soundFile.isPlaying()) {
          // do nothing
        } else if (that.soundFile.isPaused()) {
          that.soundFile.play();
          that.emit('resume', that.soundFile);
        } else {
          // paused & resumed while loading
          that.onload = function() {
              that.soundFile.play();
              that.emit('play', that.soundFile);          
          }
        }
      }
    };

    this._getSoundFile = function() {
      return that.soundFile;
    };

    return this;
  };
  inherits(AudioPolyfill, EventEmitter);

  var SpeechSynthesisUtterancePolyfill = function(text){

    /**
     * Identify the polyfill usage
     */

    this.isPolyfill = true;

    /**
     * SpeechSynthesisUtterance Attributes
     */
    
    this.text = text || '';
    this.lang = tts_config.LANG || document.documentElement.lang || 'en-US';
    this.volume = 1.0; // 0 to 1
    this.rate = 1.0; // 0.1 to 10
    // These attributes are not supported:
    this.voiceURI = 'native';
    this.pitch = 1.0; //0 to 2;

    /**
     * SpeechSynthesisUtterance Events
     */
    
    this.onstart = undefined;
    this.onend = undefined;
    this.onerror = undefined;
    this.onpause = undefined;
    this.onresume = undefined;
    // These attributes are not supported:
    this.onmark = undefined;
    this.onboundary = undefined;


    this.corsProxyServer = 'http://www.corsproxy.com/'; // is down!

    /**
     * Private parts
     */
    
    var that = this;

    var startTime;
    var endTime;
    var event = {
      charIndex: undefined,
      elapsedTime: undefined,
      name: undefined
    };

    var updateElapsedTime = function(){
      endTime = new Date().getTime();
      event.elapsedTime = (endTime - (startTime || endTime)) / 1000;
    };

    var getAudioUrl = function(corsProxyServer, text, lang, apikey){
      // return [corsProxyServer, 'translate.google.com/translate_tts?ie=UTF-8&q=', encodeURIComponent(text) , '&tl=', lang].join('');
      // VoiceRSS
      // return [protocol, '//api.voicerss.org/?key=', tts_config.APIKEY, '&c=WAV&f=16khz_16bit_mono&src=', encodeURIComponent(text), '&hl=', lang].join('');
      // Watson
      return [protocol, '//', tts_config.BLUEMIX_CLIENT_ID, ':', tts_config.BLUEMIX_PASSWORD, '@stream.watsonplatform.net/text-to-speech/api/v1/synthesize?accept=audio%2Fogg', '&text=', encodeURIComponent(text)].join('');
    };

    this._initAudio = function(){
      var sentences = [];
      that._ended = false;
      var audio = new AudioPolyfill(); // new Audio();

      audio.on('play', function() {
        updateElapsedTime();

        if (! startTime) {
          startTime = new Date().getTime();
          if (that.onstart) {
            that.onstart(event, audio._getSoundFile());
          }
        }
        else {
          if (that.onresume) {
            that.onresume(event, audio._getSoundFile());
          }
        }
      });

      audio.on('resume', function() {
        if (that.onresume) {
          that.onresume(event, audio._getSoundFile());
        }
      });

      audio.on('ended', function() {

        if (sentences.length) {
          var audioURL = getAudioUrl(that.corsProxyServer, sentences.shift(), that.lang);
          audio.src = audioURL;
          audio.play();
        }
        else {
          updateElapsedTime();
          that._ended = true;
          if (that.onend) {
            that.onend(event, audio._getSoundFile());
          }
        }
      });

      audio.on('error', function() {
        updateElapsedTime();
        that._ended = true;
        if (that.onerror) {
          that.onerror(event);
        }
      });

      audio.on('pause', function() {
        if (!that._ended) {
          updateElapsedTime();
          if (that.onpause) {
            that.onpause(event);
          }
        }
      });

      // Google Translate limit is 100 characters, we need to split longer text
      // we use the multiple delimeters

      if (that.text.length > LIMIT) {

        sentences = splitText(that.text, ['.', '!', '?', ':', ';', ',', ' '], LIMIT);

      }
      else {
        sentences.push(that.text);
      }

      var audioURL = getAudioUrl(that.corsProxyServer, sentences.shift(), that.lang);
      audio.src = audioURL;
      audio.volume = that.volume;
      audio.playbackRate = that.rate;

      return audio;
    };

    return this;
  };

  var SpeechSynthesisPolyfill = function(){

    /**
     * Identify the polyfill usage
     */

    this.isPolyfill = true;

    /**
     * SpeechSynthesis Attributes
     */

    this.pending = false;
    this.speaking = false;
    this.paused = false;

    /**
     * Private parts
     */

    var that = this;
    var audio = new AudioPolyfill();
    var utteranceQueue = [];

    var playNext = function(utteranceQueue){
      var SpeechSynthesisUtterancePolyfill = utteranceQueue.shift();

      that.speaking = false;
      if (utteranceQueue.length) {
        that.pending = true;
      }
      else {
        that.pending = false;
      }

      if (SpeechSynthesisUtterancePolyfill) {
        audio = SpeechSynthesisUtterancePolyfill._initAudio();
        attachAudioEvents(audio, SpeechSynthesisUtterancePolyfill);
        resume();
      }
    };

    var attachAudioEvents = function(audio, SpeechSynthesisUtterancePolyfill) {

      audio.on('play', function() {
        DEBUG && console.log('SpeechSynthesis audio play');
      });

      audio.on('ended', function() {
        DEBUG && console.log('SpeechSynthesis audio ended');
        if (SpeechSynthesisUtterancePolyfill._ended) {
          playNext(utteranceQueue);
        }
      });

      audio.on('error', function() {
        DEBUG && console.log('SpeechSynthesis audio error');
        playNext(utteranceQueue);
      });

      audio.on('pause', function() {
        DEBUG && console.log('SpeechSynthesis audio paused');
      });

      audio.on('resume', function() {
        DEBUG && console.log('SpeechSynthesis audio resumed');
      });
    };

    var speak = function(SpeechSynthesisUtterancePolyfill){

      that.pending = true;
      utteranceQueue.push(SpeechSynthesisUtterancePolyfill);

      if (that.speaking || that.paused) {
        // do nothing else
      }
      else {
        playNext(utteranceQueue);
      }
    };

    var cancel = function(){
      audio.stop();
      audio.src = '';
      audio = undefined;
      audio = new AudioPolyfill(); // new Audio();

      that.pending = false;
      that.speaking = false;
      that.paused = false;
      utteranceQueue = [];
      playNext(utteranceQueue);
    };

    var pause = function(){
      audio.pause();
      that.speaking = false;
      that.paused = true;
    };

    var resume = function(){
      if (audio.src) {
        if (that.paused) {
          audio.resume();
        } else if (!that.speaking){
          audio.play();
        }
        that.speaking = true;
      }
      else {
        playNext(utteranceQueue);
      }

      that.paused = false;
    };

    // Method is not supported
    var getVoices = function(){
      return [];
    };

    return {
      /**
       * Identify the polyfill usage
       */

      'isPolyfill': true,

      /**
       * SpeechSynthesis Methods
       */

      'pending': that.pending,
      'speaking': that.speaking,
      'paused': that.paused,

      'speak': function(SpeechSynthesisUtterancePolyfill){
        speak(SpeechSynthesisUtterancePolyfill);
      },

      'cancel': function(){
        cancel();
      },

      'pause': function(){
        pause();
      },

      'resume': function(){
        resume();
      },

      'getVoices': function(){
        getVoices();
      },

    };
  };

  var nativeSpeechSynthesisSupport = function(){
    return window.speechSynthesis && window.SpeechSynthesisUtterance ? true : false;
  };

  var getSpeechSynthesis = function(){
    return nativeSpeechSynthesisSupport() ? window.speechSynthesis : window.speechSynthesisPolyfill;
  };

  var getSpeechSynthesisUtterance = function(){
    return nativeSpeechSynthesisSupport() ? window.SpeechSynthesisUtterance : window.SpeechSynthesisUtterancePolyfill;
  };

  window.SpeechSynthesisUtterancePolyfill = SpeechSynthesisUtterancePolyfill;
  window.speechSynthesisPolyfill = new SpeechSynthesisPolyfill();

  window.nativeSpeechSynthesisSupport = nativeSpeechSynthesisSupport;
  window.getSpeechSynthesis = getSpeechSynthesis;
  window.getSpeechSynthesisUtterance = getSpeechSynthesisUtterance;

})(window, document);

