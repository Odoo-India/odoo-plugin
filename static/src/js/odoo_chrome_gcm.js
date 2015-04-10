//var background = chrome.extension.getBackgroundPage();
//odoo_chrome_gcm = background.odoo_chrome_gcm;

function application() {
    'use strict';

    odoo_chrome_gcm_widget(odoo_chrome_gcm); //Import widget.js
    odoo_chrome_gcm_db(odoo_chrome_gcm); //Import db

    odoo_chrome_gcm.App = (function () {
        function App($element) {
            this.initialize($element);
        }
        var templates_def = $.Deferred().resolve();
        App.prototype.add_template_file = function (template) {
            var def = $.Deferred();
            templates_def = templates_def.then(function () {
                openerp.qweb.add_template(template, function (err) {
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
        App.prototype.initialize = function ($element) {
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
                $.blockUI.defaults.message = '<div class="openerp oe_blockui_spin_container fa fa-refresh fa-3x fa-spin" style="background-color: transparent; color: #FFFFFF;">';
                $.blockUI.defaults.css.border = '0';
                $.blockUI.defaults.css["background-color"] = '';
            }
            this.odoo_chrome_gcm_main_widget = new odoo_chrome_gcm.odoo_chrome_gcm_main_widget(null, {});
            this.odoo_chrome_gcm_main_widget.appendTo($element);
        };
        return App;
    })();

    //TO Improve: May be move it to MessageScreen or ScreenWidget
    jQuery(document).ready(function () {
        var app = new odoo_chrome_gcm.App($(".odoo_chrome_gcm"));
        $.material.init();
        $(document).keyup(function(e) {
            var search_text = $('.card_search_input').val();
            if(search_text.length == 0 & e.which == 8){
                $(".group_header").fadeIn();
                $('.o_message').show();
                $(".o_message").unhighlight();
                $( '.card_search' ).slideUp(200,function(){
                });
            }else{
                _.each($('.o_message'),function(message){
                    if($(message).text().toLowerCase().indexOf(search_text.toLowerCase()) != -1){
                        $(message).show();
                    }else{
                        $(message).hide();
                    }
                });
                $( '.card_search' ).slideDown(100,function(){
                    $(".group_header").hide();
                });
                if(search_text.length == 0){
                    $('input').val(String.fromCharCode(e.which).toLowerCase());
                }
                $( '.card_search_input').focus();
                $(".o_message").unhighlight();
                $(".o_message").highlight(search_text);

            }
        })
    });
};
//chrome.runtime.getBackgroundPage(function(background) {
    //odoo_chrome_gcm = background.odoo_chrome_gcm;
odoo_chrome_gcm = _.clone(openerp);
application();
//});