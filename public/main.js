$(function() {
  const FADE_TIME = 150; // ms
  const TYPING_TIMER_LENGTH = 150; // ms
  const COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  const $window = $(window);
  const $usernameInput = $('.usernameInput'); // Input for username
  const $messages = $('.messages');           // Messages area
  const $inputMessage = $('.inputMessage');   // Input message input box
  // const $setupTime = $('.setupTime');         // Timer setup input box
  const $timerButton = $('.timerButton');     // Timer button
  const $time = $('.time');                   // Time

  const $loginPage = $('.login.page');        // The login page
  const $chatPage = $('.chat.page');          // The chatroom page
  const $setupPage = $('.setup.page');        // The timer setup page
  const $timerPage = $('.timer.page');        // The timer page

  const socket = io();

  // Prompt for setting a username
  let username;
  let connected = false;
  let typing = false;
  let lastTypingTime;
  let $currentInput = $usernameInput.focus();
  let settingupTimer = false;
  let timeinterval;
  let startBreakTime = 0;

  // Default for study session
  let studyTime = 40;
  // Default for break session
  let breakTime = 10;

  const addParticipantsMessage = (data) => {
    let message = '';
    if (data.numUsers === 1) {
      message += `there's 1 participant`;
    } else {
      message += `there are ${data.numUsers} participants`;
    }
    log(message);
  }

  // Sets the client's username
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      if(username.startsWith('dev')) {
        let customTime = Number(username.substring(3));
        studyTime = customTime;
        breakTime = customTime;
        console.log(`set custom time ${customTime}`);
      }

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  const sendMessage = () => {
    let message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({ username, message });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message on the chat window
  const log = (message, options) => {
    const $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  // data object must contain: username, message
  // data object might otherwise contain: typing
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    const $typingMessages = getTypingMessages(data);
    if ($typingMessages.length !== 0) {
      if(options && typeof options.fade !== 'undefined') {
        options.fade = false;
      }
      
      $typingMessages.remove();
    }

    const $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    const $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    const typingClass = data.typing ? 'typing' : ''; // Whether it is a 'is typing' visual
    const $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)                      // Queried by getTypingMessages()
      .append($usernameDiv, $messageBodyDiv);


    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat message to the message list
  // data object must contain: username, file
  const addImgMessage = (data, options) => {
    const $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    const $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);
    let $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .append($usernameDiv, $messageBodyDiv);
    
    let filetype = data.fileName.split('.').pop();
    if (filetype == 'mp4' || filetype == 'ogg' || filetype == 'mkv') {
      $messageDiv.html(`<video class="imgupload" src="${data.file}" height="400" width="400" controls/>`);
    } else if (filetype == 'mp3' || filetype == 'wav' || filetype == 'aac') {
      $messageDiv.html(`<audio class="imgupload" src="${data.file}" height="400" width="400" controls/>`);
    } else {
      $messageDiv.html(`<img class="imgupload" src="${data.file}" height="200" width="200" onclick="showing(this)"/>`);
    }

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    const $el = $(el);
    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }

    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  const cleanInput = (input) => {
    return $('<div/>').text(input).html();
  }

  // Updates the typing event
  const updateTyping = () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        const typingTimer = (new Date()).getTime();
        const timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  const getTypingMessages = (data) => {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  const getUsernameColor = (username) => {
    // Compute hash code
    let hash = 7;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    const index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if(settingupTimer) {
        setTimer();
      }
      else if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', () => {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
  });

  // Focus input when clicking on the timer setup input's border
  // $setupPage.click(() => {
  //   $setupTime.focus();
  // });


  $timerButton.on("click", () => {
    showTimerSetupPage();
  });

  $timerPage.click(() => {
    stopTimerForEveryone();
  });

  // Timer setup

  const showTimerSetupPage = () => {
    $chatPage.fadeOut();
    $setupPage.show();
    
    settingupTimer = true;
  };

  const setTimer = () => {
    // let time = $setupTime.val();
    startTimerForEveryone(studyTime);
    settingupTimer = false;
  };

  // Timer 
  function getTimeRemaining(endtime){
    const total = endtime;
    const seconds = Math.floor((total/1000) % 60 );
    const minutes = Math.floor((total/1000/60) % 60 );
    const hours = Math.floor((total/(1000*60*60)) % 24 );

    return {
      total,
      hours,
      minutes,
      seconds
    };
  }

  const showTimerPageAndCountdown = (time) => {
    $chatPage.fadeOut();
    $setupPage.fadeOut();
    $time.html("");
    $timerPage.show();
    clearInterval(timeinterval);

    // Convert from min to ms
    let endtime = time*60.*1000.;
    timeinterval = setInterval(() => {
      const t = getTimeRemaining(endtime);
      endtime -= 1000;
      $time.html(("0" + t.hours).slice(-2)   + ":" + 
                ("0" + t.minutes).slice(-2) + ":" + 
                ("0" + t.seconds).slice(-2));
      if (t.total <= 0) {
        clearInterval(timeinterval);
        stopTimerForEveryone();
      }
    },1000);
  };

  const fadeOutTimerPage = () => {
    clearInterval(timeinterval);
    $chatPage.show();
    $setupPage.fadeOut();
    $timerPage.fadeOut();
    // flag for break time
    startBreakTime += 1;
    startBreakTimeForEveryone();
  };

  // start break time for everyone
  const startBreakTimeForEveryone = () => {
    if (startBreakTime == 1) {
        console.log("startBreakTimeForEveryone" + startBreakTime);
        socket.emit('start break timer', breakTime);
    }
  }

  // break time countdown
  const breakTimeCountdown = (time) => {
    clearInterval(timeinterval);
    console.log("break time countdown" + time);
    // Convert from min to ms
    let endtime = time*60.*1000.;
    timeinterval = setInterval(() => {
      const t = getTimeRemaining(endtime);
      endtime -= 1000;
      $time.html(("0" + t.hours).slice(-2)   + ":" + 
                ("0" + t.minutes).slice(-2) + ":" + 
                ("0" + t.seconds).slice(-2));
      if (t.total <= 0) {
        clearInterval(timeinterval);
        stopBreakForEveryone();
      }
    },1000);
  };

  const startTimerForEveryone = (time) => {
    settingupTimer = false;
    socket.emit('start timer', time);
    let plural = time <= 1 ? "" : "s";
    console.log(`SELF has started the timer for ${time} minute${plural}.`);
    showTimerPageAndCountdown(time);
  };

  const stopTimerForEveryone = () => { 
    settingupTimer = false;
    socket.emit('stop timer');
    console.log('triggering timer stop');
    fadeOutTimerPage();
  };

  const stopBreakForEveryone = () => { 
    console.log('triggering break time stop');
    socket.emit('stop break timer');
  };

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    // Display the welcome message
    const message = 'Welcome to MyDeskmate – ';
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', (data) => {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', (data) => {
    log(`${data.username} joined`);
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', (data) => {
    log(`${data.username} left`);
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', (data) => {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', (data) => {
    removeChatTyping(data);
  });

  // Whenever the server emits 'start timer', start the timer
  socket.on('start timer', (data) => {
    let plural = data.time <= 1. ? "" : "s";
    console.log(`${data.username} has started the timer for ${data.time} minute${plural}.`);

    console.log('triggering timer start');
    showTimerPageAndCountdown(data.time);
  });

  // Whenever the server emits 'start break timer', start the timer
  socket.on('start break timer', (data) => {
    console.log('triggering break timer start');
    breakTimeCountdown(data.time);
  });

  // Whenever the server emits 'stop timer', start the timer
  socket.on('stop timer', (data) => {
    console.log(`${data.username} has stopped the timer.`);
    fadeOutTimerPage();
  });

  socket.on('stop break timer', (data) => {
    console.log(`${data.username} has stopped the timer.`);
    startTimerForEveryone(studyTime);
  });

  socket.on('disconnect', () => {
    log('you have been disconnected');
  });

  socket.on('reconnect', () => {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    log('attempt to reconnect has failed');
  });

  socket.on('base64 file', (data) => {
    //hide progress msg when data received
    $('#progress').hide();
    //appending data according to data types
    addImgMessage(data);
  })

  // Helper

  $('#uploadfile').bind('change', async function (event) {
  
    const imageFile = event.target.files[0];
    console.log('originalFile instanceof Blob', imageFile instanceof Blob); // true
    console.log(`originalFile size ${imageFile.size / 1024 / 1024} MB`);

    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 600,
      useWebWorker: true
    }
    try {
      const compressedFile = await imageCompression(imageFile, options);
      console.log('compressedFile instance of Blob', compressedFile instanceof Blob); // true
      console.log(`compressedFile size ${compressedFile.size / 1024 / 1024} MB`); // smaller than maxSizeMB

      await readThenSendFile(compressedFile); //readin the compressed file
    } catch (error) {
      console.log(error);
      await readThenSendFile(imageFile); // if filetype is not image then sent orignal data without compression
    }

  });

  function readThenSendFile(data) {

    //show progress msg
    $('#progress').fadeIn(100);

    var reader = new FileReader();
    reader.onload = function (evt) {
      var msg = {};
      msg.username = username;
      msg.file = evt.target.result;
      msg.fileName = data.name;
      socket.emit('base64 file', msg);
    };
    reader.readAsDataURL(data);

    reader.onprogress = function (currentFile) {
      if (currentFile.lengthComputable) {
        var progress = parseInt(((currentFile.loaded / currentFile.total) * 100), 10);
        $('#percentage').html(progress);
        console.log(progress);
      }
    }
    reader.onerror = function () {
      alert("Could not read the file: large file size");
    };
  }
});
