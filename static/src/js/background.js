function openOrFocusOptionsPage() {
   var optionsUrl = chrome.extension.getURL('options.html'); 
   chrome.tabs.query({}, function(extensionTabs) {
      var found = false;
      for (var i=0; i < extensionTabs.length; i++) {
         if (optionsUrl == extensionTabs[i].url) {
            found = true;
            console.log("tab id: " + extensionTabs[i].id);
            chrome.tabs.update(extensionTabs[i].id, {"selected": true});
         }
      }
      if (found == false) {
          chrome.tabs.create({url: "index.html"});
      }
   });
}
chrome.extension.onConnect.addListener(function(port) {
  var tab = port.sender.tab;
  // This will get called by the content script we execute in
  // the tab as a result of the user pressing the browser action.
  port.onMessage.addListener(function(info) {
    var max_length = 1024;
    if (info.selection.length > max_length)
      info.selection = info.selection.substring(0, max_length);
      openOrFocusOptionsPage();
  });
});

// Called when the user clicks on the browser action icon.
chrome.browserAction.onClicked.addListener(function(tab) {
   openOrFocusOptionsPage();
});
window.odoo_chrome_gcm = _.clone(openerp);
odoo_chrome_gcm_db(odoo_chrome_gcm);
odoo_chrome_gcm_db_background = new odoo_chrome_gcm.odoo_chrome_gcm_db();

function on_message_receive(message) {
    var notificationID = odoo_chrome_gcm_db_background.getNotificationId();
    message['notification_id'] = notificationID;
    odoo_chrome_gcm_db_background.save_mesages('messages', message);
    var messageString = "";
    var title = message.data.subject;
    var body = message.data.message;
    // Pop up a notification to show the GCM message.
    chrome.notifications.create(notificationID, {
        title: title,
        iconUrl: 'static/src/img/logo.png',
        type: 'basic',
        message: body,
        isClickable: true
    }, function() {});
    var audio = new Audio('static/src/audio/bells-message.mp3');
    audio.play();
};
function on_message_click(notificationId) {
    var message = odoo_chrome_gcm_db_background.get_msg_by_notif_id(notificationId);
    odoo_chrome_gcm_db_background.remove_msg_by_notif_id(notificationId);
    window.open(message.data.url);
}
function on_message_close(notificationId) {
    odoo_chrome_gcm_db_background.remove_msg_by_notif_id(notificationId);
}
chrome.gcm.onMessage.addListener(on_message_receive);
chrome.notifications.onClicked.addListener(on_message_click);
chrome.notifications.onClosed.addListener(on_message_close);

setTimeout(function() {on_message_receive({data: {'subject': "Test Message", 'message': 'Hi, this is test message \n Testing message list', 'res_id': 1, 'model': 'sale.order'}}), 3000});