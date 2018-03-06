'use strict';

var Service;
var Characteristic;
var request = require('request');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-synology-surveillance-homemode', 'SSHomeMode', HttpMultiswitch);
};

function HttpMultiswitch(log, config) {
    this.log = log;

    this.name = config.name || 'MultiSwitch';
    this.url = config.url;

    this.username = config.username || '';
    this.password = config.password || '';
    this.sessionToken = "";
}

HttpMultiswitch.prototype = {


    httpRequest: function (path, callback, recursive) {
        var _this = this;
        request({
                url: this.url + path + "&_sid=" + this.sessionToken,
                method: "GET",
                rejectUnauthorized: false,
            },
            function (error, response, body) {
                var resp = JSON.parse(body);
                if (resp.success || recursive) {
                    callback(error, response, body);
                }
                else {
                    _this.httpRequest("/webapi/auth.cgi?api=SYNO.API.Auth&method=Login&version=3&account=" + _this.username + "&passwd=" + _this.password + "&session=SurveillanceStation&format=sid",
                        function (err, resp, bod) {
                            var r = JSON.parse(bod);
                            if (r.success) {
                                //OK logged in
                                _this.sessionToken = r.data.sid;
                                _this.log.info("Logged in.");
                                //Retry the request
                                _this.httpRequest(path, callback, true);
                            }
                            else {
                                //Didnt work
                                _this.log.error("Unable to login " + bod);
                            }
                        });
                }
            });
    },
    getState: function (targetService, callback) {
        this.httpRequest("/webapi/entry.cgi?api=SYNO.SurveillanceStation.HomeMode&version=1&method=GetInfo", function (error, response, responseBody) {
            if (error) {
                this.log.error('getPowerState failed: ' + error.message);
                this.log('response: ' + response + '\nbody: ' + responseBody);

                callback(error);
            } else {
                var resp = JSON.parse(responseBody);
                callback(error, resp.data.on);
            }
        }.bind(this));
    },

    setPowerState: function (targetService, powerState, callback) {
        var state = (powerState ? "off" : "on");
        this.httpRequest("/webapi/entry.cgi?api=SYNO.SurveillanceStation.HomeMode&version=1&method=Switch&" + state + "=true", function (error, response, responseBody) {
            if (error) {
                this.log.error('setPowerState failed: ' + error.message);
                this.log('response: ' + response + '\nbody: ' + responseBody);

                callback(error);
            } else {
                this.log.info('==> ' + (powerState ? "On" : "Off"));
                callback();
            }
        }.bind(this));
    },

    identify: function (callback) {
        this.log('Identify me Senpai!');
        callback();
    },

    getServices: function () {
        this.services = [];

        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Synology')
            .setCharacteristic(Characteristic.Model, 'Surveillance Station');
        this.services.push(informationService);


        var switchService = new Service.Switch(this.name);
        switchService
            .getCharacteristic(Characteristic.On)
            .on('set', this.setPowerState.bind(this, switchService))
            .on('get', this.getState.bind(this, switchService));

        this.services.push(switchService);

        return this.services;
    }
};

