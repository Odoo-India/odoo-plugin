//var background = chrome.extension.getBackgroundPage();
//odoo_chrome_gcm = background.odoo_chrome_gcm;

function application() {
    'use strict';

    odoo_chrome_gcm_widget(odoo_chrome_gcm); //Import widget.js
    odoo_chrome_gcm_db(odoo_chrome_gcm); //Import db

    odoo_chrome_gcm.App = (function() {
        function App($element) {
            this.initialize($element);
        }
        var templates_def = $.Deferred().resolve();
        App.prototype.add_template_file = function(template) {
            var def = $.Deferred();
            templates_def = templates_def.then(function() {
                openerp.qweb.add_template(template, function(err) {
                    if (err) {
                        def.reject(err);
                    } else {
                        def.resolve();
                    }
                });
                return def;
            });
            return def;
        };
        App.prototype.initialize = function($element) {
            this.$el = $element;

            var Connect = new XMLHttpRequest();
            // Define which file to open and
            // send the request.
            Connect.open("GET", "static/src/xml/odoo_chrome_gcm.xml", false);
            Connect.setRequestHeader("Content-Type", "text/xml");
            Connect.send(null);

            // Place the response in an XML document.
            var xml = Connect.responseXML;

            this.add_template_file(xml);

            if ($.blockUI) {
                $.blockUI.defaults.baseZ = 1100;
                $.blockUI.defaults.message = '<div class="openerp oe_blockui_spin_container" style="background-color: transparent;">';
                $.blockUI.defaults.css.border = '0';
                $.blockUI.defaults.css["background-color"] = '';
            }
            this.odoo_chrome_gcm_main_widget = new odoo_chrome_gcm.odoo_chrome_gcm_main_widget(null, {});
            this.odoo_chrome_gcm_main_widget.appendTo($element);
        };
        return App;
    })();

    jQuery(document).ready(function() {
        var app = new odoo_chrome_gcm.App($(".odoo_chrome_gcm"));
    });
};
//chrome.runtime.getBackgroundPage(function(background) {
    //odoo_chrome_gcm = background.odoo_chrome_gcm;
    odoo_chrome_gcm = _.clone(openerp);
    application();
//});