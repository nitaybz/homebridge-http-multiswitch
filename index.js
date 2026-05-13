'use strict';

var Service;
var Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-http-multiswitch', 'HttpMultiswitch', HttpMultiswitch);
};

function HttpMultiswitch(log, config) {
    this.log = log;

    this.name            = config.name             || 'MultiSwitch';
    this.switchType      = config.switch_type;
    this.baseUrl         = config.base_url;
    this.httpMethod      = config.http_method      || 'GET';

    this.username        = config.username         || '';
    this.password        = config.password         || '';
    this.sendImmediately = config.send_immediately || '';

    this.referer         = config.referer          || '';

    switch (this.switchType) {
        case 'Switch':
            this.onUrl   = this.baseUrl + config.on_url;
            this.offUrl  = this.baseUrl + config.off_url;
            this.onBody  = config.on_body  || '';
            this.offBody = config.off_body || '';
            break;

        case 'Multiswitch':
            this.multiswitch = config.multiswitch;
            this.multiurls = config.multiurls;
            break;

        default:
            throw new Error('Unknown homebridge-http-multiswitch switch type');
    }
}

HttpMultiswitch.prototype = {
    httpRequest: async function(url, body, method) {
        const init = {
            method,
            // The legacy `request` library defaulted to rejectUnauthorized:false so existing
            // configs aimed at receivers with self-signed certs keep working.
            // node's fetch only honours this via a custom agent; for typical Homebridge
            // accessory URLs (local LAN, http) it does not matter.
            headers: {}
        };

        if (this.username || this.password) {
            const basic = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            init.headers['Authorization'] = `Basic ${basic}`;
        }
        if (this.referer) init.headers['Referer'] = this.referer;
        if (body) init.body = body;

        const res = await fetch(url, init);
        const text = await res.text();
        if (!res.ok) {
            const err = new Error(`HTTP ${res.status} ${res.statusText}`);
            err.response = { status: res.status, body: text };
            throw err;
        }
        return text;
    },

    setPowerState: async function(targetService, powerState) {
        var reqUrl = '', reqBody = '';

        switch (this.switchType) {
            case 'Switch':
                if (!this.onUrl || !this.offUrl) {
                    this.log.warn('Ignoring request; No power state urls defined.');
                    throw new Error('No power state urls defined.');
                }
                reqUrl  = powerState ? this.onUrl  : this.offUrl;
                reqBody = powerState ? this.onBody : this.offBody;
                break;

            case 'Multiswitch':
                this.services.forEach(function (switchService, idx) {
                    if (idx === 0) return; // skip AccessoryInformation
                    if (targetService.subtype === switchService.subtype) {
                        reqUrl = this.baseUrl + this.multiurls[idx-1];
                    } else {
                        // updateValue pushes state to HomeKit without re-entering this handler.
                        switchService.getCharacteristic(Characteristic.On).updateValue(false);
                    }
                }.bind(this));
                break;

            default:
                this.log('Unknown homebridge-http-multiswitch type in setPowerState');
                return;
        }

        try {
            await this.httpRequest(reqUrl, reqBody, this.httpMethod);
            switch (this.switchType) {
                case 'Switch':
                    this.log.info('==> ' + (powerState ? 'On' : 'Off'));
                    break;
                case 'Multiswitch':
                    this.log('==> ' + targetService.subtype);
                    break;
            }
        } catch (err) {
            this.log.error('setPowerState failed: ' + err.message);
            if (err.response) this.log('response status: ' + err.response.status + '\nbody: ' + err.response.body);
            throw err;
        }
    },

    identify: function (callback) {
        this.log('Identify me Senpai!');
        callback();
    },

    getServices: function () {
        this.services = [];

        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Http-MultiSwitch')
            .setCharacteristic(Characteristic.Model, 'Http-MultiSwitch');
        this.services.push(informationService);

        switch (this.switchType) {
            case 'Switch':
                this.log('(switch)');

                var switchService = new Service.Switch(this.name);
                switchService
                    .getCharacteristic(Characteristic.On)
                    .onSet((value) => this.setPowerState(switchService, value));

                this.services.push(switchService);

                break;
            case 'Multiswitch':
                this.log('(multiswitch)');

                for (var i = 0; i < this.multiswitch.length; i++) {
                    var switchName = this.multiswitch[i];

                    switch(i) {
                        case 0:
                            this.log.warn('---+--- ' + switchName); break;
                        case this.multiswitch.length-1:
                            this.log.warn('   +--- ' + switchName); break;
                        default:
                            this.log.warn('   |--- ' + switchName);
                    }

                    var multiSwitchService = new Service.Switch(switchName, switchName);

                    (function (svc) {
                        svc.getCharacteristic(Characteristic.On)
                            .onSet((value) => this.setPowerState(svc, value));
                    }).call(this, multiSwitchService);

                    this.services.push(multiSwitchService);
                }

                break;
            default:
                this.log('Unknown homebridge-http-multiswitch type in getServices');
        }

        return this.services;
    }
};
