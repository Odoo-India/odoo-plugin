function odoo_chrome_gcm_db(odoo_chrome_gcm) {

    //Important Note: we can use chrome.storage instead of localstorage
    odoo_chrome_gcm.odoo_chrome_gcm_db = openerp.Class.extend({
        load: function(name, def) {
            //To load data from localstorage
            var data = localStorage[name];
            if (data !== undefined && data !== "") {
                data = JSON.parse(data);
                return data;
            } else {
                return def || false;
            }
        },
        save: function(name, data) {
            //To save data in localstorage
            localStorage[name] = JSON.stringify(data);
        },
        clear: function(name) {
            localStorage.removeItem(name);
        },
        //Create save_message and save_messages two methods
        save_mesages: function(name, message) {
            var data = this.load(name, []);
            message.count = 1;
            for(var i = 0, len = data.length; i < len; i++) {
                if(data[i].data.message_id == message.data.message_id) {
                    _.extend(data[i], message);
                    this.save('messages',data);
                    return;
                }
                if (data[i].data.res_id == message.data.res_id && data[i].data.model == message.data.model) {
                    if (message.count) {
                        message.count += 1;
                    }
                    _.extend(data[i], message);
                    this.save('messages',data);
                    return;
                }
            }
            data.unshift(message);
            this.save('messages', data);
        },
        getNotificationId: function() {
            var id = Math.floor(Math.random() * 9007199254740992) + 1;
            return id.toString();
        },
        get_msg_by_notif_id: function(notification_id) {
            var datas = this.load('messages');
            var message = _.find(datas, function(data) { return data.notification_id == notification_id.toString(); });
            return message;
        },
        remove_msg_by_notif_id: function(notification_id) {
            var datas = this.load('messages');
            var datas = _.filter(datas, function(data) { return data.notification_id != notification_id.toString(); });
            this.save('messages', datas);
        },
        remove_all_msg: function() {
            this.save('messages', []);
        },
        change_messsage_date: function(notification_id, date) {
            message = this.get_msg_by_notif_id(notification_id);
            console.log("message is ::: ", message, date);
            message.data.receive_date = date;
            this.save_mesages('messages', message);
        },
        clear_storage: function() {
            localStorage.clear();
        },
    });
}