import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from 'homebridge';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('homebridge-http-multiswitch', 'HttpMultiswitch', HttpMultiswitch);
};

class HttpMultiswitch implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly name: string;
  private readonly switchType: 'Switch' | 'Multiswitch';
  private readonly baseUrl: string;
  private readonly httpMethod: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly referer?: string;

  private readonly services: Service[] = [];
  private readonly informationService: Service;

  // Switch specific
  private onUrl?: string;
  private offUrl?: string;
  private onBody?: string;
  private offBody?: string;

  // Multiswitch specific
  private multiswitchNames: string[] = [];
  private multiurls: string[] = [];
  private switchServices: Service[] = [];

  constructor(log: Logging, config: AccessoryConfig) {
    this.log = log;
    this.config = config;
    this.name = config.name || 'MultiSwitch';
    this.switchType = config.switch_type;
    this.baseUrl = config.base_url;
    this.httpMethod = config.http_method || 'GET';
    this.username = config.username;
    this.password = config.password;
    this.referer = config.referer;

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Http-MultiSwitch')
      .setCharacteristic(hap.Characteristic.Model, 'Http-MultiSwitch');

    this.services.push(this.informationService);

    if (this.switchType === 'Switch') {
      this.setupSwitch();
    } else if (this.switchType === 'Multiswitch') {
      this.setupMultiswitch();
    } else {
      throw new Error(`Unknown homebridge-http-multiswitch switch type: ${this.switchType}`);
    }
  }

  private setupSwitch() {
    this.onUrl = this.baseUrl + (this.config.on_url || '');
    this.offUrl = this.baseUrl + (this.config.off_url || '');
    this.onBody = this.config.on_body || '';
    this.offBody = this.config.off_body || '';

    const switchService = new hap.Service.Switch(this.name);
    switchService
      .getCharacteristic(hap.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        await this.setPowerState(switchService, value as boolean);
      });

    this.services.push(switchService);
  }

  private setupMultiswitch() {
    this.multiswitchNames = this.config.multiswitch || [];
    this.multiurls = this.config.multiurls || [];

    for (let i = 0; i < this.multiswitchNames.length; i++) {
      const switchName = this.multiswitchNames[i];
      const switchService = new hap.Service.Switch(switchName, switchName);

      switchService
        .getCharacteristic(hap.Characteristic.On)
        .onSet(async (value: CharacteristicValue) => {
          if (value === true) {
            await this.setPowerState(switchService, true, i);
          } else {
            // In a multiswitch (radio buttons), turning off the active one 
            // usually isn't desired if it's meant to be "one is always on",
            // but we'll allow it for flexibility unless the user wants strict radio behavior.
            // For now, let's match the original behavior which didn't prevent turning off.
            // However, the original code mostly focused on turning OTHERS off when one is turned ON.
            await this.setPowerState(switchService, false, i);
          }
        });

      this.switchServices.push(switchService);
      this.services.push(switchService);
    }
  }

  private async setPowerState(targetService: Service, powerState: boolean, index?: number) {
    let url = '';
    let body = '';

    if (this.switchType === 'Switch') {
      url = powerState ? this.onUrl! : this.offUrl!;
      body = powerState ? this.onBody! : this.offBody!;
    } else {
      // Multiswitch logic
      if (powerState && index !== undefined) {
        url = this.baseUrl + this.multiurls[index];
        // Turn off other switches in the group
        for (const service of this.switchServices) {
          if (service !== targetService) {
            service.updateCharacteristic(hap.Characteristic.On, false);
          }
        }
      } else {
        // If turning off a multiswitch button, we don't have a specific "off" URL in the original design
        // because it's a radio button. The original code just didn't do anything for 'false' in Multiswitch
        // except for the recursive calls.
        return;
      }
    }

    try {
      await this.httpRequest(url, body);
      this.log.info(`Successfully set ${targetService.displayName} to ${powerState ? 'ON' : 'OFF'}`);
    } catch (error) {
      this.log.error(`Failed to set ${targetService.displayName} state: ${error}`);
      // Revert the characteristic if it failed? Homebridge usually handles this via throwing error in onSet
      throw new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private async httpRequest(url: string, body: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.referer) {
      headers['Referer'] = this.referer;
    }

    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const options: RequestInit = {
      method: this.httpMethod,
      headers: headers,
      body: this.httpMethod !== 'GET' && this.httpMethod !== 'HEAD' ? body : undefined,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  getServices(): Service[] {
    return this.services;
  }

  identify(): void {
    this.log.info('Identify me Senpai!');
  }
}
