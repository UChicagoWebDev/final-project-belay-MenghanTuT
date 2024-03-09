// Placeholder for previous channels data to check for changes
let previousChannels = [];

let channellistPollingInterval = null
let channelmessagePollingInterval = null

// Constants to easily refer to pages
const SPLASH = document.querySelector(".splash");
const PROFILE = document.querySelector(".profile");
const LOGIN = document.querySelector(".login");
const ROOM = document.querySelector(".room");

// Custom validation on the password reset fields
const passwordField = document.querySelector(".profile input[name=password]");
const repeatPasswordField = document.querySelector(".profile input[name=repeatPassword]");
const repeatPasswordMatches = () => {
  const p = document.querySelector(".profile input[name=password]").value;
  const r = repeatPassword.value;
  return p == r;
};

const checkPasswordRepeat = () => {
  const passwordField = document.querySelector(".profile input[name=password]");
  if(passwordField.value == repeatPasswordField.value) {
    repeatPasswordField.setCustomValidity("");
    return;
  } else {
    repeatPasswordField.setCustomValidity("Password doesn't match");
  }
}

passwordField.addEventListener("input", checkPasswordRepeat);
repeatPasswordField.addEventListener("input", checkPasswordRepeat);

// TODO:  On page load, read the path and whether the user has valid credentials:
//        - If they ask for the splash page ("/"), display it
//        - If they ask for the login page ("/login") and don't have credentials, display it
//        - If they ask for the login page ("/login") and have credentials, send them to "/"
//        - If they ask for any other valid page ("/profile" or "/room") and do have credentials,
//          show it to them
//        - If they ask for any other valid page ("/profile" or "/room") and don't have
//          credentials, send them to "/login", but remember where they were trying to go. If they
//          login successfully, send them to their original destination
//        - Hide all other pages

document.addEventListener('DOMContentLoaded', () => {
  // localStorage.clear();
  load_page();
});

//page rendering
function load_page(){
  updateContentPlaceholdersUsername();
  clearInterval(channellistPollingInterval)
  clearInterval(channelmessagePollingInterval)
  const apiKey = localStorage.getItem('menghanjia_apiKey');
  const path = window.location.pathname;
if (!apiKey){console.log("pageload: not found apiKey")} else{console.log("pageload:", apiKey)}
  if (!apiKey) {
    if (path === '/login') {
      showPage(LOGIN);
      showcorrectlogin();
    } else {
      showPage(SPLASH);
      showcorrectSPLASH(apiKey);
    }
  } else {
    if (path == '/profile') {
      showPage(PROFILE);
      showcorrectprofile();
    } else if (path.startsWith('/room')) {
      showPage(ROOM);
      showcorrectroom();
    } else {
      showPage(SPLASH);
      showcorrectSPLASH(apiKey);
    }
  }
}

// tools
    //Page rendering tools
function hideAllPages() {
  SPLASH.style.display = 'none';
  PROFILE.style.display = 'none';
  LOGIN.style.display = 'none';
  ROOM.style.display = 'none';
}

function showPage(page) {
  hideAllPages();
  page.style.display = 'block';
}

    //Username rendering tool
function updateContentPlaceholdersUsername() {
  const username = localStorage.getItem('menghanjia_username'); 
  document.querySelector('.splash .username').textContent = `Welcome back, ${username}`;
  document.querySelector('.profile .username').textContent = `${username} -> Home Page`;
  document.querySelector('.room .username').textContent = `${username}`;
}

    //redirect tool
function navigateTo(url) {
  window.history.pushState({}, '', url);
  load_page()
}

//Actions
    //Global
    async function signup(){
          try {
            const response = await fetch('/api/signup', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            if (response.ok) {
              const data = await response.json();
              localStorage.setItem('menghanjia_apiKey', data.api_key); 
              localStorage.setItem('menghanjia_username', data.name);
              //debug
              console.log("signup feedback:", "name:", data.name, "api:", data.api_key, "password", data.password)
              navigateTo("/profile");
            } else {
              console.error('Signup failed');
            }
          } catch (error) {
            console.error('Error during signup', error);
          }
        }
    //Splash
    
    //Login
    async function login(username, password) {
      //debug
      console.log("login:", "username:", username, "password:", password)
    
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({username, password}),
        });
        if (response.ok) {
          // If login is successful
          const data = await response.json();
          localStorage.setItem('menghanjia_apiKey', data.api_key);
          localStorage.setItem('menghanjia_username', username);
          navigateTo("/profile");
        } else {
          // If login is unsuccessful, show the .failed message for 2.5s
          document.querySelector('.login .failed').style.display = 'block';
          document.querySelector('.login .failed .message').style.display = 'block';
          setTimeout(function(){
            document.querySelector('.login .failed .message').style.display = 'none';
          },2500);
        }
      } catch (error) {
        console.error('Login error:', error);
      }
    }

    //Profile
    async function UpdateUsername(){
      const usernameInput = document.querySelector('.profile .auth input[name="username"]');
      const apiKey = localStorage.getItem('menghanjia_apiKey');
      try {
          const response = await fetch('/api/username', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `${apiKey}` 
              },
              body: JSON.stringify({ username: usernameInput.value })
          });
          if (!response.ok) throw new Error('Failed to update username');
          alert('Username updated successfully');
          await localStorage.setItem('menghanjia_username', usernameInput.value);
          updateContentPlaceholdersUsername()
      } catch (error) {
          console.error('Error updating username:', error);
      }
    }

    async function updatePassword() {
      const passwordInput = document.querySelector('.profile .auth input[name="password"]');
      const repeatPasswordInput = document.querySelector('.profile .auth input[name="repeatPassword"]');
      const apiKey = localStorage.getItem('menghanjia_apiKey');
      if (passwordInput.value !== repeatPasswordInput.value) {
            alert('Passwords do not match');
          return;
      }
      if (!passwordInput.value) {
        alert('empty value alert');
      return;
      }
      try {
          const response = await fetch('/api/password', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `${apiKey}`
              },
              body: JSON.stringify({ password: passwordInput.value })
          });
          if (!response.ok) throw new Error('Failed to update password');
          alert('Password updated successfully');
      } catch (error) {
          console.error('Error updating password:', error);
      }
    }

    //room
    // Function to fetch channels and update the UI if there are changes
    async function create_channel(channelName){
      try {
        const apiKey = localStorage.getItem('menghanjia_apiKey');
        const response = await fetch('/api/channel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${apiKey}` 
            },
            body: JSON.stringify({ name: channelName })
        });
        if (response.ok) {
          const data = await response.json();
          //debug
          console.log("Create channel:", "id:", data.id, "name:", data.name)
        } else {
          console.error('Channel creation failed');
        }
      } catch (error) {
        console.error('Error during channel creation', error);
      }
    }
    
    async function post_message(){
      try {
        const channelId = localStorage.getItem('menghanjia_channelId');
        messageBody = document.querySelector('textarea[name="commentandchannel"]').value;
        const apiKey = localStorage.getItem('menghanjia_apiKey');
        if (!messageBody.trim()) {
          alert("Message cannot be empty");
          return;
        }
        const response = await fetch(`/api/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${apiKey}` 
            },
            body: JSON.stringify({
              body: messageBody
            })
        });
        if (response.ok) {
          const data = await response.json();
          console.log("Message posted successfully", data);
          document.querySelector('textarea[name="commentandchannel"]').value = '';
        } else {
          console.error('Posting message failed');
        }
      } catch (error) {
        console.error('Error during posting message', error);
      }
    }

    async function post_reply(){
      try {
        const channelId = localStorage.getItem('menghanjia_channelId');
        const repliedMassageId = localStorage.getItem('menghanjia_selecteddialogue')
        messageBody = document.querySelector('textarea[name="reply"]').value;
        const apiKey = localStorage.getItem('menghanjia_apiKey');
        if (!messageBody.trim()) {
          alert("Reply cannot be empty");
          return;
        }
        const response = await fetch(`/api/channels/${channelId}/replies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${apiKey}` 
            },
            body: JSON.stringify({
              body: messageBody,
              replied_to: repliedMassageId
            })
        });
        if (response.ok) {
          const data = await response.json();
          console.log("Message posted successfully", data);
          document.querySelector('textarea[name="commentandchannel"]').value = '';
        } else {
          console.error('Posting message failed');
        }
      } catch (error) {
        console.error('Error during posting message', error);
      }
    }

    async function fetchChannelsAndUpdateUI() {
      //debug
      // console.log("Channel polling")
      try {
        const apiKey = localStorage.getItem('menghanjia_apiKey');
        const response = await fetch('/api/channels', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `${apiKey}` 
          },
        });
        if (response.ok) {
          const channels = await response.json();
          if (JSON.stringify(channels) !== JSON.stringify(previousChannels)) {
            const channelListDiv = document.querySelector('.ChannelList');
            // Clear existing channel list except for the title
            channelListDiv.innerHTML = '<div>Channels:</div>';
            channels.forEach(channel => {
              const channelElement = document.createElement('div');
              channelElement.className = 'channel';
              channelElement.textContent = `Channel ${channel.id}: ${channel.name}`;
              // Use data attributes to store the channel id 
              channelElement.dataset.channelId = channel.id;
              channelListDiv.appendChild(channelElement);
            });
            previousChannels = channels; 
            // Update the placeholder for next comparison
          }
        } else {
          console.error('Get channels failed');
        }
      } catch (error) {
        console.error('Error during getting channels', error);
      }
    }
    
    async function fetchMessagesAndUpdateUI(channelId) {
      try {
          const apiKey = localStorage.getItem('menghanjia_apiKey');
          const response = await fetch(`/api/channels/${channelId}/messages`, {
              method: 'GET',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `${apiKey}`
              },
          }); 
          if (response.ok) {
              const messages = await response.json();

              //debug
              console.log(messages)

              const chatBoxDiv = document.querySelector('.chat-box .messages');
              // Clear existing messages
              chatBoxDiv.innerHTML = '';
              messages.forEach(message => {
                  // Create a dialogue
                  const dialogueElement = document.createElement('dialogue');
                  // Append the main message
                  const messageElement = document.createElement('message');
                  messageElement.innerHTML = `<author>${message.username}</author>
                                              <content>${message.body}</content>`;
                  dialogueElement.appendChild(messageElement);
                  
                  // Append replies, if any
                  if (message.replies && message.replies.length) {
                      message.replies.forEach(reply => {
                          const replyElement = document.createElement('reply');
                          replyElement.innerHTML = `<author>${reply.username}</author>
                                                    <content>${reply.body}</content>`;
                          dialogueElement.appendChild(replyElement);
                      });
                  }
                  // Add the dialogue to the chat box
                  dialogueElement.dataset.messageId = message.id;
                  chatBoxDiv.appendChild(dialogueElement);
              });
          } else {
              console.error('Get messages failed');
          }
      } catch (error) {
          console.error('Error during getting messages', error);
      }
    }

//Splash page rendering
function Splashlistener(){
  document.querySelector('.create').addEventListener('click', () => { 
      navigateTo("/room");
    });
    document.querySelector('.loggedIn').addEventListener('click', () => {
      navigateTo("/profile");
    });
    document.querySelector('.loggedOut a').addEventListener('click', () => {
      navigateTo("/login");
    });
    document.querySelector('.signup').addEventListener('click', async () => {
      signup();
      // debug
      console.log("action: sign up")
    });
}
Splashlistener();
function showcorrectSPLASH(apikey)
{
  const LOGGEDIN = document.querySelector(".loggedIn"); // for logged-in users
  const LOGGEDOUT = document.querySelector(".loggedOut"); // for logged-out users
  const CREATE_BUTTON = document.querySelector(".create"); // for logged-in users
  const SIGNUP_BUTTON = document.querySelector(".signup"); // for logged-out users

  // Initially hide both sections
  LOGGEDOUT.style.display = 'none';
  LOGGEDIN.style.display = 'none';
  CREATE_BUTTON.style.display = 'none';
  SIGNUP_BUTTON.style.display = 'none'; 

  if(apikey) {
    // User is logged in
    LOGGEDIN.style.display = 'block';
    CREATE_BUTTON.style.display = 'block';
  } else {
    // No apikey, user is logged out
    LOGGEDOUT.style.display = 'block';
    SIGNUP_BUTTON.style.display = 'block';
  }
}

//Login page rendering
function Loginlistener(){
  const loginButton = document.querySelector('.login .alignedForm button');
  loginButton.addEventListener('click', async (event) => {
    event.preventDefault();
    const username = document.querySelector('.login input[name="username"]').value;
    const password = document.querySelector('.login input[name="password"]').value;
    await login(username, password);
  });

  const createNewAccount = document.querySelector('.login .failed button');
  createNewAccount.addEventListener('click',() => {
    signup();
      // debug
      console.log("action: sign up")
  });
}
Loginlistener();
function showcorrectlogin(){
  document.querySelector('.login .failed').style.display = 'none';
}

//Profile page rendering
function Profilelistener(){
  const updateUsernameButton = document.querySelector('.profile .auth input[name="username"] + button');
  const updatePasswordButton = document.querySelector('.profile .auth input[type="password"] + button');
  updateUsernameButton.addEventListener('click', () => {
    console.log("updateUsername();");
    UpdateUsername()
  });
  updatePasswordButton.addEventListener('click', () => {
    console.log("updatePassword();");
    updatePassword()
  });

  document.querySelector('.profile .header .welcomeBack').addEventListener('click', () => {
      navigateTo('/');
  });

  document.querySelector('.profile .goToSplash').addEventListener('click', () => {
    navigateTo('/room');
  });

  document.querySelector('.profile .logout').addEventListener('click', () => {
    // Removing items from localStorage
    localStorage.clear();
    navigateTo('/');
  });
}
Profilelistener();
function showcorrectprofile(){
  const username = localStorage.getItem('menghanjia_username');
  const usernameInput = document.querySelector('.profile .auth input[name="username"]');
  if (usernameInput) {
    usernameInput.value = username;
    // console.log(username);
  }
  
  //Will not show, for password is null
  const password = localStorage.getItem('menghanjia_password');
  const passwordInput = document.querySelector('.profile .auth input[name="password"]');
  const repeatPasswordInput = document.querySelector('.profile .auth input[name="repeatPassword"]');
  if (passwordInput) {
    passwordInput.value = password; 
    // console.log(password);
  }
  if (repeatPasswordInput) repeatPasswordInput.value = password;
}

//Room page rendering
function Roomlistener(){
  document.querySelector('.ChannelList').addEventListener('click', function(event) {
  const target = event.target.closest('.channel[data-channel-id]');
  if (!target) return; // If the clicked element is not a channel div, do nothing
  const channelId = target.dataset.channelId; // Get the channel id from the clicked element
  //........................
  localStorage.setItem("menghanjia_channelId", channelId)
  fetchMessagesAndUpdateUI(channelId)
  
  channelmessagePollingInterval = startChannelMessagePolling()
  console.log(channelId);
  });

  const chatBoxDiv = document.querySelector('.chat-box .messages');
  chatBoxDiv.addEventListener('click', function(event) {
        let target = event.target;
        // if (!target.matches('.message-content, .message-content *')) {
        // // if (!target.matches('.message')) {
        //     console.log("return")
        //     return;
        // }
        let dialogueElement = target.closest('dialogue');
        const previouslySelected = chatBoxDiv.querySelector('.selected_dialogue');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected_dialogue');
            previouslySelected.style.backgroundColor = '';
        }
        dialogueElement.classList.add('selected_dialogue');
        dialogueElement.style.backgroundColor = 'red';
//debug
// console.log(dialogueElement.dataset.messageId)
        localStorage.setItem('menghanjia_selecteddialogue', dialogueElement.dataset.messageId)
  });

  document.querySelector('.create-channel').addEventListener('click', function() {
    channelName = document.querySelector('textarea[name="commentandchannel"]').value;
    create_channel(channelName);
  })

  document.querySelector('.room .sidebar .post').addEventListener('click', function() {
    post_message();
  })

  document.querySelector('.room .sidebar .reply').addEventListener('click', function() {
    post_reply();
  })
}
Roomlistener();
function showcorrectroom(){
  fetchChannelsAndUpdateUI();
  channellistPollingInterval = startChannellistPolling()
}

function startChannellistPolling(){
  //debug
  // console.log("Channel list polling start!")
  channellistPollingInterval = setInterval(() => {
    fetchChannelsAndUpdateUI();
  }, 50000); //check every 1000ms
  return channellistPollingInterval
}

function startChannelMessagePolling(){
  //debug
  // console.log("Channel massage polling start!")
  channelmessagePollingInterval = setInterval(() => {
    fetchMessagesAndUpdateUI(localStorage.getItem("menghanjia_channelId"));
  }, 1000); //check every 1000ms
  return channelmessagePollingInterval
}

