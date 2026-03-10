'use strict';

module.exports = (api) => {
  api.registerAccessory('homebridge-http-multiswitch', 'HttpMultiswitch', HttpMultiswitch);
};

class HttpMultiswitch {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.hap = api.hap;

    this.name = config.name || 'MultiSwitch';
    this.switchType = config.switch_type;
    this.baseUrl = config.base_url || '';
    this.httpMethod = config.http_method || 'GET';
    this.username = config.username;
    this.password = config.password;
    this.referer = config.referer;

    this.informationService = new this.hap.Service.AccessoryInformation()
      .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Http-MultiSwitch')
      .setCharacteristic(this.hap.Characteristic.Model, 'Http-MultiSwitch');

    this.services = [this.informationService];
    this.switchServices = [];
    this.isWorking = false;

    if (this.switchType === 'Switch') {
      this.setupSwitch();
    } else if (this.switchType === 'Multiswitch') {
      this.setupMultiswitch();
    } else {
      throw new Error(`Unknown homebridge-http-multiswitch switch type: ${this.switchType}`);
    }
  }

  setupSwitch() {
    this.onUrl = this.baseUrl + (this.config.on_url || '');
    this.offUrl = this.baseUrl + (this.config.off_url || '');
    this.onBody = this.config.on_body || '';
    this.offBody = this.config.off_body || '';

    const switchService = new this.hap.Service.Switch(this.name);
    const characteristic = switchService.getCharacteristic(this.hap.Characteristic.On);
    
    characteristic.onSet(async (value) => {
      if (value === characteristic.value) return;
      await this.setPowerState(switchService, value);
    });

    this.services.push(switchService);
  }

  setupMultiswitch() {
    const multiswitchNames = this.config.multiswitch || [];
    this.multiurls = this.config.multiurls || [];

    for (let i = 0; i < multiswitchNames.length; i++) {
      const switchName = multiswitchNames[i];
      const switchService = new this.hap.Service.Switch(switchName, switchName);
      
      switchService.setCharacteristic(this.hap.Characteristic.Name, switchName);
      if (this.hap.Characteristic.ConfiguredName) {
        switchService.setCharacteristic(this.hap.Characteristic.ConfiguredName, switchName);
      }

      const characteristic = switchService.getCharacteristic(this.hap.Characteristic.On);

      characteristic.onSet(async (value) => {
        // If it's already in the state we want, don't do anything
        if (value === characteristic.value) return;

        if (value === true) {
          await this.setPowerState(switchService, true, i);
        } else {
          // Turning off a radio button. In this design, we don't send a request,
          // but we still update the internal state check.
          await this.setPowerState(switchService, false, i);
        }
      });

      this.switchServices.push(switchService);
      this.services.push(switchService);
    }
  }

  async setPowerState(targetService, powerState, index) {
    if (this.isWorking && powerState) {
        this.log.debug(`Ignoring request for ${targetService.displayName}; another request is in progress.`);
        return;
    }

    let url = '';
    let body = '';

    if (this.switchType === 'Switch') {
      url = powerState ? this.onUrl : this.offUrl;
      body = powerState ? this.onBody : this.offBody;
    } else {
      if (powerState && index !== undefined) {
        url = this.baseUrl + this.multiurls[index];
        
        this.isWorking = true;
        // Radio button behavior: Turn off other switches in the group visually
        for (const service of this.switchServices) {
          if (service !== targetService) {
            service.getCharacteristic(this.hap.Characteristic.On).updateValue(false);
          }
        }
      } else {
        // Turning off a multiswitch button. No request sent.
        return;
      }
    }

    try {
      this.log.debug(`Sending ${this.httpMethod} request to: ${url}`);
      await this.httpRequest(url, body);
      this.log.info(`Successfully set ${targetService.displayName} to ${powerState ? 'ON' : 'OFF'}`);
    } catch (error) {
      this.log.error(`Failed to set ${targetService.displayName} state (URL: ${url}): ${error.message}`);
      if (error.cause) {
        this.log.error(`Cause: ${error.cause.message || error.cause}`);
      }
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    } finally {
        this.isWorking = false;
    }
  }

  async httpRequest(url, body) {
    if (!url) {
      throw new Error('No URL provided for request');
    }
    const headers = {};
    if (this.referer) {
      headers['Referer'] = this.referer;
    }

    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const options = {
      method: this.httpMethod,
      headers: headers,
      body: (this.httpMethod !== 'GET' && this.httpMethod !== 'HEAD') ? body : undefined,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  getServices() {
    return this.services;
  }

  identify() {
    this.log.info('Identify me Senpai!');
  }
}
