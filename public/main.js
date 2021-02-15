$(function() {
  const FADE_TIME = 50; // ms
  const TYPING_TIMER_LENGTH = 5; // ms
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
  const $setupTime = $('.setupTime');         // Timer setup input box
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

  // Log a message
  const log = (message, options) => {
    const $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    const $typingMessages = getTypingMessages(data);
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    const $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    const $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    const typingClass = data.typing ? 'typing' : '';
    const $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

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
  $setupPage.click(() => {
    $setupTime.focus();
  });


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
    let time = $setupTime.val();
    startTimerForEveryone(time);
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

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    // Display the welcome message
    const message = 'Welcome to Socket.IO Chat – ';
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

  // Whenever the server emits 'stop timer', start the timer
  socket.on('stop timer', (data) => {
    console.log(`${data.username} has stopped the timer.`);
    fadeOutTimerPage();
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

});
