function odoo_chrome_gcm_widget(odoo_chrome_gcm) {
    'use strict';
    var QWeb = openerp.qweb,
        _t = odoo_chrome_gcm._t;

    odoo_chrome_gcm.odoo_chrome_gcm_main_widget = openerp.Widget.extend({
        template: "OdooChromeGCM",
        init: function () {
            this._super.apply(this, arguments);
            //var background = chrome.extension.getBackgroundPage();
            //this.odoo_chrome_gcm_db = background.odoo_chrome_gcm_db_background;
            this.odoo_chrome_gcm_db = new odoo_chrome_gcm.odoo_chrome_gcm_db();

        },
        start: function () {
            var self = this;
            this._super.apply(this, arguments);
            this.build_widgets();
            this.check_default_screen().done(function () {
                self.screen_selector.default_screen = 'message_list_screen';
                self.screen_selector.set_default_screen();
            }).fail(function () {
                self.screen_selector.default_screen = 'register_screen';
                self.screen_selector.set_default_screen();
            });
        },
        check_default_screen: function () {
            var messages = this.odoo_chrome_gcm_db.load('messages');
            var def = $.Deferred();
            if (messages.length) {
                return def.resolve();
            }
            return this.check_session_and_key();

        },
        check_session_and_key: function () {
            var self = this;
            var register_key = this.odoo_chrome_gcm_db.load('register_key');
            var origin = this.odoo_chrome_gcm_db.load('server_origin');
            var def = $.Deferred();
            if (!origin) {
                return def.reject();
            }
            if (odoo_chrome_gcm.session && register_key) {
                return def.resolve();
            }
            var session = new openerp.Session(undefined, origin, {use_cors: true});
            session.on('error', this, this.rpc_error);
            session.session_reload().then(function () {
                if (self.session_is_valid(session) && register_key) {
                    odoo_chrome_gcm.session = session;
                    def.resolve();
                } else {
                    def.reject();
                }
            });
            return def;
        },
        on_session_exception: function () {
            var self = this;
            var error = {type: "Session Expired", title: "Session Expired", data: { message: _t("You do not have session with Odoo. You will be redirected to Login page.") }};
            this.$dialog_box = $(QWeb.render('Crash.warning', {'error': error})).appendTo("body");
            this.$dialog_box.on('hidden.bs.modal', this, function () {
                self.$dialog_box.modal('hide');
                self.screen_selector.set_current_screen('register_screen', {}, {}, true, false);
            });
            this.$dialog_box.modal('show');
        },
        session_is_valid: function (session) {
            return !!session.uid;
        },
        build_widgets: function () {
            //Creates all widgets instances and add into this object
            /*----------------Screen------------------*/
            this.register_screen = new odoo_chrome_gcm.RegisterScreen(this, this.odoo_chrome_gcm_db);
            this.register_screen.appendTo(this.$('.screens'));

            this.message_list_screen = new odoo_chrome_gcm.MessageListScreen(this, this.odoo_chrome_gcm_db);
            this.message_list_screen.appendTo(this.$('.screens'));

            /*----------------Screen Selector------------------*/
            this.screen_selector = new odoo_chrome_gcm.ScreenSelector({
                screen_set: {
                    'register_screen': this.register_screen,
                    'message_list_screen' : this.message_list_screen
                },
            });
        },
        load_server_data: function (domains) {
            var self = this;
            var def = $.Deferred();
            var notif_domain = [['is_read', '=', false]];
            _.each(domains, function (domain) {
                notif_domain.push(domain);
            });
            new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "mail.notification")
                    .call("search_read", {domain: notif_domain, 'fields': ['message_id']}).done(function (messages) {
                    var message_ids = _.map(messages, function (message) { return message.message_id[0]; });
                    return new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "mail.message").call("read", [message_ids, ['subject', 'body', 'res_id', 'model', 'author_id', 'date', 'record_name']]).done(function (message_list) {
                        self.prepare_and_load_server_data(message_list);
                        def.resolve();
                    });
                });
            return def;
        },
        prepare_and_load_server_data: function (messages) {
            var self = this;
            _.each(messages, function (message) {
                self.odoo_chrome_gcm_db.save_mesages('messages', {'data': { 'subject': message.subject, 'message': message.body, 'record_name': message.record_name, 'res_id': message.res_id, 'model': message.model, 'author_id': message.author_id[0], 'author_name': message.author_id[1], 'date': message.date, 'url': self.get_url(message), 'message_id': message.id, 'is_read': false, 'receive_date': (moment(message.date).format("YYYY-MM-DD HH:MM:SS") || moment().format("YYYY-MM-DD HH:MM:SS")), 'mtype': 'user', 'color_class': 'card_normal' }, 'notification_id': self.odoo_chrome_gcm_db.getNotificationId()});
            });
        },
        get_url: function (message) {
            return _.str.sprintf("%s/web#id=%s&view_type=form&model=%s", odoo_chrome_gcm.session.origin, message.res_id, message.model);
        },
        rpc_error: function (error) {
            if (error.data.name === "openerp.http.SessionExpiredException" || error.data.name === "werkzeug.exceptions.Forbidden") {
                this.on_session_exception();
                return;
            }
            if (error.code == -32098) {
                this.show_warning({type: "Connection Failed", title: "Connection Failed", data: { message: _t("Connection with Odoo server failed. Please retry after sometime or contact to your administrator.") }});
                return;
            }
            var map_title = {
                user_error: _t('Warning'),
                warning: _t('Warning'),
                access_error: _t('Access Error'),
                missing_error: _t('Missing Record'),
                validation_error: _t('Validation Error'),
                except_orm: _t('Global Business Error'),
                access_denied: _t('Access Denied')
            };
            if (_.has(map_title, error.data.exception_type)) {
                if (error.data.exception_type == 'except_orm' || error.data.exception_type === "except_osv" || error.data.exception_type === "warning" || error.data.exception_type === "access_error") {
                    if (error.data.arguments[1]) {
                        error = _.extend({}, error, {
                            data: _.extend({}, error.data, {
                                message: error.data.arguments[1],
                                title: error.data.arguments[0] !== 'Warning' ? (" - " + error.data.arguments[0]) : ''
                            })
                        });
                    } else {
                        error = _.extend({}, error, {
                            data: _.extend({}, error.data, {
                                message: error.data.arguments[0],
                                title:  ''
                            })
                        });
                    }
                } else {
                    error = _.extend({}, error, {
                        data: _.extend({}, error.data, {
                            message: error.data.arguments[0],
                            title: map_title[error.data.exception_type] !== 'Warning' ? (" - " + map_title[error.data.exception_type]) : ''
                        })
                    });
                }
                this.show_warning(error);
            } else {
                this.show_error(error);
            }
        },
        show_warning: function (error) {
            var self = this;
            this.$dialog_box = $(QWeb.render('Crash.warning', {'error': error})).appendTo("body");
            this.$dialog_box.on('hidden.bs.modal', this, function () {
                self.$dialog_box.modal('hide');
            });
            this.$dialog_box.modal('show');
        },
        show_error: function (error) {
            var self = this;
            this.$dialog_box = $(QWeb.render('Crash.error', {'error': error})).appendTo("body");
            this.$dialog_box.on('hidden.bs.modal', this, function () {
                self.$dialog_box.modal('hide');
            });
            this.$dialog_box.modal('show');
        },
    });


    odoo_chrome_gcm.ScreenSelector = openerp.Class.extend({
        init: function (options) {
            this.screen_set = options.screen_set || {};
            this.default_screen = options.default_screen;
            this.current_screen = null;
            var screen_name;

            for (screen_name in this.screen_set) {
                this.screen_set[screen_name].hide();
            }
        },
        set_current_screen: function (screen_name, screen_data_set, params, refresh, re_render) {
            var screen = this.screen_set[screen_name];
            if (re_render) {
                screen.renderElement();
            }
            if (!screen) {
                console.error("ERROR: set_current_screen(" + screen_name + ") : screen not found");
            }

            if (refresh || screen !== this.current_screen) {
                if (this.current_screen) {
                    this.current_screen.close();
                    this.current_screen.hide();
                }
                this.current_screen = screen;
                this.current_screen.show();
                if (screen_data_set && this.current_screen.set_screen_values) {
                    this.current_screen.set_screen_values(screen_data_set);
                }
            }
        },
        set_default_screen: function () {
            //TO Check: need to pass re-render = true, forcefully need to render the screen, remove such behavior
            this.set_current_screen(this.default_screen, {}, {}, true, true);
        },
    });

    odoo_chrome_gcm.ScreenWidget = openerp.Widget.extend({
        //Base widget class, basically meant to show/hide particular screen
        init: function (parent, options) {
            this.parent = parent;
            this._super(parent, options);
        },
        show: function () {
            /*
             * this method shows the screen and sets up all the widget related to this screen. Extend this method
             * if you want to alter the behavior of the screen.
             */
            this.hidden = false;
            if (this.$el) {
                this.$el.removeClass('o_hidden');
            }
        },
        close: function () {
            /*
             * this method is called when the screen is closed to make place for a new screen. this is a good place
             * to put your cleanup stuff as it is guaranteed that for each show() there is one and only one close()
             */
        },
        hide: function () {
            /* this methods hides the screen. */
            this.hidden = true;
            if (this.$el) {
                this.$el.addClass('o_hidden');
            }
        },
        renderElement: function () {
            /*
             * we need this because some screens re-render themselves when they are hidden
             * (due to some events, or magic, or both...)  we must make sure they remain hidden.
             * the good solution would probably be to make them not re-render themselves when they are hidden.
             */
            this._super();
            if (this.hidden) {
                if (this.$el) {
                    this.$el.addClass('o_hidden');
                }
            }
        },
        check_session_and_key: function () {
            return this.parent.check_session_and_key();
        },
        on_session_exception: function () {
            return this.parent.on_session_exception();
        },
        blockUI: function () {
            return $.blockUI.apply($, arguments);
        },
        unblockUI: function () {
            return $.unblockUI.apply($, arguments);
        }
    });

    /* TODO: 1) We need to give option of logout, 2) we will register key if and only if user get succeed in login procedure */
    odoo_chrome_gcm.RegisterScreen = odoo_chrome_gcm.ScreenWidget.extend({
        template: 'RegisterScreen',
        events: {
            "click .o_gcm_register_key": "on_register_key",
            "change #inputServer,#inputSelfServer": "on_change_server_uri"
        },
        init: function (main_widget, db) {
            this._super.apply(this, arguments);
            this.main_widget = main_widget;
            this.odoo_chrome_gcm_db = db;
            this.senderId = "186813708685";
            this.register_uri = "http://www.odoomobile.com/odoo_mobile/register";
            this.self_hosted = false;
        },
        start: function () {
            this._super();
        },
        show: function () {
            var self = this;
            this._super();
            this.$el.find(".o_select_protocol").on("click", function () {
                self.$el.find(".o_button_protocol span:first").text($(this).text());
            });
        },
        get_form_data: function () {
            var server_uri = this.self_hosted ? this.$("#inputSelfServer").val() : this.$("#inputServer").val();
            var username = this.$("#inputUser").val();
            var database = this.$("#db").val();
            var password = this.$("#inputPassword").val();
            return {'server_host': server_uri, 'db': database, 'user': username, 'pwd': password};
        },
        validate_data: function (form_data) {
            if (form_data.server_host === '' || form_data.db === '' || form_data.user === '' || form_data.pwd === '') {
                return false;
            }
            return true;
        },
        strip_trailing_slash: function (str) {
            if (str.substr(-1) == '/') {
                return str.substr(0, str.length - 1);
            }
            return str;
        },
        on_register_key: function () {
            var self = this;
            var form_data = this.get_form_data();
            if (!this.validate_data(form_data)) {
                this.$('.o_gcm_register_key').parent().append($("<div>Please fill valid data.</div>"));
                return;
            }

            var register_key_callback = function () {
                var dbuuid = false;
                var db_create_date = false;
                var def_dbuuid = new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "ir.config_parameter")
                    .call("get_param", ['database.uuid']).done(function (result) {
                        dbuuid = result;
                        return $.Deferred().resolve();
                    });
                var def_db_create_date = new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "ir.config_parameter")
                    .call("get_param", ['database.create_date']).done(function (result) {
                        db_create_date = result;
                        return $.Deferred().resolve();
                    });
                $.when(def_dbuuid, def_db_create_date).done(function () {
                    chrome.gcm.register([self.senderId], function (regstration_key) {
                        console.log("regstration_key is :: ", regstration_key);
                        var manifest = chrome.runtime.getManifest();
                        self.odoo_chrome_gcm_db.save('register_key', regstration_key);
                        var params = {
                            'instance': {
                                'database': form_data.db,
                                'version': '8.0',
                                'serial': dbuuid,
                                'createdate': db_create_date,
                                'baseurl': form_data.server_host
                            },
                            'application': {
                                'name': 'Chrome Extension',
                                'package': 'com.odoo.chrome-extension',
                                'version': manifest.version
                            },
                            'device': {
                                'device_type': 'chrome',
                                'brand': 'Google',
                                'model': 'Chrome',
                                'number': $.browser.chrome ? $.browser.version : false,
                                'imei': '000000000000000',
                                'country': 'IN', //May be do server call to get country, or beeter to develop if there is no country get country from geoip at server side
                                'regkey': regstration_key, //gcm key, generated by apps,
                                'operator': false,
                                'subscriber': false,
                                'username': form_data.user
                            },
                        };
                        odoo_chrome_gcm.jsonRpc(self.register_uri, 'call', params).done(function (return_key) {
                            new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "res.users").call("read", [[session.uid], ['partner_id']]).done(function (partner) {
                                odoo_chrome_gcm.session.partner = partner[0].partner_id;
                                return new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "res.partner")
                                        .call("write", [[partner[0].partner_id[0]], {'mobilekey': return_key}]);
                            }).done(function () {

                                self.main_widget.load_server_data().then(function () {
                                    self.unblockUI();
                                    self.main_widget.screen_selector.set_current_screen("message_list_screen", {}, {}, true, true);
                                });
                            });
                        }).fail(function (error, event) {
                            console.log("Inside Failure ", error);
                            self.unblockUI();
                            odoo_chrome_gcm.session.trigger('error', error, event);
                        });
                    });
                });
            };

            var origin = this.odoo_chrome_gcm_db.load('server_origin');
            var session = new openerp.Session(undefined, form_data.server_host, {use_cors: true});
            session.on('error', this.main_widget, this.main_widget.rpc_error);
            self.blockUI();
            this.def = session.session_authenticate(form_data.db, form_data.user, form_data.pwd).done(function () {
                odoo_chrome_gcm.session = session;
                self.odoo_chrome_gcm_db.save('server_origin', session.origin);
                register_key_callback();
            }).fail(function (error, event) {
                self.unblockUI();
                var error_details = error;
                if (!error || !error.data) {
                    error_details = {'data': {'exception_type': 'validation_error', 'arguments': [_t('Something went wrong, please check your username or password')]}};
                }
                session.trigger('error', error_details, event);
            });
        },
        session_is_valid: function (session) {
            return !!session.uid;
        },
        on_change_server_uri: function () {
            var self = this;
            var def = $.Deferred();
            var server_uri = this.self_hosted ? this.$("#inputSelfServer").val() : this.$("#inputServer").val();
            this.$(".o_gcm_register_key").attr({'disabled': true});
            if (server_uri == "https://www.odoo.com" || server_uri == "https://accounts.odoo.com") {
                def.resolve(['openerp']);
            }
            odoo_chrome_gcm.jsonRpc(this.strip_trailing_slash(server_uri) + '/web/database/get_list', 'call', {}).done(function (result) {
                if (self.$("#db").length) {
                    self.$("#db_label").remove();
                    self.$("#db").remove();
                }
                def.resolve(result);
            });
            $.when(def).done(function (result) {
                self.$(".o_gcm_register_key").attr({'disabled': false});
                self.$(".o_accept_login").before(QWeb.render('DatabaseList', {widget: self, databases: result }));
            });
        },
    });

    odoo_chrome_gcm.MessageListScreen = odoo_chrome_gcm.ScreenWidget.extend({
        template: 'MessageListScreen',
        events: {
            "click .o_refresh": "on_refresh",
            "click .o_signout": "on_signout",
            "click .o_mark_all_as_read": "on_mark_all_as_read",
        },
        init: function (main_widget, db) {
            this._super.apply(this, arguments);
            this.main_widget = main_widget;
            this.odoo_chrome_gcm_db = db;
            this.messages = [];
        },
        start: function () {
            var self = this;
            this._super();
            $(window).bind('storage', function (e) {
                if (e.originalEvent.key && e.originalEvent.key == 'messages') {
                    self.reload_screen();
                }
            });
        },
        renderElement: function () {
            this.messages = this.odoo_chrome_gcm_db.load('messages');
            this.message_groups = this.generate_message_groups(this.messages);
            this.odoo_news = _(this.message_groups.odoo).values() || [];
            this.odoo_news = this.odoo_news.length ? this.odoo_news[0] : [];
            delete this.message_groups.odoo;
            this.replaceElement(QWeb.render(this.template, {widget: this}));
            var res_super = this._super.apply(this, arguments);
            this.do_apply_timeago(this.odoo_news);
            this.render_groups();
            return res_super;
        },
        render_groups: function () {
            var self = this;
            var today_message_group = this.get_group(moment().format('YYYY-MM-DD'));
            today_message_group = today_message_group.length ? today_message_group[0] : [];
            var tomorrow_message_group = this.get_group(moment().add(1, 'days').format('YYYY-MM-DD'));
            tomorrow_message_group = tomorrow_message_group.length ? tomorrow_message_group[0] : [];
            var delayed_message_group = this.get_delayed(moment().format('YYYY-MM-DD'));
            var upcoming_message_group = this.get_upcoming(moment().add(2, 'days').format('YYYY-MM-DD'));
            var someday_group = this.get_someday();
            var groups = [{'group_name': 'delayed', 'group_title': _t('Delayed'), 'messages': delayed_message_group}, {'group_name': 'today', 'group_title': _t('Today'), 'messages': today_message_group}, {'group_name': 'tomorrow', 'group_title': _t('Tomorrow'), 'messages': tomorrow_message_group}, {'group_name': 'up_coming', 'group_title': _t('Up coming'), 'messages': upcoming_message_group}, {'group_name': 'some_day', 'group_title': _t('Some Day'), 'messages': someday_group}];
            this.record_groups = [];
            _.each(groups, function (group) {
                var message_group_obj = new odoo_chrome_gcm.MessageGroup(self, group);
                self.record_groups.push(message_group_obj);
                message_group_obj.appendTo(self.$el.find(".o_message_screen"));
                return message_group_obj;
            });
        },
        generate_message_groups: function (messages) {
            var grouped_messages = {};
            var type_grouped_messages = _(messages).chain()
                .filter(function (message) {return message && message.data !== undefined; })
                .groupBy(function(message) {
                    return message.data.mtype;
                }).value();
            _.map(type_grouped_messages, function (type_group, type) {
                var key = (type == 'undefined' ? 'user' : type);
                grouped_messages[key] = _(type_group).groupBy(function (group) {
                    //TO-DO:Remove at the time of production(schedule)
                    // return (group.data.receive_date).substring(0, 10);
                    return "2015-04-10";
                });
            });
            return grouped_messages;
        },
        get_group: function (date) {
            if (_.isEmpty(this.message_groups)) {
                return [];
            }
            return _(this.message_groups.user).chain()
                .pick(date).values().value();
        },
        get_upcoming: function (date) {
            var upcoming_messages = [];
            _.each(this.message_groups.user, function (message_group, key) {
                if (moment(key).isAfter(moment(date))) {
                    upcoming_messages = upcoming_messages.concat(message_group);
                }
            });
            return upcoming_messages;
        },
        get_delayed: function (date) {
            var delayed_messages = [];
            _.each(this.message_groups.user, function (message_group, key) {
                if (moment(key).isBefore(moment(date))) {
                    delayed_messages = delayed_messages.concat(message_group);
                }
            });
            return delayed_messages;
        },
        get_someday: function () {
            var someday_messages = [];
            _.each(this.message_groups.user, function (message_group, key) {
                if (moment(key) === undefined || moment(key) === 'undefined') {
                    someday_messages = someday_messages.concat(message_group);
                }
            });
            return someday_messages;
        },
        move_record: function (notification_id, source, destination) {
            var source_group = _(this.record_groups).find(function (group) { return group.name == source; });
            var destination_group = _(this.record_groups).find(function (group) { return group.name == destination; });
            //Pop message from source group, change its date and push on top on destination group
            var date_mapping = {'today': moment().format("YYYY-MM-DD HH:MM:SS"), 'tomorrow': moment().add(1, 'days').format("YYYY-MM-DD HH:MM:SS"), 'up_coming': moment().add(7, 'days').format("YYYY-MM-DD HH:MM:SS"), 'some_day': false};
            var message = _.find(source_group.messages, function (data) { return data.notification_id.toString() == notification_id.toString(); });
            message.data.receive_date = date_mapping[destination];
            this.odoo_chrome_gcm_db.change_messsage_date(notification_id, date_mapping[destination]);
            source_group.messages = _.filter(source_group.messages, function (data) { return data.notification_id.toString() != notification_id.toString(); });
            destination_group.messages.unshift(message);
            source_group.reload_group();
            destination_group.reload_group();
        },
        do_apply_timeago: function (messages) {
            var self = this;
            _.each(messages, function (message) {
                if (message.data.date || message.data.receive_date) {
                    var $message_element = self.$el.find(".o_timeago#" + message.notification_id);
                    var date = message.data.date ? odoo_chrome_gcm.str_to_datetime(message.data.date) : odoo_chrome_gcm.str_to_datetime(message.data.receive_date);
                    var timerelative = $.timeago(date);
                    $message_element.text(timerelative);
                }
            });
        },
        set_notification_as_read: function (notification_ids) {
            return new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "mail.notification").call("write", [notification_ids, {'is_read': true}]);
        },
        on_mark_all_as_read: function () {
            var self = this;
            var def = $.Deferred();
            var messages = this.odoo_chrome_gcm_db.load('messages');
            var message_ids = _.map(messages, function (message) {
                return message.data.message_id;
            });
            var related_ids = _.map(messages, function (message) {
                return message.data.related_ids;
            });
            message_ids = _.union(message_ids, _.flatten(related_ids)).map(function (message_id) {
                return parseInt(message_id, 10);
            });
            this.check_session_and_key().done(function () {
                new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "mail.notification")
                    .call("search", [[['message_id', 'in', message_ids]]]).done(function (notification_ids) {
                        if (notification_ids.length) {
                            self.set_notification_as_read(notification_ids).done(function () {
                                def.resolve();
                            });
                        } else {
                            def.resolve();
                        }
                    });
                $.when(def).done(function () {
                    self.odoo_chrome_gcm_db.remove_all_msg();
                    self.messages = self.odoo_chrome_gcm_db.load('messages');
                    self.reload_screen();
                });
            }).fail(function () {
                return self.on_session_exception();
            });
        },
        reload_screen: function () {
            this.main_widget.screen_selector.set_current_screen("message_list_screen", {}, {}, true, true);
        },
        on_refresh: function (e) {
            var self = this;
            var messages = this.odoo_chrome_gcm_db.load('messages');
            var available_message_ids = _.map(messages, function (message) {
                return message.data.message_id;
            });
            var domain = [['message_id', 'not in', available_message_ids]];
            this.check_session_and_key().done(function () {
                self.blockUI();
                $(e.currentTarget).addClass('fa-spin');
                self.main_widget.load_server_data(domain).then(function () {
                    $.unblockUI();
                    $(e.currentTarget).removeClass('fa-spin');
                    self.reload_screen();
                });
            }).fail(function () {
                return self.on_session_exception();
            });
        },
        on_signout: function () {
            this.odoo_chrome_gcm_db.clear_storage();
            this.main_widget.screen_selector.set_current_screen("register_screen", {}, {}, true, true);
        },
    });

    odoo_chrome_gcm.MessageGroup = openerp.Widget.extend({
        template: 'MessageGroup',
        events: {
            "click .o_message": "on_message_click",
            "click .o_read_done": "on_read_done",
            "click .o_move_record": "on_move_record",
            "click .o_change_color": "on_change_color",
            "click .group_header": "on_group_header_click"
        },
        init: function (parent, group) {
            this.parent = parent;
            this.name = group.group_name;
            this.title = group.group_title;
            this.messages = group.messages;
            this.odoo_chrome_gcm_db = this.parent.odoo_chrome_gcm_db;
            this._super.apply(this, arguments);
        },
        start: function () {
            this._super.apply(this, arguments);
            this.parent.do_apply_timeago(this.messages);
        },
        on_move_record: function (e) {
            e.stopPropagation();
            var $target = $(e.target);
            var source_group = $target.data('source-group');
            var destination_group = $target.data('destination-group');
            var notification_id = $target.data('notification_id');
            this.parent.move_record(notification_id, source_group, destination_group);
        },
        on_change_color: function (e) {
            e.stopPropagation();
            var $target = $(e.currentTarget);
            $(".btn-group").removeClass('open');
            var message = this.odoo_chrome_gcm_db.get_msg_by_notif_id($target.data('notification_id'));
            var this_message = this.get_msg_by_notif_id($target.data('notification_id'));
            $target.parents('.o_message').removeClass('card_normal card_high card_low').addClass($target.data('color-class'));
            message.data.color_class = $target.data('color-class');
            this_message.data.color_class = $target.data('color-class');
            this.odoo_chrome_gcm_db.save_mesages('messages', message);
        },
        on_message_click: function (e) {
            if ($(e.target).hasClass('o_read_done') || $(e.target).hasClass('mdi-action-query-builder') || $(e.target).hasClass('o_color_options')) {
                return;
            }
            var notification_id = $(e.currentTarget).data("notification_id");
            var message = this.odoo_chrome_gcm_db.get_msg_by_notif_id(notification_id);
            window.open(message.data.url);
        },
        on_read_done: function (e) {
            var self = this;
            e.stopPropagation();
            var def = $.Deferred();
            var notification_id = $(e.currentTarget).data("notification_id");
            var message = this.odoo_chrome_gcm_db.get_msg_by_notif_id(notification_id);
            //For child or parent ids, when message is set to read, its child and parent should also be set to read
            var message_ids = _.union([message.data.message_id], message.data.related_ids);
            this.parent.check_session_and_key().done(function () {
                new odoo_chrome_gcm.Model(odoo_chrome_gcm.session, "mail.notification")
                    .call("search", [[['message_id', 'in', message_ids]]]).done(function (notification_ids) {
                        if (notification_ids.length) {
                            self.parent.set_notification_as_read(notification_ids).done(function() {
                                def.resolve();
                            });
                        } else {
                            def.resolve();
                        }
                    });
                $.when(def).done(function () {
                    self.messages = self.remove_msg_by_notif_id(notification_id);
                    self.odoo_chrome_gcm_db.remove_msg_by_notif_id(notification_id);
                    //TODO: Do not reload screen, just remove it from DOM
                    self.reload_group();
                });
            }).fail(function () {
                return self.parent.on_session_exception();
            });
        },
        on_group_header_click: function(e) {
            var $target = $(e.currentTarget);
            var group_id = $target.data('group-id');
        },
        get_msg_by_notif_id: function(notification_id) {
            var message = _.find(this.messages, function (data) { return data.notification_id == notification_id.toString(); });
            return message;
         },
        remove_msg_by_notif_id: function (notification_id) {
            var messages = _.filter(this.messages, function (message) { return message.notification_id != notification_id.toString(); });
            return messages;
        },
        //Do not reload whole group, just remove whole message from DOM
        reload_group: function () {
            this.replaceElement(QWeb.render(this.template, {widget: this}));
            this.parent.do_apply_timeago(this.messages);
        },
        get_group_count: function () {
            var count = 0;
            _.each(this.messages, function (message) {
                count += message.count;
            });
            return count;
        },
    });
}