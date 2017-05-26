// ************************************************************************************************************
// Written by Alexander Agudelo <alex.agudelo@asurantech.com>, 2016
// Date: 15/Jul/2016
// Description: Gesture Block - Allows user to record movements using an IMU block, store the pattern
// and later detect those movements to perform an action.
//
// This block is based on the LSTM neural network architecture and uses the Synaptic library for such purpose.
// Data segmentation is carried out using the technique described in the following research paper by Mark
// Joselli and Esteban Clua:
// http://www2.ic.uff.br/~esteban/files/papers/SBGames09_Mark_A.pdf
//
// Setup:
// - Accelerometer data rate of at least 32Hz (I only tested at this mode)
// - We assume the gesture starts from a resting position (limitatin of the segmentation equation)
//
// TODO: There are a few problems with the approach, since the segmentation technique assumes resting position
// the neural network doesn't perform very efficiently if the devices was previously in motion.
//
// - Outputs have to be entered by hand, this is something that MUST be changed soon.
// ------
// Copyright (C) Asuran Technologies - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential.
// ************************************************************************************************************
define(['HubLink', 'RIB', 'PropertiesPanel', 'Easy'], function(Hub, RIB, Ppanel, easy) {


  var actions = ["Activate", "Deactivate"];
  var inputs = [];
  var _objects = {};

  var GestureController = {
    settings:{
      Custom: {}
    },
    dataFeed: {}
  };


  // Set if the blocks is Input and/or Output
  GestureController.isInputBlock = true;
  GestureController.isOutputBlock = true;

  // TODO: Review if this is a trully unique instance?

  GestureController.getActions = function() {
    return actions;
  };

  GestureController.getInputs = function() {
    return this._inputs;
  };

  // Use onBeforeSave for return the data/fields you want to save
  GestureController.onBeforeSave = function() {
    // return { localField1: localField1 };
  };

  /**
   * Use this method to control the visibility of the DataFeed
   * By default it will show() the DataFeed, change it to true to hide it. 
   */
  GestureController.hideDataFeed = function() {
    return false;
  };


  // Use hasMissingProperties to open/not open the properties panel
  GestureController.hasMissingProperties = function() {
    // if (localField1.length > 0) {
    //   return false; // keep it closed
    // }
    // return true; // will open the properties
    return false;
  };

  /**
   * Intercepts the properties panel closing action.
   * Return "false" to abort the action.
   * NOTE: Settings Load/Saving will atomatically
   * stop re-trying if the event propagates.
   */
  GestureController.onCancelProperties = function() {
    console.log("Cancelling Properties");
  };


  /**
   * Intercepts the properties panel save action.
   * You must call the save method directly for the
   * new values to be sent to hardware blocks.
   * @param settings is an object with the values
   * of the elements rendered in the interface.
   * NOTE: For the settings object to contain anything
   * you MUST have rendered the panel using standard
   * ways (easy.showBaseSettings and easy.renderCustomSettings)
   */
  GestureController.onSaveProperties = function(settings) {
    this.settings = settings;
  };


  /**
   * Triggered when added for the first time to the side bar.
   * This script should subscribe to all the events and broadcast
   * to all its copies the data.
   * NOTE: The call is bind to the block's instance, hence 'this'
   * does not refer to this module, for that use 'GestureController'
   */
  GestureController.onLoad = function() {
    var that = this;
    var synPath = that.basePath + 'assets/synaptic/dist/';

    // Load Dependencies
    require([synPath+'synaptic.js'], function(neuron){
      console.log("synaptic lib loaded! ");
    });

    // init variables...
    this.controller._recording = false;
    this.controller._listening = false;
    this.controller._step = 0;
    this.controller._currentInput = [];
    this.controller._lastData = {x:undefined, y:undefined, z:undefined};
    this.controller._gestureStarted = false;
    this.controller._prevX = 0;
    this.controller._prevY = 0;
    this.controller._prevZ = 0;
    this.controller._totalRecords = 0;
    this.controller._ignoreTrigger = false;
    this.controller.trainingSet = [];
    this.controller.callGates = this.processData.bind(this);
    this.controller.callListeners = this.dispatchDataFeed.bind(this);

    if(!this.controller.gestures){
      this.controller.gestures = {
        recording: []
      }
    }

    if(!this.controller._inputs) this.controller._inputs = [];

    // Load our properties template and keep it in memory
    this.loadTemplate('properties.html').then(function(template) {
      that.controller.propTemplate = template;
    });

    // Load previously stored settings
    // if (this.storedSettings && this.storedSettings.localField1) {
    //   localField1 = this.storedSettings.localField1;
    // }
  };


  /**
   * Allows blocks controllers to change the content
   * inside the Logic Maker container
   */
  GestureController.lmContentOverride = function() {
    // Use this to inject your custom HTML into the Logic Maker screen.
    return "";
  };

  /**
   * Parent is asking me to execute my logic.
   * This block only initiate processing with
   * actions from the hardware.
   */
  GestureController.onExecute = function(event) {

  };


  /**
   * Triggered when the user clicks on a block.
   * The interace builder is automatically opened.
   * Here we must load the elements.
   * NOTE: This is called with the scope set to the
   * Block object, to emailsess this modules properties
   * use GestureController or this.controller
   */
  GestureController.onClick = function() {
    var that = this;

    // Ppanel.onClose(function(){
    //   that.cancelLoading();
    //   that.cancelSaving();
    //   Ppanel.stopLoading();
    // });

    // Ppanel.loading("Loading settings...");

    // Render the template
    // var html = $(that.propTemplate({
    //   localField1: localField1,
    // }));

    // this._propContainer = html;

    this.controller.displayRecordings.call(this.controller);

    // Display elements
    easy.displayCustomSettings(html, true);

    Ppanel.stopLoading();

  };

  GestureController.startRecording = function(el){
    this._step = 0;
    this.step();
  };

  GestureController.step = function(){
    this._step++;

    if(this._step === 1){
      this._msgText.text("Draw a shape in the air");
      this._recording = true;
      this._listening = false;
    }else if(this._step === 2){
      this._msgText.text("Please draw the same shape");
    }else if(this._step === 3){
      this._msgText.text("Once more, draw the same shape");
    }else if(this._step === 4){
      this._msgText.text("Well done, now just leave the hand steady");
      this._recording = false;
      setTimeout(this.step.bind(this), 2000);
    }else if(this._step === 5){
      this._msgText.text("Ready? Don't move!");
      setTimeout(this.step.bind(this), 2000);
    }else if(this._step === 6){
      this._msgText.text("Recording...");
      this._recording = true;
      this._ignoreTrigger = true;
      // setTimeout(this.step.bind(this), 1000);
    }else if(this._step === 7){
      this._msgText.text("Well done! that was easy");
      this._recording = false;
      this._ignoreTrigger = false;
      setTimeout(this.step.bind(this), 2000);
    }else if(this._step === 8){
      this._msgText.text("Now, just draw a random shape");
      this._recording = true;
    }else if(this._step === 9){
      this._msgText.text("Once more, another random shape");
    }else if(this._step === 10){
      this._msgText.text("OK, processing....");
      this._recording = false;
      this.learn();
    }

    this._msgHeader.text(this._step);
  };

  /**
   * Adds a new training set.
   * @param inputs is an array of input data.
   * @param output is the value of the output for the
   * current input (1 or 0);
   * @returns true on success or false on error.
   */
  GestureController.addGesture = function(inputs, output){
    if(inputs.length){
      console.log("Adding input set: ", inputs, "For output: ", output);
      this.trainingSet.push({
        input: inputs,
        output: output
      });

      return true;
    }else{
      console.log("The given input is empty!");
      return false;
    }
  }

  GestureController.deleteRecording = function(el){
    var index = $(el.currentTarget).attr("data-index");
    this.gestures.recording.splice(Number(index), 1);
    this.displayRecordings();
  };

  GestureController.addRecording = function(el){
    this.gestures.recording.push({
      name: '',
      index: this.gestures.recording.length,
      dataset: []
    });

    this.displayRecordings();
  };

  // Uses the current data set to train
  // the network.
  GestureController.learn = function(){
    if(!this.trainingSet.length){
      console.log("No training set defined. Use Record!");
      return;
    }

    // this._propContainer.find("#btSave").addClass("disabled");
    this._propContainer.find("#btRecord").addClass("disabled");

    console.log("Training network...");
    // We need to find out the numer of inputs required.
    var maxInputs = 0;
    var mean = 0;
    for(var set of this.trainingSet){
      if(set.input.length > maxInputs){
        maxInputs = set.input.length;
        mean += set.input.length;
      }
    }

    mean /= this.trainingSet.length;

    // this._maxInputs = maxInputs;
    console.log("Creating %d input layers", mean);

    this._perceptron = new synaptic.Architect.LSTM(40, 20, 3);
    var trainer = new synaptic.Trainer(this._perceptron);

    var trainingOptions = {
      rate: .1,
      iterations: 20000,
      error: .005,
    }

    var that = this;
    trainer.trainAsync(this.trainingSet, trainingOptions).then(function(results){
      console.log('Network trained!', results);
      that._propContainer.find("#btHear").removeClass("disabled");
      that._propContainer.find("#msgContainer").remove();
      that._msgHeader.text("Done!");
      that._msgText.text("");
    });
  };

  // Listens for readings and send them to the
  // network.
  GestureController.startListening = function(){
    if(!this._listening){
      this._propContainer.find("#btHear i").removeClass("play").addClass("stop");
      this._msgHeader.text("");
      this._listening = true;
      this._currentInput = [];
    }else{
      this._listening = false;
      this._propContainer.find("#btHear i").removeClass("stop").addClass("play");
      return;
    }
  };

  // Cotext controller
  GestureController.displayRecordings = function(){
    Ppanel.clear();
    // Render the template
    var html = $(this.propTemplate(this.gestures));

    html.find("#btRecord").click(this.startRecording.bind(this));
    html.find("#btDelete").click(this.deleteRecording.bind(this));
    html.find("#btAdd").click(this.addRecording.bind(this));
    // html.find("#btSave").click(this.learn.bind(this));
    html.find("#btHear").click(this.startListening.bind(this));
    this._msgHeader = html.find("#msgHeader");
    this._msgText = html.find("#msgText");

    var textChanged = function(el){
      var index = $(el.currentTarget).attr("data-index");
      this.gestures.recording[Number(index)].name = el.currentTarget.value;
      this.updateInputList();
    }

    this.updateInputList();

    html.find("#txtName").change(textChanged.bind(this));

    this._propContainer = html;
    // Display elements
    easy.displayCustomSettings(this._propContainer, true);
  };

  GestureController.updateInputList = function(){
    // Build my actions based on the number of recordings
    this._inputs = [];
    for(var rec of this.gestures.recording){
      this._inputs.push(rec.name);
    };
  };

  /**
   * Parent is send new data (using outputs).
   */
  GestureController.onNewData = function(data) {
    // Because data inputs arrive one by one, we need to wait for them all.
    for(output in data){
      if(this._lastData.hasOwnProperty(output)){
        this._lastData[output] = data[output];
      }
    }

    if(this._lastData.x !== undefined &&
      this._lastData.y !== undefined &&
      this._lastData.z !== undefined){
        // Add the info to the data set
        this.addDataSet(this._lastData);
        // clear data for the next round
        this._lastData = {x:undefined, y:undefined, z:undefined};
      }
  };

  // Called when there is enough data available
  GestureController.addDataSet = function(set){
    // Normalize data:
    var nX = (Number(set.x)+32)/64;
    var nY = (Number(set.y)+32)/64;
    var nZ = (Number(set.z)+32)/64;

    // Implementing basic segmentation as proposed by Mark Joselli and
    // Esteban Clua in their paper:
    // http://www2.ic.uff.br/~esteban/files/papers/SBGames09_Mark_A.pdf
    var d = Math.sqrt(Math.pow(nX-this._prevX, 2) + Math.pow(nY-this._prevY, 2) + Math.pow(nZ-this._prevZ, 2));

    this._prevX = nX;
    this._prevY = nY;
    this._prevZ = nZ;

    if((d > 0.25 || this._ignoreTrigger === true) && this._gestureStarted === false){
      this._gestureStarted = true;
      this._gestureStartTime = new Date().getTime();
      console.log("Gesture started");
      if(this._listening){
        this._msgHeader.text("Listening...");
      }
    }else if(this._gestureStarted === true && d < 0.95){
      var now = new Date().getTime();
      // A gesture MUST last for at least 1 second
      if((now - this._gestureStartTime) > 1000){
        this._gestureStarted = false;
        console.log("Gesture stopped");
        this._msgHeader.text("Processing...");
        if(this._recording){
          this.addGesture(this._currentInput, [(this._step > 7), (this._step == 6), (this._step < 4)]);
          this._currentInput = [];
          this.step();
        }else if(this._listening){
          var results = this._perceptron.activate(this._currentInput);
          console.log("Done, results: ", results);
          this._currentInput = [];
          if(results[2] > 0.85){
            this._msgHeader.text("Recognized!");
            var obj = {};
            obj[String(this._propContainer.find("#txtName").val()).toLowerCase()] = true;

            // Send my data to anyone listening
            this.callListeners(obj);
            // Send data to logic maker for processing
            this.callGates(obj);
          }else{
            this._msgHeader.text("");
          }
        }
      }
    }

    if(this._gestureStarted){
      if(this._recording || this._listening){
        this._currentInput.push(nX, nY, nZ);
      }
    }

  };


  return GestureController;

});
